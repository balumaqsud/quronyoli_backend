import { QURAN_FOUNDATION_PROVIDER } from '../../settings/interfaces/settings.interface';
import { normalizeQfMediaUrls } from '../utils/qf-media-url.normalizer';

export type QfPageVerseSnippet = {
  verse_key?: string;
  juz_number?: number;
  hizb_number?: number;
  rub_el_hizb_number?: number;
  page_number?: number;
  image_url?: string | null;
  image_width?: number | null;
};

export type MushafPagePayload = {
  provider: string;
  mushafId: number;
  pageNumber: number;
  firstVerseKey: string;
  lastVerseKey: string;
  verseKeys: string[];
  surahIds: number[];
  juzNumber: number;
  hizbNumber: number;
  rubElHizbNumber: number;
  juzNumbers: number[];
  hizbNumbers: number[];
  rubElHizbNumbers: number[];
  verseCount: number;
  imageUrl: string | null;
  imageWidth: number | null;
  isActive: boolean;
  syncedAt: Date;
};

/** Compact list item for GET /pages. */
export type MushafPageListItem = {
  page: number;
  firstVerse: string;
  lastVerse: string;
  verseCount: number;
};

/** Full page metadata for GET /pages/:page and embedded in verses responses. */
export type MushafPageDetail = {
  pageNumber: number;
  mushafId: number;
  firstVerseKey: string;
  lastVerseKey: string;
  verseCount: number;
  surahIds: number[];
  juzNumber: number;
  hizbNumber: number;
  rubElHizb: number;
  juzNumbers: number[];
  hizbNumbers: number[];
  rubElHizbNumbers: number[];
  /** Verse keys only — relationships, no Arabic/translation text. */
  verses: string[];
  imageUrl: string | null;
  imageWidth: number | null;
  syncedAt: string;
};

function uniqueSortedInts(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function surahIdFromVerseKey(verseKey: string): number | null {
  const chapter = Number.parseInt(verseKey.split(':')[0] ?? '', 10);
  return Number.isFinite(chapter) && chapter > 0 ? chapter : null;
}

/**
 * Build a mushaf_pages upsert payload from QF verse snippets for one page.
 * Does not store Arabic or translation text — coordinates and optional image meta only.
 */
export function mapVersesToMushafPage(
  pageNumber: number,
  mushafId: number,
  verses: QfPageVerseSnippet[],
  audioCdnBase = 'https://audio.qurancdn.com',
): MushafPagePayload {
  if (verses.length === 0) {
    throw new Error(`Page ${pageNumber} returned zero verses from QF`);
  }

  const verseKeys: string[] = [];
  const surahIds: number[] = [];
  const juzNumbers: number[] = [];
  const hizbNumbers: number[] = [];
  const rubNumbers: number[] = [];
  let imageUrl: string | null = null;
  let imageWidth: number | null = null;

  for (const verse of verses) {
    const key = verse.verse_key?.trim();
    if (!key) {
      continue;
    }
    verseKeys.push(key);

    const surahId = surahIdFromVerseKey(key);
    if (surahId !== null) {
      surahIds.push(surahId);
    }

    if (typeof verse.juz_number === 'number') {
      juzNumbers.push(verse.juz_number);
    }
    if (typeof verse.hizb_number === 'number') {
      hizbNumbers.push(verse.hizb_number);
    }
    if (typeof verse.rub_el_hizb_number === 'number') {
      rubNumbers.push(verse.rub_el_hizb_number);
    }

    if (
      imageUrl === null &&
      typeof verse.image_url === 'string' &&
      verse.image_url
    ) {
      const normalized = normalizeQfMediaUrls(
        { image_url: verse.image_url },
        audioCdnBase,
      ) as { image_url: string };
      imageUrl = normalized.image_url;
      imageWidth =
        typeof verse.image_width === 'number' ? verse.image_width : null;
    }
  }

  if (verseKeys.length === 0) {
    throw new Error(`Page ${pageNumber} had verses without verse_key`);
  }

  const first = verses.find((v) => v.verse_key?.trim());
  const juzNumber = first?.juz_number ?? juzNumbers[0];
  const hizbNumber = first?.hizb_number ?? hizbNumbers[0];
  const rubElHizbNumber = first?.rub_el_hizb_number ?? rubNumbers[0];

  if (
    juzNumber === undefined ||
    hizbNumber === undefined ||
    rubElHizbNumber === undefined
  ) {
    throw new Error(
      `Page ${pageNumber} missing juz/hizb/rub fields on upstream verses`,
    );
  }

  return {
    provider: QURAN_FOUNDATION_PROVIDER,
    mushafId,
    pageNumber,
    firstVerseKey: verseKeys[0],
    lastVerseKey: verseKeys[verseKeys.length - 1],
    verseKeys,
    surahIds: uniqueSortedInts(surahIds),
    juzNumber,
    hizbNumber,
    rubElHizbNumber,
    juzNumbers: uniqueSortedInts(juzNumbers),
    hizbNumbers: uniqueSortedInts(hizbNumbers),
    rubElHizbNumbers: uniqueSortedInts(rubNumbers),
    verseCount: verseKeys.length,
    imageUrl,
    imageWidth,
    isActive: true,
    syncedAt: new Date(),
  };
}

export function toMushafPageListItem(row: {
  pageNumber: number;
  firstVerseKey: string;
  lastVerseKey: string;
  verseCount: number;
}): MushafPageListItem {
  return {
    page: row.pageNumber,
    firstVerse: row.firstVerseKey,
    lastVerse: row.lastVerseKey,
    verseCount: row.verseCount,
  };
}

export function toMushafPageDetail(row: {
  mushafId: number;
  pageNumber: number;
  firstVerseKey: string;
  lastVerseKey: string;
  verseKeys: string[];
  surahIds: number[];
  juzNumber: number;
  hizbNumber: number;
  rubElHizbNumber: number;
  juzNumbers: number[];
  hizbNumbers: number[];
  rubElHizbNumbers: number[];
  verseCount: number;
  imageUrl: string | null;
  imageWidth: number | null;
  syncedAt: Date;
}): MushafPageDetail {
  return {
    pageNumber: row.pageNumber,
    mushafId: row.mushafId,
    firstVerseKey: row.firstVerseKey,
    lastVerseKey: row.lastVerseKey,
    verseCount: row.verseCount,
    surahIds: row.surahIds,
    juzNumber: row.juzNumber,
    hizbNumber: row.hizbNumber,
    rubElHizb: row.rubElHizbNumber,
    juzNumbers: row.juzNumbers,
    hizbNumbers: row.hizbNumbers,
    rubElHizbNumbers: row.rubElHizbNumbers,
    verses: row.verseKeys,
    imageUrl: row.imageUrl,
    imageWidth: row.imageWidth,
    syncedAt: row.syncedAt.toISOString(),
  };
}
