/** Madani Mushaf page count (standard 604-page Mushaf). */
export const MADANI_MUSHAF_PAGE_COUNT = 604;

/** Canonical Madani verse count (every verse on exactly one page). */
export const MADANI_MUSHAF_VERSE_COUNT = 6236;

/** Recommended Madani mushaf ID (QCF V2). */
export const DEFAULT_MUSHAF_ID = 1;

/** Fields requested during page metadata sync (coordinates + optional verse images). */
export const MUSHAF_PAGE_SYNC_FIELDS =
  'verse_key,juz_number,hizb_number,rub_el_hizb_number,page_number,image_url,image_width';

/** Default verse fields merged into GET /pages/:page/verses when client omits extras. */
export const DEFAULT_PAGE_VERSE_FIELDS =
  'text_uthmani,page_number,juz_number,hizb_number,rub_el_hizb_number';

/** Default words flag when client omits `words` on page verse fetches. */
export const DEFAULT_PAGE_WORDS = 'true';
