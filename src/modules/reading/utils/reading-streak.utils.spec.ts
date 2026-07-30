import { computeStreaks } from './reading-streak.utils';

describe('computeStreaks', () => {
  it('computes current and longest streaks', () => {
    const result = computeStreaks(
      ['2026-07-30', '2026-07-29', '2026-07-28', '2026-07-20'],
      '2026-07-30',
    );
    expect(result.currentStreakDays).toBe(3);
    expect(result.longestStreakDays).toBe(3);
  });

  it('allows streak to continue from yesterday', () => {
    const result = computeStreaks(['2026-07-29', '2026-07-28'], '2026-07-30');
    expect(result.currentStreakDays).toBe(2);
  });
});
