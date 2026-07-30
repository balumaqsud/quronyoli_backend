import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ReadingAyahHistory,
  ReadingDay,
  ReadingProgress,
  ReadingVerseProgress,
} from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import { TOTAL_QURAN_AYAHS } from './constants/quran-coordinates';
import {
  ContinueReadingResponseDto,
  DailyReadingResponseDto,
  PaginatedHistoryResponseDto,
  PaginatedRecentResponseDto,
  ReadingProgressResponseDto,
  ReadingStatisticsResponseDto,
} from './dto/reading-response.dto';
import { ReadingRepository } from './reading.repository';
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
  formatLocalDate,
  parseVerseKey,
  shiftIsoDate,
  toDateOnly,
} from './utils/reading.utils';

@Injectable()
export class ReadingService {
  constructor(
    private readonly readingRepository: ReadingRepository,
    private readonly usersService: UsersService,
  ) {}

  async recordAyahOpen(userId: string, verseKey: string): Promise<void> {
    const coordinate = parseVerseKey(verseKey);
    await this.readingRepository.recordAyahOpen({
      userId,
      chapterNumber: coordinate.chapterNumber,
      verseNumber: coordinate.verseNumber,
    });
  }

  async getContinue(
    userId: string,
  ): Promise<ContinueReadingResponseDto | null> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const progress = await this.readingRepository.findProgress(userId);
    return progress ? this.mapContinue(progress) : null;
  }

  async getRecent(
    userId: string,
    limit = 20,
    cursor?: string,
  ): Promise<PaginatedRecentResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const decoded = cursor ? decodeKeysetCursor(cursor) : undefined;
    const rows = await this.readingRepository.findRecent({
      userId,
      limit: limit + 1,
      cursorAt: decoded ? new Date(decoded.at) : undefined,
      cursorId: decoded?.id,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      items: page.map((row) => this.mapRecent(row)),
      nextCursor:
        hasMore && last
          ? encodeKeysetCursor({
              at: last.lastReadAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async getHistory(
    userId: string,
    options: {
      limit?: number;
      cursor?: string;
      from?: string;
      to?: string;
    },
  ): Promise<PaginatedHistoryResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const limit = options.limit ?? 20;
    const decoded = options.cursor
      ? decodeKeysetCursor(options.cursor)
      : undefined;

    const rows = await this.readingRepository.findHistory({
      userId,
      limit: limit + 1,
      cursorAt: decoded ? new Date(decoded.at) : undefined,
      cursorId: decoded?.id,
      from: options.from ? new Date(options.from) : undefined,
      to: options.to ? new Date(options.to) : undefined,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      items: page.map((row) => this.mapHistory(row)),
      nextCursor:
        hasMore && last
          ? encodeKeysetCursor({
              at: last.openedAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async getProgress(userId: string): Promise<ReadingProgressResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const [uniqueAyahsRead, totalOpens, continueReading] = await Promise.all([
      this.readingRepository.countUniqueAyahs(userId),
      this.readingRepository.sumReadCounts(userId),
      this.readingRepository.findProgress(userId),
    ]);

    return {
      uniqueAyahsRead,
      totalQuranAyahs: TOTAL_QURAN_AYAHS,
      completionPercentage: this.toPercentage(uniqueAyahsRead),
      totalOpens,
      repeatedOpens: Math.max(totalOpens - uniqueAyahsRead, 0),
      continue: continueReading ? this.mapContinue(continueReading) : null,
    };
  }

  async getDaily(
    userId: string,
    from: string,
    to: string,
  ): Promise<DailyReadingResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    this.assertDateRange(from, to);

    const days = await this.readingRepository.findDaysInRange(
      userId,
      toDateOnly(from.slice(0, 10)),
      toDateOnly(to.slice(0, 10)),
    );

    return {
      items: days.map((day) => this.mapDaily(day)),
    };
  }

  async getStatistics(userId: string): Promise<ReadingStatisticsResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const timezone = await this.readingRepository.getTimezone(userId);
    const today = formatLocalDate(new Date(), timezone);
    const from7 = shiftIsoDate(today, -6);
    const from30 = shiftIsoDate(today, -29);

    const [
      uniqueAyahsRead,
      totalOpens,
      totalActiveDays,
      continueReading,
      days30,
      allActiveDays,
    ] = await Promise.all([
      this.readingRepository.countUniqueAyahs(userId),
      this.readingRepository.sumReadCounts(userId),
      this.readingRepository.countActiveDays(userId),
      this.readingRepository.findProgress(userId),
      this.readingRepository.findDaysInRange(
        userId,
        toDateOnly(from30),
        toDateOnly(today),
      ),
      this.readingRepository.findAllActiveDays(userId),
    ]);

    const dayMap = new Map(
      days30.map((day) => [this.toIsoDate(day.localDate), day]),
    );

    const { currentStreakDays, longestStreakDays } = this.computeStreaks(
      allActiveDays.map((day) => this.toIsoDate(day.localDate)),
      today,
    );

    return {
      totalOpens,
      uniqueAyahsRead,
      completionPercentage: this.toPercentage(uniqueAyahsRead),
      totalActiveDays,
      currentStreakDays,
      longestStreakDays,
      today: this.periodFromMap(dayMap, today, today),
      last7Days: this.periodFromMap(dayMap, from7, today),
      last30Days: this.periodFromMap(dayMap, from30, today),
      continue: continueReading ? this.mapContinue(continueReading) : null,
    };
  }

  private mapContinue(progress: ReadingProgress): ContinueReadingResponseDto {
    return {
      chapterNumber: progress.chapterNumber,
      verseNumber: progress.verseNumber,
      verseKey: `${progress.chapterNumber}:${progress.verseNumber}`,
      wordNumber: progress.wordNumber,
      lastReadAt: progress.updatedAt,
    };
  }

  private mapRecent(row: ReadingVerseProgress) {
    return {
      chapterNumber: row.chapterNumber,
      verseNumber: row.verseNumber,
      verseKey: `${row.chapterNumber}:${row.verseNumber}`,
      lastReadAt: row.lastReadAt,
      firstReadAt: row.firstReadAt,
      readCount: row.readCount,
    };
  }

  private mapHistory(row: ReadingAyahHistory) {
    return {
      id: row.id,
      chapterNumber: row.chapterNumber,
      verseNumber: row.verseNumber,
      verseKey: `${row.chapterNumber}:${row.verseNumber}`,
      openedAt: row.openedAt,
    };
  }

  private mapDaily(day: ReadingDay) {
    return {
      localDate: this.toIsoDate(day.localDate),
      timezone: day.timezone,
      versesRead: day.versesRead,
      activeSeconds: day.activeSeconds,
      sessionsCount: day.sessionsCount,
    };
  }

  private toIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private toPercentage(uniqueAyahsRead: number): number {
    return Number(((uniqueAyahsRead / TOTAL_QURAN_AYAHS) * 100).toFixed(2));
  }

  private assertDateRange(from: string, to: string): void {
    const fromDate = from.slice(0, 10);
    const toDate = to.slice(0, 10);
    if (fromDate > toDate) {
      throw new BadRequestException('from must be on or before to');
    }

    const spanMs =
      toDateOnly(toDate).getTime() - toDateOnly(fromDate).getTime();
    const maxSpanMs = 366 * 24 * 60 * 60 * 1000;
    if (spanMs > maxSpanMs) {
      throw new BadRequestException('Daily range cannot exceed 366 days');
    }
  }

  private periodFromMap(
    dayMap: Map<string, ReadingDay>,
    from: string,
    to: string,
  ) {
    let versesRead = 0;
    let activeSeconds = 0;
    let activeDays = 0;
    let cursor = from;

    while (cursor <= to) {
      const day = dayMap.get(cursor);
      if (day && day.versesRead > 0) {
        versesRead += day.versesRead;
        activeSeconds += day.activeSeconds;
        activeDays += 1;
      }
      cursor = shiftIsoDate(cursor, 1);
    }

    return { versesRead, activeSeconds, activeDays };
  }

  private computeStreaks(
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
}
