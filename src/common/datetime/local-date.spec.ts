import { formatLocalDate, shiftIsoDate, toDateOnly } from './local-date';
import { DEFAULT_USER_TIMEZONE } from './defaults';

describe('datetime helpers', () => {
  it('formats a UTC instant in Asia/Tashkent as a calendar date', () => {
    const date = new Date('2026-07-30T20:30:00.000Z');
    expect(formatLocalDate(date, DEFAULT_USER_TIMEZONE)).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('shifts ISO dates by day without DST surprises (UTC date-only)', () => {
    expect(shiftIsoDate('2026-07-30', -1)).toBe('2026-07-29');
    expect(toDateOnly('2026-07-30').toISOString()).toBe(
      '2026-07-30T00:00:00.000Z',
    );
  });
});
