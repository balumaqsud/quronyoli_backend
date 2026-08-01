import {
  decodeVerseKey,
  encodeVerseKey,
  parseCallbackData,
} from './telegram-callbacks';

describe('telegram-callbacks', () => {
  it('encodes and decodes verse keys', () => {
    expect(encodeVerseKey('2:255')).toBe('2_255');
    expect(decodeVerseKey('2_255')).toBe('2:255');
  });

  it('parses action callbacks', () => {
    expect(parseCallbackData('BUGUN')).toEqual({ type: 'BUGUN' });
    expect(parseCallbackData('PLAY_AUDIO:1_1')).toEqual({
      type: 'PLAY_AUDIO',
      verseKey: '1:1',
    });
    expect(parseCallbackData('NEXT_PAGE:suralar:2')).toEqual({
      type: 'NEXT_PAGE',
      kind: 'suralar',
      page: 2,
    });
    expect(parseCallbackData('OPEN_SURAH:114')).toEqual({
      type: 'OPEN_SURAH',
      chapterNumber: 114,
    });
  });

  it('returns null for invalid payloads', () => {
    expect(parseCallbackData('')).toBeNull();
    expect(parseCallbackData('PLAY_AUDIO:bad')).toBeNull();
  });
});
