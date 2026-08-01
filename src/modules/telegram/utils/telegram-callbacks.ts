/** Callback payload helpers (Telegram callback_data max 64 bytes). */

export function encodeVerseKey(verseKey: string): string {
  return verseKey.replace(':', '_');
}

export function decodeVerseKey(encoded: string): string {
  const match = /^(\d+)_(\d+)$/.exec(encoded);
  if (!match) {
    throw new Error(`Invalid encoded verse key: ${encoded}`);
  }
  return `${match[1]}:${match[2]}`;
}

export type ParsedCallback =
  | { type: 'OPEN_APP' }
  | { type: 'BUGUN' }
  | { type: 'TASODIFIY' }
  | { type: 'YORDAM' }
  | { type: 'OPEN_AYAH'; verseKey: string }
  | { type: 'PLAY_AUDIO'; verseKey: string }
  | { type: 'SHOW_TAFSIR'; verseKey: string }
  | { type: 'SAVE_BOOKMARK'; verseKey: string }
  | { type: 'OPEN_SURAH'; chapterNumber: number }
  | { type: 'OPEN_JUZ'; juzNumber: number }
  | { type: 'OPEN_PAGE'; pageNumber: number }
  | { type: 'NEXT_PAGE'; kind: 'suralar'; page: number }
  | { type: 'PREV_PAGE'; kind: 'suralar'; page: number };

export function parseCallbackData(data: string): ParsedCallback | null {
  const trimmed = data.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed === 'OPEN_APP') return { type: 'OPEN_APP' };
  if (trimmed === 'BUGUN') return { type: 'BUGUN' };
  if (trimmed === 'TASODIFIY') return { type: 'TASODIFIY' };
  if (trimmed === 'YORDAM') return { type: 'YORDAM' };

  const ayah = /^(OPEN_AYAH|PLAY_AUDIO|SHOW_TAFSIR|SAVE_BOOKMARK):(.+)$/.exec(
    trimmed,
  );
  if (ayah) {
    try {
      const verseKey = decodeVerseKey(ayah[2]);
      return {
        type: ayah[1] as
          'OPEN_AYAH' | 'PLAY_AUDIO' | 'SHOW_TAFSIR' | 'SAVE_BOOKMARK',
        verseKey,
      };
    } catch {
      return null;
    }
  }

  const surah = /^OPEN_SURAH:(\d+)$/.exec(trimmed);
  if (surah) {
    return { type: 'OPEN_SURAH', chapterNumber: Number(surah[1]) };
  }

  const juz = /^OPEN_JUZ:(\d+)$/.exec(trimmed);
  if (juz) {
    return { type: 'OPEN_JUZ', juzNumber: Number(juz[1]) };
  }

  const page = /^OPEN_PAGE:(\d+)$/.exec(trimmed);
  if (page) {
    return { type: 'OPEN_PAGE', pageNumber: Number(page[1]) };
  }

  const next = /^NEXT_PAGE:suralar:(\d+)$/.exec(trimmed);
  if (next) {
    return { type: 'NEXT_PAGE', kind: 'suralar', page: Number(next[1]) };
  }

  const prev = /^PREV_PAGE:suralar:(\d+)$/.exec(trimmed);
  if (prev) {
    return { type: 'PREV_PAGE', kind: 'suralar', page: Number(prev[1]) };
  }

  return null;
}
