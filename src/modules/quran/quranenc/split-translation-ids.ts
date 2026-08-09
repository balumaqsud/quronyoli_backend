import { isQuranEncTranslationKey } from './quranenc.constants';

export type SplitTranslationIds = {
  /** Comma-joined QF numeric resource ids (may be empty string). */
  qfTranslations: string;
  encKeys: string[];
};

/**
 * Split `translations=` CSV into QF numeric ids and allowlisted QuranEnc keys.
 * Unknown non-numeric tokens are dropped (not forwarded to QF).
 */
export function splitTranslationIds(
  translations: string | undefined,
): SplitTranslationIds {
  if (!translations?.trim()) {
    return { qfTranslations: '', encKeys: [] };
  }

  const qfIds: string[] = [];
  const encKeys: string[] = [];
  const seenEnc = new Set<string>();

  for (const part of translations.split(',')) {
    const token = part.trim();
    if (!token) {
      continue;
    }
    if (/^\d+$/.test(token)) {
      qfIds.push(token);
      continue;
    }
    if (isQuranEncTranslationKey(token) && !seenEnc.has(token)) {
      seenEnc.add(token);
      encKeys.push(token);
    }
  }

  return {
    qfTranslations: qfIds.join(','),
    encKeys,
  };
}
