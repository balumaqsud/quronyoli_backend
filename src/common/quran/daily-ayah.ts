import {
  AyahCoordinate,
  CHAPTER_VERSE_COUNTS,
  TOTAL_QURAN_AYAHS,
  toVerseKey,
} from './quran-coordinates';

/**
 * Deterministic ayah for a calendar date string (YYYY-MM-DD).
 * Same local date always maps to the same verse key.
 */
export function resolveDailyAyahForDate(localDate: string): AyahCoordinate {
  const hash = hashDateString(localDate);
  const ayahIndex = (hash % TOTAL_QURAN_AYAHS) + 1;
  return ayahIndexToCoordinate(ayahIndex);
}

function hashDateString(localDate: string): number {
  let hash = 2166136261;
  for (let i = 0; i < localDate.length; i += 1) {
    hash ^= localDate.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ayahIndexToCoordinate(ayahIndex: number): AyahCoordinate {
  let remaining = ayahIndex;
  for (let chapter = 1; chapter <= 114; chapter += 1) {
    const count = CHAPTER_VERSE_COUNTS[chapter - 1] ?? 0;
    if (remaining <= count) {
      return {
        chapterNumber: chapter,
        verseNumber: remaining,
        verseKey: toVerseKey(chapter, remaining),
      };
    }
    remaining -= count;
  }

  return {
    chapterNumber: 114,
    verseNumber: 6,
    verseKey: '114:6',
  };
}
