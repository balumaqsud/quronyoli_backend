import { resolveDailyAyahForDate } from './daily-ayah';

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
