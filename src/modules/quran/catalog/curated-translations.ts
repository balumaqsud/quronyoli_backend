/**
 * QF translation resource IDs that ship as product defaults in the Mini App.
 * Must stay aligned with frontend `PREFERRED_TRANSLATIONS` in settings-store.
 * These are created `isActive: true` on catalog sync; admin toggles are preserved on update.
 */
export const CURATED_TRANSLATION_EXTERNAL_IDS = [
  '55', // uz — MSM Yusuf
  '20', // en — Saheeh International
  '45', // ru — Kuliev
  '77', // tr — Diyanet
  '31', // fr — Hamidullah
  '27', // de — Bubenheim & Nadeem
  '33', // id — Ministry
  '54', // ur — Junagarhi
  '83', // es — Isa Garcia
  '56', // zh — Ma Jian
  '161', // bn — Taisirul Quran
  '135', // fa — IslamHouse
  '222', // kk — Khalifa Altay
  '113', // kk — Khalifah Altai
  '139', // tg — Khawaja Mirof
  '223', // tg — Pioneers of Translation Center
  '74', // tg — AbdolMohammad Ayati
  '75', // az — Musayev
] as const;

export const CURATED_TRANSLATION_EXTERNAL_ID_SET = new Set<string>(
  CURATED_TRANSLATION_EXTERNAL_IDS,
);

export function isCuratedTranslationExternalId(externalId: string): boolean {
  return CURATED_TRANSLATION_EXTERNAL_ID_SET.has(externalId);
}
