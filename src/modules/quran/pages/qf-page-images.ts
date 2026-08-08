/**
 * Full-page mushaf image editions (not verse-level QF ayah strips ~675×52).
 *
 * - Mushaf 10: Dar al-Marefa / Uthmani Tajweed Images (external CDN).
 * - Mushaf 1405: Classic Medina 1405 AH (optional self-hosted base).
 */

/** QDC / QF id for Uthmani Tajweed Images (Dar al-Marefa print). */
export const UTHMANI_TAJWEED_IMAGES_MUSHAF_ID = 10;

/** Classic King Fahd Madani print (1405 AH) — local image edition id. */
export const CLASSIC_MADINA_1405_MUSHAF_ID = 1405;

/**
 * Public WebP CDN for Dar-ul-Ma‘refa pages (776×1053).
 * @see https://www.noureddin.dev/quran-pages/2/
 */
export const DEFAULT_TAJWEED_PAGE_IMAGE_BASE =
  'https://www.noureddin.dev/quran-pages/2/pages/776x1053-webp';

export const DEFAULT_TAJWEED_PAGE_IMAGE_EXT = 'webp';

/** Intrinsic width of the default WebP page art (mushaf 10). */
export const TAJWEED_PAGE_IMAGE_WIDTH = 776;

/** Default declared width for classic 1405 pages when a base URL is configured. */
export const CLASSIC_MADINA_1405_IMAGE_WIDTH = 1024;

export type PageImageUrlConfig = {
  baseUrl: string;
  extension: string;
  width?: number;
};

/** @deprecated Prefer PageImageUrlConfig — kept for call-site compatibility. */
export type TajweedPageImageConfig = PageImageUrlConfig;

export type ImageMushafRegistryEntry = {
  id: number;
  /** When true, page breaks differ from mushaf 1 — do not clone layout. */
  needsOwnLayoutSync: boolean;
  defaultWidth: number;
  defaultExtension: string;
};

export const IMAGE_MUSHAF_REGISTRY: Readonly<
  Record<number, ImageMushafRegistryEntry>
> = {
  [UTHMANI_TAJWEED_IMAGES_MUSHAF_ID]: {
    id: UTHMANI_TAJWEED_IMAGES_MUSHAF_ID,
    needsOwnLayoutSync: true,
    defaultWidth: TAJWEED_PAGE_IMAGE_WIDTH,
    defaultExtension: DEFAULT_TAJWEED_PAGE_IMAGE_EXT,
  },
  [CLASSIC_MADINA_1405_MUSHAF_ID]: {
    id: CLASSIC_MADINA_1405_MUSHAF_ID,
    needsOwnLayoutSync: false,
    defaultWidth: CLASSIC_MADINA_1405_IMAGE_WIDTH,
    defaultExtension: DEFAULT_TAJWEED_PAGE_IMAGE_EXT,
  },
};

/** Per-mushaf page image CDN/base overrides from app config. */
export type PageImageSourcesConfig = {
  bases: Partial<Record<number, PageImageUrlConfig>>;
};

export function getImageMushafEntry(
  mushafId: number,
): ImageMushafRegistryEntry | undefined {
  return IMAGE_MUSHAF_REGISTRY[mushafId];
}

export function isImageMushafId(mushafId: number): boolean {
  return getImageMushafEntry(mushafId) !== undefined;
}

export function mushafNeedsOwnLayoutSync(mushafId: number): boolean {
  return getImageMushafEntry(mushafId)?.needsOwnLayoutSync === true;
}

/**
 * Build absolute page image URL.
 * Page numbers are not zero-padded (`1.webp` … `604.webp`).
 */
export function buildPageImageUrl(
  pageNumber: number,
  config: PageImageUrlConfig = {
    baseUrl: DEFAULT_TAJWEED_PAGE_IMAGE_BASE,
    extension: DEFAULT_TAJWEED_PAGE_IMAGE_EXT,
  },
): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  const ext = config.extension.replace(/^\./, '');
  return `${base}/${pageNumber}.${ext}`;
}

/** @deprecated Prefer buildPageImageUrl — same behavior for mushaf 10 defaults. */
export function buildTajweedPageImageUrl(
  pageNumber: number,
  config?: PageImageUrlConfig,
): string {
  return buildPageImageUrl(pageNumber, config);
}

/**
 * Resolve image URL config for a mushaf id.
 * Mushaf 10 falls back to Dar al-Marefa defaults when sources omit it.
 * Mushaf 1405 returns undefined when base is missing/empty (no imageUrl).
 */
export function resolvePageImageUrlConfig(
  mushafId: number,
  sources?: PageImageSourcesConfig,
): PageImageUrlConfig | undefined {
  const entry = getImageMushafEntry(mushafId);
  if (!entry) {
    return undefined;
  }

  const fromSources = sources?.bases[mushafId];
  if (fromSources) {
    const baseUrl = fromSources.baseUrl.trim();
    if (!baseUrl) {
      return undefined;
    }
    return {
      baseUrl,
      extension: fromSources.extension || entry.defaultExtension,
      width: fromSources.width ?? entry.defaultWidth,
    };
  }

  if (mushafId === UTHMANI_TAJWEED_IMAGES_MUSHAF_ID) {
    return {
      baseUrl: DEFAULT_TAJWEED_PAGE_IMAGE_BASE,
      extension: DEFAULT_TAJWEED_PAGE_IMAGE_EXT,
      width: TAJWEED_PAGE_IMAGE_WIDTH,
    };
  }

  return undefined;
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
