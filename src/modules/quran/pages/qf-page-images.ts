/**
 * Full-page Dar al-Marefa / Uthmani Tajweed Images (QF mushaf id 10).
 * Verse-level QF `image_url` values are ayah strips (~675×52), NOT page scans.
 */

/** QDC / QF id for Uthmani Tajweed Images (Dar al-Marefa print). */
export const UTHMANI_TAJWEED_IMAGES_MUSHAF_ID = 10;

/**
 * Public WebP CDN for Dar-ul-Ma‘refa pages (776×1053).
 * @see https://www.noureddin.dev/quran-pages/2/
 */
export const DEFAULT_TAJWEED_PAGE_IMAGE_BASE =
  'https://www.noureddin.dev/quran-pages/2/pages/776x1053-webp';

export const DEFAULT_TAJWEED_PAGE_IMAGE_EXT = 'webp';

/** Intrinsic width of the default WebP page art. */
export const TAJWEED_PAGE_IMAGE_WIDTH = 776;

export type TajweedPageImageConfig = {
  baseUrl: string;
  extension: string;
};

export function isImageMushafId(mushafId: number): boolean {
  return mushafId === UTHMANI_TAJWEED_IMAGES_MUSHAF_ID;
}

/**
 * Build absolute HTTPS URL for a full mushaf page image.
 * Page numbers are not zero-padded (`1.webp` … `604.webp`).
 */
export function buildTajweedPageImageUrl(
  pageNumber: number,
  config: TajweedPageImageConfig = {
    baseUrl: DEFAULT_TAJWEED_PAGE_IMAGE_BASE,
    extension: DEFAULT_TAJWEED_PAGE_IMAGE_EXT,
  },
): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  const ext = config.extension.replace(/^\./, '');
  return `${base}/${pageNumber}.${ext}`;
}

/**
 * Verse-strip CDNs (e.g. rackcdn `91_1.png`) must never be served as page art.
 */
export function isLikelyVerseStripImageUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('rackcdn.com')) return true;
  // QF ayah crops: /{chapter}_{verse}.png
  if (/\/\d+_\d+\.(png|jpe?g|webp)(\?|$)/i.test(lower)) return true;
  return false;
}
