/**
 * QuranEnc translation keys explicitly allowed by this backend.
 * Do not accept arbitrary user-supplied keys in URL construction.
 */
export const QURANENC_KYRGYZ_HAKIMOV_KEY = 'kyrgyz_hakimov';

export const QURANENC_ALLOWED_TRANSLATION_KEYS = [
  QURANENC_KYRGYZ_HAKIMOV_KEY,
] as const;

export type QuranEncTranslationKey =
  (typeof QURANENC_ALLOWED_TRANSLATION_KEYS)[number];

export const QURANENC_KYRGYZ_HAKIMOV_META = {
  key: QURANENC_KYRGYZ_HAKIMOV_KEY,
  languageCode: 'ky',
  languageName: 'Kyrgyz',
  translator: 'Shamsuddin Hakimov',
  name: 'Kyrgyz — Shamsuddin Hakimov',
  attribution:
    'Kyrgyz translation by Shamsuddin Hakimov. Source: QuranEnc / Encyclopedia of the Noble Quran',
  browseUrl: 'https://quranenc.com/en/browse/kyrgyz_hakimov',
} as const;

export function isQuranEncTranslationKey(
  value: string,
): value is QuranEncTranslationKey {
  return (QURANENC_ALLOWED_TRANSLATION_KEYS as readonly string[]).includes(
    value,
  );
}
