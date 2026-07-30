import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ReadingAyahHistory,
  ReadingDay,
  ReadingProgress,
  ReadingVerseProgress,
} from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DEFAULT_READING_TIMEZONE } from './constants/quran-coordinates';
import { formatLocalDate, toDateOnly } from './utils/reading.utils';

export interface RecordAyahOpenInput {
  userId: string;
  chapterNumber: number;
  verseNumber: number;
  openedAt?: Date;
}

export interface HistoryQueryInput {
  userId: string;
  limit: number;
  cursorAt?: Date;
  cursorId?: string;
  from?: Date;
  to?: Date;
}

export interface RecentQueryInput {
  userId: string;
  limit: number;
  cursorAt?: Date;
  cursorId?: string;
}

@Injectable()
export class ReadingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTimezone(userId: string): Promise<string> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { timezone: true },
    });

    return settings?.timezone ?? DEFAULT_READING_TIMEZONE;
  }

  async recordAyahOpen(input: RecordAyahOpenInput): Promise<void> {
    const openedAt = input.openedAt ?? new Date();
    const timezone = await this.getTimezone(input.userId);
    const localDate = toDateOnly(formatLocalDate(openedAt, timezone));

    await this.prisma.$transaction(async (tx) => {
      await tx.readingAyahHistory.create({
        data: {
          userId: input.userId,
          chapterNumber: input.chapterNumber,
          verseNumber: input.verseNumber,
          openedAt,
        },
      });

      await tx.readingProgress.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          chapterNumber: input.chapterNumber,
          verseNumber: input.verseNumber,
        },
        update: {
          chapterNumber: input.chapterNumber,
          verseNumber: input.verseNumber,
          wordNumber: null,
        },
      });

      await tx.readingVerseProgress.upsert({
        where: {
          userId_chapterNumber_verseNumber: {
            userId: input.userId,
            chapterNumber: input.chapterNumber,
            verseNumber: input.verseNumber,
          },
        },
        create: {
          userId: input.userId,
          chapterNumber: input.chapterNumber,
          verseNumber: input.verseNumber,
          firstReadAt: openedAt,
          lastReadAt: openedAt,
          readCount: 1,
        },
        update: {
          lastReadAt: openedAt,
          readCount: { increment: 1 },
        },
      });

      await tx.readingDay.upsert({
        where: {
          userId_localDate: {
            userId: input.userId,
            localDate,
          },
        },
        create: {
          userId: input.userId,
          localDate,
          timezone,
          versesRead: 1,
          activeSeconds: 0,
          sessionsCount: 0,
        },
        update: {
          timezone,
          versesRead: { increment: 1 },
        },
      });
    });
  }

  async findProgress(userId: string): Promise<ReadingProgress | null> {
    return await this.prisma.readingProgress.findUnique({
      where: { userId },
    });
  }

  async findRecent(input: RecentQueryInput): Promise<ReadingVerseProgress[]> {
    const where: Prisma.ReadingVerseProgressWhereInput = {
      userId: input.userId,
    };

    if (input.cursorAt && input.cursorId) {
      where.OR = [
        { lastReadAt: { lt: input.cursorAt } },
        {
          AND: [{ lastReadAt: input.cursorAt }, { id: { lt: input.cursorId } }],
        },
      ];
    }

    return await this.prisma.readingVerseProgress.findMany({
      where,
      orderBy: [{ lastReadAt: 'desc' }, { id: 'desc' }],
      take: input.limit,
    });
  }

  async findHistory(input: HistoryQueryInput): Promise<ReadingAyahHistory[]> {
    const where: Prisma.ReadingAyahHistoryWhereInput = {
      userId: input.userId,
    };

    if (input.from || input.to) {
      where.openedAt = {
        ...(input.from ? { gte: input.from } : {}),
        ...(input.to ? { lte: input.to } : {}),
      };
    }

    if (input.cursorAt && input.cursorId) {
      const cursorFilter: Prisma.ReadingAyahHistoryWhereInput = {
        OR: [
          { openedAt: { lt: input.cursorAt } },
          {
            AND: [{ openedAt: input.cursorAt }, { id: { lt: input.cursorId } }],
          },
        ],
      };

      where.AND = [cursorFilter];
    }

    return await this.prisma.readingAyahHistory.findMany({
      where,
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      take: input.limit,
    });
  }

  async countUniqueAyahs(userId: string): Promise<number> {
    return await this.prisma.readingVerseProgress.count({
      where: { userId },
    });
  }

  async sumReadCounts(userId: string): Promise<number> {
    const aggregate = await this.prisma.readingVerseProgress.aggregate({
      where: { userId },
      _sum: { readCount: true },
    });

    return aggregate._sum.readCount ?? 0;
  }

  async findDaysInRange(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<ReadingDay[]> {
    return await this.prisma.readingDay.findMany({
      where: {
        userId,
        localDate: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { localDate: 'asc' },
    });
  }

  async findAllActiveDays(userId: string): Promise<ReadingDay[]> {
    return await this.prisma.readingDay.findMany({
      where: {
        userId,
        versesRead: { gt: 0 },
      },
      orderBy: { localDate: 'desc' },
    });
  }

  async countActiveDays(userId: string): Promise<number> {
    return await this.prisma.readingDay.count({
      where: {
        userId,
        versesRead: { gt: 0 },
      },
    });
  }
}
