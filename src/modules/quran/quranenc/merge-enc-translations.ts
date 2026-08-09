import { NormalizedEncTranslationRow } from './quranenc.mapper';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function verseChapterAndNumber(
  verse: Record<string, unknown>,
): { chapter: number; verseNumber: number } | null {
  const chapter = Number(
    verse.chapter_id ?? verse.chapterId ?? verse.chapter_number,
  );
  const verseNumber = Number(verse.verse_number ?? verse.verseNumber);
  if (
    !Number.isFinite(chapter) ||
    !Number.isFinite(verseNumber) ||
    chapter < 1 ||
    verseNumber < 1
  ) {
    return null;
  }
  return { chapter, verseNumber };
}

/**
 * Attach Enc translation rows onto QF verse payloads (snake_case wire).
 * Does not replace Arabic or existing QF translations.
 */
export function mergeEncIntoVersesPayload(
  payload: unknown,
  encByChapter: Map<number, Map<number, NormalizedEncTranslationRow>>,
): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const root = payload as Record<string, unknown>;

  if (Array.isArray(root.verses)) {
    return {
      ...root,
      verses: root.verses.map((verse) =>
        mergeEncIntoSingleVerse(verse, encByChapter),
      ),
    };
  }

  if (root.verse && typeof root.verse === 'object') {
    return {
      ...root,
      verse: mergeEncIntoSingleVerse(root.verse, encByChapter),
    };
  }

  // Single-verse responses sometimes return the verse object at the root.
  if (
    root.verse_key !== undefined ||
    root.verseKey !== undefined ||
    root.verse_number !== undefined ||
    root.verseNumber !== undefined
  ) {
    return mergeEncIntoSingleVerse(root, encByChapter);
  }

  return payload;
}

function mergeEncIntoSingleVerse(
  verse: unknown,
  encByChapter: Map<number, Map<number, NormalizedEncTranslationRow>>,
): unknown {
  const record = asRecord(verse);
  if (!record) {
    return verse;
  }

  const ids = verseChapterAndNumber(record);
  if (!ids) {
    return verse;
  }

  const surahMap = encByChapter.get(ids.chapter);
  if (!surahMap) {
    return verse;
  }

  const encRow = surahMap.get(ids.verseNumber);
  if (!encRow) {
    return verse;
  }

  const existing: unknown[] = Array.isArray(record.translations)
    ? [...(record.translations as unknown[])]
    : [];
  const already = existing.some((item) => {
    const row = asRecord(item);
    return (
      row &&
      (row.resource_id === encRow.resource_id ||
        row.resourceId === encRow.resource_id)
    );
  });
  if (!already) {
    existing.push(encRow);
  }

  return {
    ...record,
    translations: existing,
  };
}

export function collectChapterIdsFromVersesPayload(payload: unknown): number[] {
  const chapters = new Set<number>();

  const visit = (verse: unknown) => {
    const record = asRecord(verse);
    if (!record) {
      return;
    }
    const ids = verseChapterAndNumber(record);
    if (ids) {
      chapters.add(ids.chapter);
    }
  };

  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.verses)) {
    for (const verse of root.verses) {
      visit(verse);
    }
  } else if (root.verse) {
    visit(root.verse);
  } else {
    visit(root);
  }

  return [...chapters];
}
