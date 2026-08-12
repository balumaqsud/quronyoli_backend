import { resolveDailyAyahForDate, resolveRandomAyah } from './daily-ayah';
import { isValidAyahCoordinate } from './quran-coordinates';

describe('resolveDailyAyahForDate', () => {
  it('returns a stable verse key for the same date', () => {
    const first = resolveDailyAyahForDate('2026-07-30');
    const second = resolveDailyAyahForDate('2026-07-30');
    expect(first).toEqual(second);
    expect(first.verseKey).toMatch(/^\d{1,3}:\d{1,3}$/);
  });

  it('can return different ayahs for different dates', () => {
    const a = resolveDailyAyahForDate('2026-01-01');
    const b = resolveDailyAyahForDate('2026-12-31');
    expect(a.chapterNumber).toBeGreaterThanOrEqual(1);
    expect(b.chapterNumber).toBeGreaterThanOrEqual(1);
  });
});

describe('resolveRandomAyah', () => {
  it('returns a valid ayah coordinate', () => {
    const ayah = resolveRandomAyah();
    expect(isValidAyahCoordinate(ayah.chapterNumber, ayah.verseNumber)).toBe(
      true,
    );
    expect(ayah.verseKey).toBe(`${ayah.chapterNumber}:${ayah.verseNumber}`);
  });
});
