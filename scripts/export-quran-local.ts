/**
 * One-time local Quran export (not wired into Nest / production).
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/export-quran-local.ts --all
 *   npx ts-node --transpile-only scripts/export-quran-local.ts --all --out ~/Desktop/QURAN_EXPORT
 *
 * Loads .env for QF_CLIENT_ID / QF_CLIENT_SECRET. Never logs secrets.
 */
import { config as loadEnv } from 'dotenv';
import {
  copyFile,
  mkdir,
  readdir,
  rename,
  stat,
  writeFile,
} from 'fs/promises';
import { homedir } from 'os';
import { dirname, extname, join, resolve } from 'path';

loadEnv({
  path: resolve(process.cwd(), '.env'),
  override: true,
  quiet: true,
});

type EnvName = 'prelive' | 'production';

const AUTH_BASE: Record<EnvName, string> = {
  prelive: 'https://prelive-oauth2.quran.foundation',
  production: 'https://oauth2.quran.foundation',
};

const API_BASE: Record<EnvName, string> = {
  prelive: 'https://apis-prelive.quran.foundation',
  production: 'https://apis.quran.foundation',
};

const UNICODE_SCRIPTS = [
  'uthmani',
  'uthmani_tajweed',
  'uthmani_simple',
  'imlaei',
  'indopak',
  'indopak_nastaleeq',
  'qpc_hafs',
] as const;

const GLYPH_SCRIPTS = ['code_v1', 'code_v2'] as const;

const DEFAULT_TAJWEED_PAGE_IMAGE_BASE =
  'https://www.noureddin.dev/quran-pages/2/pages/776x1053-webp';
const DEFAULT_TAJWEED_PAGE_IMAGE_EXT = 'webp';
const MUSHAF_PAGE_COUNT = 604;
const SURAH_COUNT = 114;

const LANGUAGE_DISPLAY: Record<string, string> = {
  english: 'English',
  arabic: 'Arabic',
  russian: 'Russian',
  uzbek: 'Uzbek',
  french: 'French',
  bengali: 'Bengali',
  turkish: 'Turkish',
  urdu: 'Urdu',
  indonesian: 'Indonesian',
  malay: 'Malay',
  persian: 'Persian',
  farsi: 'Persian',
  german: 'German',
  spanish: 'Spanish',
  portuguese: 'Portuguese',
  dutch: 'Dutch',
  italian: 'Italian',
  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  hindi: 'Hindi',
  swedish: 'Swedish',
  tamil: 'Tamil',
  albanian: 'Albanian',
  azeri: 'Azerbaijani',
  bosnian: 'Bosnian',
  czech: 'Czech',
  danish: 'Danish',
  finnish: 'Finnish',
  greek: 'Greek',
  hebrew: 'Hebrew',
  kurdish: 'Kurdish',
  norwegian: 'Norwegian',
  polish: 'Polish',
  romanian: 'Romanian',
  somali: 'Somali',
  swahili: 'Swahili',
  thai: 'Thai',
  vietnamese: 'Vietnamese',
  kazakh: 'Kazakh',
  tajik: 'Tajik',
  kyrgyz: 'Kyrgyz',
  turkmen: 'Turkmen',
  en: 'English',
  ar: 'Arabic',
  ru: 'Russian',
  uz: 'Uzbek',
  fr: 'French',
  bn: 'Bengali',
  tr: 'Turkish',
  ur: 'Urdu',
  id: 'Indonesian',
  ms: 'Malay',
  fa: 'Persian',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  nl: 'Dutch',
  it: 'Italian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  hi: 'Hindi',
  sv: 'Swedish',
  ta: 'Tamil',
  sq: 'Albanian',
  az: 'Azerbaijani',
  bs: 'Bosnian',
  cs: 'Czech',
  da: 'Danish',
  fi: 'Finnish',
  el: 'Greek',
  he: 'Hebrew',
  ku: 'Kurdish',
  no: 'Norwegian',
  pl: 'Polish',
  ro: 'Romanian',
  so: 'Somali',
  sw: 'Swahili',
  th: 'Thai',
  vi: 'Vietnamese',
  kk: 'Kazakh',
  tg: 'Tajik',
  ky: 'Kyrgyz',
  tk: 'Turkmen',
};

type Chapter = { id: number; name: string };

type TranslationResource = {
  id: string;
  name: string;
  authorName: string;
  languageName: string;
  languageFolder: string;
  translatorFolder: string;
  source: 'qf' | 'quranenc';
};

type ReciterResource = {
  id: number;
  name: string;
  style: string | null;
  folder: string;
};

type TokenState = {
  accessToken: string;
  fetchedAt: number;
};

function parseArgs(argv: string[]): { all: boolean; out: string } {
  const all = argv.includes('--all');
  let out = join(homedir(), 'Desktop', 'QURAN_EXPORT');
  const outIdx = argv.indexOf('--out');
  if (outIdx >= 0 && argv[outIdx + 1]) {
    out = resolve(argv[outIdx + 1].replace(/^~(?=\/|$)/, homedir()));
  }
  return { all, out };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required (set it in .env or the environment)`);
  }
  return value;
}

function resolveEnvName(): EnvName {
  const value = (
    process.env.QF_ENV ??
    process.env.QURAN_FOUNDATION_ENV ??
    'production'
  )
    .trim()
    .toLowerCase();
  if (value !== 'prelive' && value !== 'production') {
    throw new Error('QF_ENV must be prelive or production');
  }
  return value;
}

function resolveQuranFoundationUrls(environment: EnvName): {
  authBaseUrl: string;
  apiBaseUrl: string;
} {
  if (environment === 'prelive') {
    return {
      authBaseUrl:
        process.env.QF_AUTH_BASE_URL?.trim() ||
        AUTH_BASE.prelive,
      apiBaseUrl:
        process.env.QF_API_BASE_URL?.trim() || API_BASE.prelive,
    };
  }
  return {
    authBaseUrl:
      process.env.QF_AUTH_BASE_URL?.trim() || AUTH_BASE.production,
    apiBaseUrl:
      process.env.QF_API_BASE_URL?.trim() || API_BASE.production,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function sanitizeName(value: string): string {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[^\w\s.-]+/g, '')
    .replace(/[\s.]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned || 'Unknown';
}

function titleCaseLanguage(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (LANGUAGE_DISPLAY[key]) {
    return LANGUAGE_DISPLAY[key];
  }
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') || 'Undetermined';
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .trim();
}

function isRelativeMediaPath(url: string): boolean {
  if (!url || url.startsWith('http://') || url.startsWith('https://')) {
    return false;
  }
  if (url.startsWith('//') || url.startsWith('data:')) {
    return false;
  }
  return true;
}

function absolutizeMediaUrl(url: string, audioCdnBase: string): string {
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  if (isRelativeMediaPath(url)) {
    return `${audioCdnBase.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
  }
  return url;
}

async function fileExistsNonEmpty(path: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function poolMap<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const run = async (): Promise<void> => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) {
        return;
      }
      await worker(items[index], index);
    }
  };
  const width = Math.min(Math.max(1, limit), Math.max(1, items.length));
  await Promise.all(Array.from({ length: width }, () => run()));
}

class QfSession {
  private token: TokenState | null = null;

  constructor(
    readonly env: EnvName,
    readonly clientId: string,
    private readonly clientSecret: string,
    readonly contentBase: string,
    private readonly contentScope: string,
    private readonly authBaseUrl: string,
  ) {}

  async getAccessToken(force = false): Promise<string> {
    if (!force && this.token && Date.now() - this.token.fetchedAt < 50 * 60 * 1000) {
      return this.token.accessToken;
    }
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: this.contentScope,
    });
    const response = await fetch(`${this.authBaseUrl.replace(/\/+$/, '')}/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!response.ok) {
      let oauthError = '';
      try {
        const errBody = (await response.json()) as { error?: unknown };
        if (typeof errBody.error === 'string' && errBody.error.trim()) {
          oauthError = errBody.error.trim();
        }
      } catch {
        /* ignore non-JSON error bodies */
      }
      const hint =
        oauthError === 'invalid_client'
          ? ' Local QF_CLIENT_ID / QF_CLIENT_SECRET were rejected. Use the same values as the working production backend; do not rename the variables.'
          : '';
      throw new Error(
        `Quran Foundation token request failed (${response.status}${oauthError ? ` ${oauthError}` : ''}).${hint}`,
      );
    }
    const json = (await response.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new Error('Quran Foundation token response missing access_token');
    }
    this.token = { accessToken: json.access_token, fetchedAt: Date.now() };
    return json.access_token;
  }

  async getJson(path: string, query?: Record<string, string | number>): Promise<unknown> {
    const url = new URL(
      `${this.contentBase}${path.startsWith('/') ? path : `/${path}`}`,
    );
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, String(value));
      }
    }
    return this.requestJson(url.toString());
  }

  async requestJson(url: string, attempt = 0, unauthorizedRetried = false): Promise<unknown> {
    const token = await this.getAccessToken();
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'x-auth-token': token,
          'x-client-id': this.clientId,
          Accept: 'application/json',
        },
      });
    } catch (error) {
      return this.retryJson(url, attempt, unauthorizedRetried, error);
    }

    if (response.status === 401 && !unauthorizedRetried) {
      await this.getAccessToken(true);
      return this.requestJson(url, attempt, true);
    }

    if (response.status === 429 || response.status >= 500) {
      return this.retryJson(url, attempt, unauthorizedRetried, undefined, response);
    }

    if (!response.ok) {
      throw new Error(`QF GET ${url.replace(/\?.*/, '')} failed (${response.status})`);
    }

    return response.json() as Promise<unknown>;
  }

  private async retryJson(
    url: string,
    attempt: number,
    unauthorizedRetried: boolean,
    error?: unknown,
    response?: Response,
  ): Promise<unknown> {
    if (attempt >= 4) {
      const detail =
        error instanceof Error
          ? error.message
          : response
            ? `HTTP ${response.status}`
            : 'network error';
      throw new Error(`QF request failed after retries: ${detail}`);
    }
    const retryAfter = Number(response?.headers.get('retry-after') ?? '');
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(250 * 2 ** attempt + Math.floor(Math.random() * 250), 10_000);
    await sleep(delay);
    return this.requestJson(url, attempt + 1, unauthorizedRetried);
  }
}

async function fetchPublicJson(
  url: string,
  attempt = 0,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    if (attempt >= 4) {
      throw error instanceof Error ? error : new Error(String(error));
    }
    await sleep(Math.min(250 * 2 ** attempt, 8000));
    return fetchPublicJson(url, attempt + 1);
  }
  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 4) {
      throw new Error(`GET ${url} failed (${response.status})`);
    }
    const retryAfter = Number(response.headers.get('retry-after') ?? '');
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(250 * 2 ** attempt, 8000);
    await sleep(delay);
    return fetchPublicJson(url, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(`GET ${url} failed (${response.status})`);
  }
  return response.json() as Promise<unknown>;
}

async function downloadBinary(
  url: string,
  destPath: string,
  attempt = 0,
): Promise<'downloaded' | 'skipped'> {
  if (await fileExistsNonEmpty(destPath)) {
    return 'skipped';
  }
  await mkdir(dirname(destPath), { recursive: true });
  const partPath = `${destPath}.part`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    if (attempt >= 4) {
      throw error instanceof Error ? error : new Error(String(error));
    }
    await sleep(Math.min(400 * 2 ** attempt, 10_000));
    return downloadBinary(url, destPath, attempt + 1);
  }
  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 4) {
      throw new Error(`Download failed (${response.status}): ${url}`);
    }
    const retryAfter = Number(response.headers.get('retry-after') ?? '');
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(400 * 2 ** attempt, 10_000);
    await sleep(delay);
    return downloadBinary(url, destPath, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error(`Empty download: ${url}`);
  }
  await writeFile(partPath, buffer);
  await rename(partPath, destPath);
  return 'downloaded';
}

async function writeTextAtomic(destPath: string, body: string): Promise<'written' | 'skipped'> {
  if (await fileExistsNonEmpty(destPath)) {
    return 'skipped';
  }
  await mkdir(dirname(destPath), { recursive: true });
  const partPath = `${destPath}.part`;
  await writeFile(partPath, body, 'utf8');
  await rename(partPath, destPath);
  return 'written';
}

function extractList(payload: unknown, keys: string[]): unknown[] {
  const rec = asRecord(payload);
  if (!rec) {
    return Array.isArray(payload) ? payload : [];
  }
  for (const key of keys) {
    const value = rec[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function extractId(raw: Record<string, unknown>): string | null {
  const id = raw.id;
  if (typeof id === 'number' && Number.isFinite(id)) {
    return String(id);
  }
  if (typeof id === 'string' && id.trim() !== '') {
    return id.trim();
  }
  return null;
}

function nestedName(raw: Record<string, unknown>): string | null {
  const nested = asRecord(raw.name);
  const translated = asRecord(raw.translated_name) ?? asRecord(raw.translatedName);
  return (
    asString(raw.reciter_name) ??
    asString(raw.reciterName) ??
    asString(raw.name) ??
    asString(nested?.name) ??
    asString(translated?.name)
  );
}

function parseChapters(payload: unknown): Chapter[] {
  const list = extractList(payload, ['chapters']);
  const chapters: Chapter[] = [];
  for (const item of list) {
    const rec = asRecord(item);
    if (!rec) continue;
    const id = Number(rec.id);
    if (!Number.isInteger(id) || id < 1) continue;
    const name =
      asString(rec.name_simple) ??
      asString(rec.name_english) ??
      asString(asRecord(rec.translated_name)?.name) ??
      `Surah_${id}`;
    chapters.push({ id, name });
  }
  chapters.sort((a, b) => a.id - b.id);
  return chapters;
}

function surahFileStem(chapter: Chapter): string {
  return `${pad3(chapter.id)}_${sanitizeName(chapter.name)}`;
}

function parseTranslations(payload: unknown): TranslationResource[] {
  const list = extractList(payload, ['translations']);
  const out: TranslationResource[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const rec = asRecord(item);
    if (!rec) continue;
    const id = extractId(rec);
    const name = asString(rec.name);
    if (!id || !name) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const author =
      asString(rec.author_name) ?? asString(rec.authorName) ?? name;
    const languageName =
      asString(rec.language_name) ?? asString(rec.languageName) ?? 'und';
    const languageFolder = sanitizeName(titleCaseLanguage(languageName));
    const translatorFolder = sanitizeName(author);
    out.push({
      id,
      name,
      authorName: author,
      languageName,
      languageFolder,
      translatorFolder,
      source: 'qf',
    });
  }
  return out;
}

function parseChapterReciters(payload: unknown): ReciterResource[] {
  const list = extractList(payload, ['reciters', 'chapter_reciters']);
  const out: ReciterResource[] = [];
  const usedFolders = new Set<string>();
  for (const item of list) {
    const rec = asRecord(item);
    if (!rec) continue;
    const id = Number(extractId(rec));
    const name = nestedName(rec);
    if (!Number.isInteger(id) || !name) continue;
    const styleRaw = rec.style;
    const style =
      typeof styleRaw === 'string'
        ? asString(styleRaw)
        : asString(asRecord(styleRaw)?.name);
    let folder = sanitizeName(style ? `${name}_${style}` : name);
    if (usedFolders.has(folder)) {
      folder = sanitizeName(`${folder}_${id}`);
    }
    usedFolders.add(folder);
    out.push({ id, name, style, folder });
  }
  return out;
}

function verseTextFromRow(row: Record<string, unknown>, script?: string): string {
  const keys = [
    script ? `text_${script}` : '',
    'text',
    'text_uthmani',
    'text_uthmani_tajweed',
    'text_uthmani_simple',
    'text_imlaei',
    'text_indopak',
    'text_indopak_nastaleeq',
    'text_qpc_hafs',
  ].filter(Boolean);
  for (const key of keys) {
    const value = asString(row[key]);
    if (value) {
      return stripHtml(value);
    }
  }
  return '';
}

function paginationMeta(payload: unknown): { nextPage: number | null } {
  const rec = asRecord(payload);
  const pagination = asRecord(rec?.pagination);
  if (!pagination) {
    return { nextPage: null };
  }
  const next = pagination.next_page ?? pagination.nextPage;
  if (typeof next === 'number' && Number.isInteger(next) && next > 0) {
    return { nextPage: next };
  }
  const current = Number(pagination.current_page ?? pagination.currentPage ?? 1);
  const total = Number(pagination.total_pages ?? pagination.totalPages ?? 1);
  if (Number.isFinite(current) && Number.isFinite(total) && current < total) {
    return { nextPage: current + 1 };
  }
  return { nextPage: null };
}

async function collectPagedRows(
  session: QfSession,
  path: string,
  listKeys: string[],
  extraQuery?: Record<string, string | number>,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let page = 1;
  for (;;) {
    const payload = await session.getJson(path, {
      page,
      per_page: 300,
      ...extraQuery,
    });
    const list = extractList(payload, listKeys);
    for (const item of list) {
      const rec = asRecord(item);
      if (rec) {
        rows.push(rec);
      }
    }
    const { nextPage } = paginationMeta(payload);
    if (!nextPage || list.length === 0) {
      break;
    }
    page = nextPage;
  }
  return rows;
}

function formatTranslationTxt(opts: {
  surahName: string;
  surahNumber: number;
  translator: string;
  language: string;
  verses: Array<{ n: number; text: string }>;
}): string {
  const lines = [
    `SURAH: ${opts.surahName}`,
    `SURAH NUMBER: ${opts.surahNumber}`,
    `TRANSLATOR: ${opts.translator}`,
    `LANGUAGE: ${opts.language}`,
    '',
  ];
  for (const verse of opts.verses) {
    lines.push(`${verse.n}. ${verse.text}`);
  }
  lines.push('');
  return lines.join('\n');
}

function formatArabicTxt(opts: {
  surahName: string;
  surahNumber: number;
  script: string;
  verses: Array<{ n: number; text: string }>;
}): string {
  const lines = [
    `SURAH: ${opts.surahName}`,
    `SURAH NUMBER: ${opts.surahNumber}`,
    `SCRIPT: ${opts.script}`,
    '',
  ];
  for (const verse of opts.verses) {
    lines.push(`${verse.n}. ${verse.text}`);
  }
  lines.push('');
  return lines.join('\n');
}

function verseNumber(row: Record<string, unknown>): number | null {
  const n = Number(row.verse_number ?? row.verseNumber ?? row.aya);
  if (Number.isInteger(n) && n > 0) {
    return n;
  }
  const key = asString(row.verse_key ?? row.verseKey);
  const match = key?.match(/:(\d+)$/);
  if (match) {
    return Number(match[1]);
  }
  return null;
}

/** QF `/translations/{id}/by_chapter/{n}` rows are `{ id, resource_id, text }` with no verse_key. */
function versesFromTranslationRows(
  rows: Record<string, unknown>[],
): Array<{ n: number; text: string }> {
  const verses: Array<{ n: number; text: string }> = [];
  for (const [index, row] of rows.entries()) {
    const text = verseTextFromRow(row);
    if (!text) {
      continue;
    }
    verses.push({ n: verseNumber(row) ?? index + 1, text });
  }
  return verses.sort((a, b) => a.n - b.n);
}

async function runStep(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${name} failed: ${message}`);
  }
}

async function exportQuranScripts(
  session: QfSession,
  outDir: string,
  chapters: Chapter[],
): Promise<void> {
  const jsonLimit = 4;
  for (const [scriptIndex, script] of UNICODE_SCRIPTS.entries()) {
    console.log(
      `Arabic scripts ${scriptIndex + 1}/${UNICODE_SCRIPTS.length}: ${script}`,
    );
    await poolMap(chapters, jsonLimit, async (chapter) => {
      const dest = join(
        outDir,
        'QURAN',
        script,
        `${surahFileStem(chapter)}.txt`,
      );
      if (await fileExistsNonEmpty(dest)) {
        return;
      }
      const rows = await collectPagedRows(
        session,
        `/quran/verses/${script}`,
        ['verses'],
        { chapter_number: chapter.id },
      );
      const verses = rows
        .map((row) => {
          const n = verseNumber(row);
          const text = verseTextFromRow(row, script);
          return n && text ? { n, text } : null;
        })
        .filter((v): v is { n: number; text: string } => v !== null)
        .sort((a, b) => a.n - b.n);
      if (verses.length === 0) {
        throw new Error(`No Arabic verses for ${script} surah ${chapter.id}`);
      }
      await writeTextAtomic(
        dest,
        formatArabicTxt({
          surahName: chapter.name,
          surahNumber: chapter.id,
          script,
          verses,
        }),
      );
      process.stdout.write(
        `\r  ${script} surah ${chapter.id}/${SURAH_COUNT}   `,
      );
    });
    process.stdout.write('\n');
  }
}

async function exportTranslations(
  session: QfSession,
  outDir: string,
  chapters: Chapter[],
  translations: TranslationResource[],
  quranEncBase: string,
): Promise<void> {
  const jsonLimit = 4;
  for (const [tIndex, translation] of translations.entries()) {
    console.log(
      `Translations ${tIndex + 1}/${translations.length}: ${translation.languageFolder} / ${translation.translatorFolder}`,
    );
    await poolMap(chapters, jsonLimit, async (chapter) => {
      const dest = join(
        outDir,
        'TRANSLATIONS',
        translation.languageFolder,
        translation.translatorFolder,
        `${surahFileStem(chapter)}.txt`,
      );
      if (await fileExistsNonEmpty(dest)) {
        return;
      }
      let verses: Array<{ n: number; text: string }> = [];
      if (translation.source === 'quranenc') {
        const payload = await fetchPublicJson(
          `${quranEncBase.replace(/\/$/, '')}/translation/sura/${translation.id}/${chapter.id}`,
        );
        const rec = asRecord(payload);
        const list = Array.isArray(rec?.result) ? rec.result : [];
        verses = list
          .map((item) => {
            const row = asRecord(item);
            if (!row) return null;
            const n = Number(row.aya);
            const text = asString(row.translation);
            return Number.isInteger(n) && text
              ? { n, text: stripHtml(text) }
              : null;
          })
          .filter((v): v is { n: number; text: string } => v !== null)
          .sort((a, b) => a.n - b.n);
      } else {
        const rows = await collectPagedRows(
          session,
          `/translations/${translation.id}/by_chapter/${chapter.id}`,
          ['translations', 'verses'],
        );
        verses = versesFromTranslationRows(rows);
      }
      if (verses.length === 0) {
        console.warn(
          `  skip empty translation ${translation.id} surah ${chapter.id}`,
        );
        return;
      }
      await writeTextAtomic(
        dest,
        formatTranslationTxt({
          surahName: chapter.name,
          surahNumber: chapter.id,
          translator: translation.authorName,
          language: titleCaseLanguage(translation.languageName),
          verses,
        }),
      );
      process.stdout.write(
        `\r  surah ${chapter.id}/${SURAH_COUNT}   `,
      );
    });
    process.stdout.write('\n');
  }
}

function pickAudioUrl(
  row: Record<string, unknown>,
  audioCdnBase: string,
): string | null {
  const raw =
    asString(row.audio_url) ??
    asString(row.audioUrl) ??
    asString(row.url);
  return raw ? absolutizeMediaUrl(raw, audioCdnBase) : null;
}

function chapterIdFromAudio(row: Record<string, unknown>): number | null {
  const n = Number(row.chapter_id ?? row.chapterId ?? row.chapter_number);
  return Number.isInteger(n) && n >= 1 && n <= SURAH_COUNT ? n : null;
}

function extensionFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const ext = extname(path).replace(/^\./, '').toLowerCase();
    if (ext) {
      return ext;
    }
  } catch {
    /* ignore */
  }
  return 'mp3';
}

async function exportAudio(
  session: QfSession,
  outDir: string,
  chapters: Chapter[],
  reciters: ReciterResource[],
  audioCdnBase: string,
): Promise<void> {
  const chapterById = new Map(chapters.map((c) => [c.id, c]));
  const binaryLimit = 3;
  for (const [rIndex, reciter] of reciters.entries()) {
    console.log(
      `Audio reciters ${rIndex + 1}/${reciters.length}: ${reciter.folder}`,
    );
    const payload = await session.getJson(`/chapter_recitations/${reciter.id}`);
    const rec = asRecord(payload);
    const files = extractList(payload, ['audio_files', 'audioFiles']);
    const nested = asRecord(rec?.audio_file);
    const rows = files.length > 0 ? files : nested ? [nested] : [];
    const jobs: Array<{ chapter: Chapter; url: string; dest: string }> = [];
    for (const item of rows) {
      const row = asRecord(item);
      if (!row) continue;
      const chapterId = chapterIdFromAudio(row);
      const url = pickAudioUrl(row, audioCdnBase);
      if (!chapterId || !url) continue;
      const chapter = chapterById.get(chapterId);
      if (!chapter) continue;
      const ext = extensionFromUrl(url);
      jobs.push({
        chapter,
        url,
        dest: join(
          outDir,
          'AUDIO',
          reciter.folder,
          `${surahFileStem(chapter)}.${ext}`,
        ),
      });
    }
    if (jobs.length < SURAH_COUNT) {
      const have = new Set(jobs.map((j) => j.chapter.id));
      for (const chapter of chapters) {
        if (have.has(chapter.id)) continue;
        jobs.push({
          chapter,
          url: '',
          dest: '',
        });
      }
    }
    await poolMap(jobs, binaryLimit, async (job) => {
      let url = job.url;
      let dest = job.dest;
      if (!url) {
        const one = await session.getJson(
          `/chapter_recitations/${reciter.id}/${job.chapter.id}`,
        );
        const body = asRecord(one);
        const file =
          asRecord(body?.audio_file) ??
          asRecord(extractList(one, ['audio_files'])[0]);
        if (!file) {
          throw new Error(
            `Missing audio for reciter ${reciter.id} surah ${job.chapter.id}`,
          );
        }
        const found = pickAudioUrl(file, audioCdnBase);
        if (!found) {
          throw new Error(
            `Missing audio URL for reciter ${reciter.id} surah ${job.chapter.id}`,
          );
        }
        url = found;
        dest = join(
          outDir,
          'AUDIO',
          reciter.folder,
          `${surahFileStem(job.chapter)}.${extensionFromUrl(url)}`,
        );
      }
      await downloadBinary(url, dest);
      process.stdout.write(
        `\r  surah ${job.chapter.id}/${SURAH_COUNT}   `,
      );
    });
    process.stdout.write('\n');
  }
}

async function copyLocalMushaf1405(
  srcDir: string,
  destDir: string,
): Promise<number> {
  let copied = 0;
  let entries: string[] = [];
  try {
    entries = await readdir(srcDir);
  } catch {
    return 0;
  }
  await mkdir(destDir, { recursive: true });
  for (const name of entries) {
    const match = name.match(/^(\d+)\.(webp|png|jpe?g)$/i);
    if (!match) continue;
    const page = Number(match[1]);
    if (!Number.isInteger(page) || page < 1 || page > MUSHAF_PAGE_COUNT) {
      continue;
    }
    const dest = join(destDir, `${pad3(page)}.${match[2].toLowerCase()}`);
    if (await fileExistsNonEmpty(dest)) {
      copied += 1;
      continue;
    }
    await copyFile(join(srcDir, name), dest);
    copied += 1;
  }
  return copied;
}

async function exportMushafs(outDir: string): Promise<{
  tajweed: number;
  madina1405: number;
  madina1405Source: string;
}> {
  const tajweedBase = (
    process.env.QF_TAJWEED_PAGE_IMAGE_BASE ?? DEFAULT_TAJWEED_PAGE_IMAGE_BASE
  ).replace(/\/+$/, '');
  const tajweedExt = (
    process.env.QF_TAJWEED_PAGE_IMAGE_EXT ?? DEFAULT_TAJWEED_PAGE_IMAGE_EXT
  ).replace(/^\./, '');
  const tajweedDir = join(outDir, 'MUSHAFS', 'Uthmani_Tajweed_Images_10');
  console.log(`Mushaf 10: Uthmani Tajweed Images (${MUSHAF_PAGE_COUNT} pages)`);
  const pages = Array.from({ length: MUSHAF_PAGE_COUNT }, (_, i) => i + 1);
  await poolMap(pages, 3, async (page) => {
    const dest = join(tajweedDir, `${pad3(page)}.${tajweedExt}`);
    const url = `${tajweedBase}/${page}.${tajweedExt}`;
    await downloadBinary(url, dest);
    if (page % 20 === 0 || page === MUSHAF_PAGE_COUNT) {
      process.stdout.write(`\r  page ${page}/${MUSHAF_PAGE_COUNT}   `);
    }
  });
  process.stdout.write('\n');

  const madinaDir = join(outDir, 'MUSHAFS', 'Madina_1405');
  const uploadsDir = resolve(
    process.cwd(),
    process.env.UPLOADS_DIR ?? 'uploads',
    'mushaf',
    '1405',
  );
  const copied = await copyLocalMushaf1405(uploadsDir, madinaDir);
  if (copied >= MUSHAF_PAGE_COUNT) {
    console.log(`Mushaf 1405: copied/resumed ${copied} pages from ${uploadsDir}`);
    return {
      tajweed: MUSHAF_PAGE_COUNT,
      madina1405: copied,
      madina1405Source: `local ${uploadsDir}`,
    };
  }

  const explicit = (process.env.QF_MUSHAF_1405_IMAGE_BASE ?? '').trim();
  const origin = (process.env.PUBLIC_API_ORIGIN ?? '').trim().replace(/\/+$/, '');
  const remoteBase = (explicit || (origin ? `${origin}/uploads/mushaf/1405` : ''))
    .replace(/\/+$/, '');
  const madinaExt = (
    process.env.QF_MUSHAF_1405_IMAGE_EXT ?? 'webp'
  ).replace(/^\./, '');

  if (!remoteBase) {
    console.log(
      'Mushaf 1405: skipped (no local uploads/mushaf/1405 files and no QF_MUSHAF_1405_IMAGE_BASE / PUBLIC_API_ORIGIN)',
    );
    return {
      tajweed: MUSHAF_PAGE_COUNT,
      madina1405: copied,
      madina1405Source: 'unavailable',
    };
  }

  console.log(`Mushaf 1405: downloading remaining pages from configured base`);
  await poolMap(pages, 3, async (page) => {
    const dest = join(madinaDir, `${pad3(page)}.${madinaExt}`);
    const url = `${remoteBase}/${page}.${madinaExt}`;
    await downloadBinary(url, dest);
    if (page % 20 === 0 || page === MUSHAF_PAGE_COUNT) {
      process.stdout.write(`\r  page ${page}/${MUSHAF_PAGE_COUNT}   `);
    }
  });
  process.stdout.write('\n');
  return {
    tajweed: MUSHAF_PAGE_COUNT,
    madina1405: MUSHAF_PAGE_COUNT,
    madina1405Source: remoteBase,
  };
}

async function writeReadme(opts: {
  outDir: string;
  contentBase: string;
  env: EnvName;
  chapters: Chapter[];
  translations: TranslationResource[];
  reciters: ReciterResource[];
  mushaf: { tajweed: number; madina1405: number; madina1405Source: string };
}): Promise<void> {
  const languages = [...new Set(opts.translations.map((t) => titleCaseLanguage(t.languageName)))].sort();
  const translators = opts.translations.map(
    (t) => `${titleCaseLanguage(t.languageName)} — ${t.authorName} (${t.source}:${t.id})`,
  );
  const reciters = opts.reciters.map((r) =>
    r.style ? `${r.name} (${r.style}) [id ${r.id}]` : `${r.name} [id ${r.id}]`,
  );
  const lines = [
    'Quron Yo\'li local Quran export',
    '',
    `Export date: ${new Date().toISOString()}`,
    `Quran Foundation environment: ${opts.env}`,
    `Content API: ${opts.contentBase}`,
    'QuranEnc: https://quranenc.com/api/v1 (kyrgyz_hakimov)',
    'Audio CDN: relative paths resolved with QF_AUDIO_CDN_BASE (default https://audio.qurancdn.com)',
    '',
    `Surahs: ${opts.chapters.length}`,
    '',
    'Languages:',
    ...languages.map((l) => `- ${l}`),
    '',
    'Translators:',
    ...translators.map((t) => `- ${t}`),
    '',
    'Reciters (chapter audio):',
    ...reciters.map((r) => `- ${r}`),
    '',
    'Arabic scripts (TXT under QURAN/):',
    ...UNICODE_SCRIPTS.map((s) => `- ${s}`),
    '',
    'Glyph mushafs (not exported as TXT; require QCF fonts):',
    ...GLYPH_SCRIPTS.map((s) => `- ${s}`),
    '- QCF V1 (mushaf id 2), QCF V2 (id 1), QCF V4 Tajweed (id 19)',
    '',
    'Image mushafs:',
    `- Uthmani Tajweed Images (id 10): ${opts.mushaf.tajweed} pages (WebP CDN)`,
    `- Hafs classic Medina 1405 AH (id 1405): ${opts.mushaf.madina1405} pages (${opts.mushaf.madina1405Source})`,
    '',
    'Unicode mushaf text editions are under QURAN/ (uthmani, indopak, qpc_hafs, etc.).',
    '',
  ];
  await writeFile(join(opts.outDir, 'README.txt'), lines.join('\n'), 'utf8');
}

async function main(): Promise<void> {
  const { all, out } = parseArgs(process.argv.slice(2));
  if (!all) {
    throw new Error(
      'Refusing to run without --all. Example: npx ts-node --transpile-only scripts/export-quran-local.ts --all',
    );
  }

  const clientId = requireEnv('QF_CLIENT_ID');
  const clientSecret = requireEnv('QF_CLIENT_SECRET');
  const env = resolveEnvName();
  const { authBaseUrl, apiBaseUrl } = resolveQuranFoundationUrls(env);
  const contentPrefix = process.env.QF_CONTENT_PATH_PREFIX ?? '/content/api/v4';
  const contentScope = process.env.QF_CONTENT_SCOPE ?? 'content';
  const contentBase = `${apiBaseUrl.replace(/\/+$/, '')}${contentPrefix}`;
  const audioCdnBase = (
    process.env.QF_AUDIO_CDN_BASE ?? 'https://audio.qurancdn.com'
  ).replace(/\/+$/, '');
  const quranEncBase =
    process.env.QURANENC_API_BASE_URL ?? 'https://quranenc.com/api/v1';

  const session = new QfSession(
    env,
    clientId,
    clientSecret,
    contentBase,
    contentScope,
    authBaseUrl,
  );

  await mkdir(out, { recursive: true });
  await mkdir(join(out, 'MUSHAFS'), { recursive: true });
  await mkdir(join(out, 'QURAN'), { recursive: true });
  await mkdir(join(out, 'AUDIO'), { recursive: true });
  await mkdir(join(out, 'TRANSLATIONS'), { recursive: true });

  console.log(`Output: ${out}`);
  console.log('Fetching catalogs from Quran Foundation…');

  const chapters = parseChapters(
    await session.getJson('/chapters', { language: 'en' }),
  );
  if (chapters.length !== SURAH_COUNT) {
    throw new Error(`Expected ${SURAH_COUNT} chapters, got ${chapters.length}`);
  }

  const translations = parseTranslations(
    await session.getJson('/resources/translations'),
  );
  translations.push({
    id: 'kyrgyz_hakimov',
    name: 'Kyrgyz — Shamsuddin Hakimov',
    authorName: 'Shamsuddin Hakimov',
    languageName: 'Kyrgyz',
    languageFolder: 'Kyrgyz',
    translatorFolder: 'Shamsuddin_Hakimov',
    source: 'quranenc',
  });

  const reciters = parseChapterReciters(
    await session.getJson('/resources/chapter_reciters'),
  );
  if (reciters.length === 0) {
    throw new Error('No chapter reciters returned by /resources/chapter_reciters');
  }
  if (translations.length <= 1) {
    throw new Error('No QF translations returned by /resources/translations');
  }

  console.log(
    `Discovered ${translations.length} translations, ${reciters.length} chapter reciters, ${UNICODE_SCRIPTS.length} Arabic scripts.`,
  );

  await exportQuranScripts(session, out, chapters);
  await runStep('translations', () =>
    exportTranslations(session, out, chapters, translations, quranEncBase),
  );
  await runStep('audio', () =>
    exportAudio(session, out, chapters, reciters, audioCdnBase),
  );
  let mushaf = {
    tajweed: 0,
    madina1405: 0,
    madina1405Source: 'unavailable',
  };
  await runStep('mushafs', async () => {
    mushaf = await exportMushafs(out);
  });

  await writeReadme({
    outDir: out,
    contentBase,
    env,
    chapters,
    translations,
    reciters,
    mushaf,
  });

  console.log(`Done. Export is at ${out}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
