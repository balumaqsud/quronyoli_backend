export interface DeliverDailyReminderJobData {
  userId: string;
  localDate: string;
  telegramId: string;
  timezone: string;
}

export function buildDeliveryJobId(userId: string, localDate: string): string {
  return `daily-reminder:${userId}:${localDate}`;
}

export function formatUtcHhMm(date: Date = new Date()): string {
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Returns candidate local HH:mm values that currently match across common
 * offsets. The scanner then filters by each user's actual timezone.
 */
export function candidateLocalTimes(now: Date = new Date()): string[] {
  const times = new Set<string>();
  for (
    let offsetMinutes = -12 * 60;
    offsetMinutes <= 14 * 60;
    offsetMinutes += 15
  ) {
    const shifted = new Date(now.getTime() + offsetMinutes * 60_000);
    times.add(formatUtcHhMm(shifted));
  }
  return [...times];
}
