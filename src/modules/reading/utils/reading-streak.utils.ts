import { shiftIsoDate } from './reading-date.utils';

export function computeStreaks(
  activeDatesDesc: string[],
  today: string,
): { currentStreakDays: number; longestStreakDays: number } {
  const unique = [...new Set(activeDatesDesc)].sort((a, b) =>
    a < b ? 1 : a > b ? -1 : 0,
  );

  let longestStreakDays = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of [...unique].sort()) {
    if (previous && shiftIsoDate(previous, 1) === date) {
      run += 1;
    } else {
      run = 1;
    }
    longestStreakDays = Math.max(longestStreakDays, run);
    previous = date;
  }

  let currentStreakDays = 0;
  if (unique[0] === today || unique[0] === shiftIsoDate(today, -1)) {
    let expected = unique[0];
    for (const date of unique) {
      if (date !== expected) {
        break;
      }
      currentStreakDays += 1;
      expected = shiftIsoDate(expected, -1);
    }
  }

  return { currentStreakDays, longestStreakDays };
}
