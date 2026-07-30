import {
  buildAyahStartPayload,
  escapeHtml,
  parseAyahStartPayload,
} from './telegram-text.utils';

describe('telegram-text.utils', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml(`<b>&"'`)).toBe("&lt;b&gt;&amp;&quot;'");
  });

  it('parses ayah start payloads', () => {
    expect(parseAyahStartPayload('ayah_2_255')).toEqual({
      chapterNumber: 2,
      verseNumber: 255,
      verseKey: '2:255',
    });
    expect(parseAyahStartPayload('app')).toBeNull();
  });

  it('builds ayah start payloads', () => {
    expect(buildAyahStartPayload(1, 1)).toBe('ayah_1_1');
  });
});
