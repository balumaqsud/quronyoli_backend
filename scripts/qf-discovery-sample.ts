/**
 * Read-only Quran.Foundation discovery sampler (not wired into Nest / CI).
 * Usage: npx ts-node --transpile-only scripts/qf-discovery-sample.ts
 *
 * Loads .env; writes sanitized samples to docs/qf-discovery-samples.json.
 * Requires working QF_CLIENT_ID / QF_CLIENT_SECRET for the selected QF_ENV.
 * If OAuth fails, keep using docs/qf-discovery-samples.json from the last
 * successful run (or public Content catalog fallback) and update
 * docs/qf-integration-contract.md gaps.
 */
import { config as loadEnv } from 'dotenv';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '.env') });

type EnvName = 'prelive' | 'production';

const AUTH_BASE: Record<EnvName, string> = {
  prelive: 'https://prelive-oauth2.quran.foundation',
  production: 'https://oauth2.quran.foundation',
};

const API_BASE: Record<EnvName, string> = {
  prelive: 'https://apis-prelive.quran.foundation',
  production: 'https://apis.quran.foundation',
};

async function getToken(
  env: EnvName,
  clientId: string,
  clientSecret: string,
  scope: string,
): Promise<string> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${AUTH_BASE[env]}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope,
    }),
  });
  if (!response.ok) {
    throw new Error(`Token (${scope}) failed: ${response.status}`);
  }
  const json = (await response.json()) as { access_token: string };
  return json.access_token;
}

async function getJson(
  url: string,
  clientId: string,
  token: string,
): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      'x-auth-token': token,
      'x-client-id': clientId,
    },
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (!response.ok) {
    return { error: true, status: response.status, body };
  }
  return body;
}

function pickResources(
  items: Array<Record<string, unknown>>,
  languages: string[],
  limit = 8,
): Array<Record<string, unknown>> {
  const matched = items.filter((item) => {
    const lang = String(
      item.language_name ?? item.language ?? item.slug ?? '',
    ).toLowerCase();
    return languages.some((wanted) => lang.includes(wanted));
  });
  const source = matched.length > 0 ? matched : items;
  return source.slice(0, limit).map((item) => ({
    id: item.id,
    name: item.name ?? item.translated_name,
    author_name: item.author_name,
    language_name: item.language_name ?? item.language,
    slug: item.slug,
    style: item.style,
  }));
}

async function main(): Promise<void> {
  const clientId = process.env.QF_CLIENT_ID;
  const clientSecret = process.env.QF_CLIENT_SECRET;
  const env = (process.env.QF_ENV ?? 'prelive') as EnvName;
  if (!clientId || !clientSecret) {
    throw new Error('QF_CLIENT_ID and QF_CLIENT_SECRET are required');
  }
  if (env !== 'prelive' && env !== 'production') {
    throw new Error('QF_ENV must be prelive or production');
  }

  const contentPrefix = process.env.QF_CONTENT_PATH_PREFIX ?? '/content/api/v4';
  const searchPrefix = process.env.QF_SEARCH_PATH_PREFIX ?? '/search/v1';
  const contentScope = process.env.QF_CONTENT_SCOPE ?? 'content';
  const searchScope = process.env.QF_SEARCH_SCOPE ?? 'search';

  const contentToken = await getToken(
    env,
    clientId,
    clientSecret,
    contentScope,
  );
  let searchToken: string;
  try {
    searchToken = await getToken(env, clientId, clientSecret, searchScope);
  } catch {
    searchToken = contentToken;
  }

  const contentBase = `${API_BASE[env]}${contentPrefix}`;
  const searchBase = `${API_BASE[env]}${searchPrefix}`;

  const chapters = await getJson(
    `${contentBase}/chapters?language=en`,
    clientId,
    contentToken,
  );
  const verse = await getJson(
    `${contentBase}/verses/by_key/1:1?language=en&words=false`,
    clientId,
    contentToken,
  );
  const translationsRaw = await getJson(
    `${contentBase}/resources/translations`,
    clientId,
    contentToken,
  );
  const tafsirsRaw = await getJson(
    `${contentBase}/resources/tafsirs`,
    clientId,
    contentToken,
  );
  const recitationsRaw = await getJson(
    `${contentBase}/resources/recitations`,
    clientId,
    contentToken,
  );
  const chapterRecitersRaw = await getJson(
    `${contentBase}/resources/chapter_reciters`,
    clientId,
    contentToken,
  );
  const search = await getJson(
    `${searchBase}/search?query=fatiha&mode=quick&size=5`,
    clientId,
    searchToken,
  );

  const translationsList =
    (translationsRaw as { translations?: Array<Record<string, unknown>> })
      ?.translations ?? (Array.isArray(translationsRaw) ? translationsRaw : []);
  const tafsirsList =
    (tafsirsRaw as { tafsirs?: Array<Record<string, unknown>> })?.tafsirs ??
    (Array.isArray(tafsirsRaw) ? tafsirsRaw : []);
  const recitationsList =
    (recitationsRaw as { recitations?: Array<Record<string, unknown>> })
      ?.recitations ?? (Array.isArray(recitationsRaw) ? recitationsRaw : []);
  const chapterRecitersList =
    (
      chapterRecitersRaw as {
        reciters?: Array<Record<string, unknown>>;
        chapter_reciters?: Array<Record<string, unknown>>;
      }
    )?.reciters ??
    (
      chapterRecitersRaw as {
        chapter_reciters?: Array<Record<string, unknown>>;
      }
    )?.chapter_reciters ??
    (Array.isArray(chapterRecitersRaw) ? chapterRecitersRaw : []);

  const languages = [
    'uzbek',
    'uz',
    'english',
    'en',
    'arabic',
    'ar',
    'russian',
    'ru',
  ];

  const output = {
    fetchedAt: new Date().toISOString(),
    env,
    samples: {
      chaptersFirst: Array.isArray(
        (chapters as { chapters?: unknown[] })?.chapters,
      )
        ? (chapters as { chapters: unknown[] }).chapters.slice(0, 2)
        : chapters,
      verseByKey_1_1: verse,
      searchFatiha: search,
    },
    curatedResources: {
      translations: pickResources(
        translationsList as Array<Record<string, unknown>>,
        languages,
        12,
      ),
      tafsirs: pickResources(
        tafsirsList as Array<Record<string, unknown>>,
        languages,
        12,
      ),
      recitations: pickResources(
        recitationsList as Array<Record<string, unknown>>,
        languages,
        12,
      ),
      chapterReciters: pickResources(
        chapterRecitersList as Array<Record<string, unknown>>,
        languages,
        12,
      ),
    },
    catalogCounts: {
      translations: translationsList.length,
      tafsirs: tafsirsList.length,
      recitations: recitationsList.length,
      chapterReciters: chapterRecitersList.length,
    },
  };

  const outPath = resolve(process.cwd(), 'docs/qf-discovery-samples.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(output.catalogCounts, null, 2));
  console.log(
    'Curated translation IDs:',
    output.curatedResources.translations.map((t) => t.id).join(', '),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
