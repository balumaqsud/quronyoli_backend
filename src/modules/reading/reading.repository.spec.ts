import { DailyGoalMetric } from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ReadingRepository } from './reading.repository';

describe('ReadingRepository recordAyahOpen goal sync', () => {
  it('upserts VERSES DailyGoalResult from ReadingDay.versesRead', async () => {
    const localDate = new Date('2026-07-30T00:00:00.000Z');
    const openedAt = new Date('2026-07-30T08:00:00.000Z');
    const goal = {
      id: 'goal-1',
      userId: 'user-1',
      metric: DailyGoalMetric.VERSES,
      targetValue: 2,
      effectiveFrom: localDate,
      effectiveTo: null,
      isEnabled: true,
      deletedAt: null,
    };

    const upsertResult = jest.fn().mockResolvedValue({});
    const tx = {
      readingAyahHistory: { create: jest.fn().mockResolvedValue({}) },
      readingProgress: { upsert: jest.fn().mockResolvedValue({}) },
      readingVerseProgress: { upsert: jest.fn().mockResolvedValue({}) },
      readingDay: {
        upsert: jest.fn().mockResolvedValue({
          versesRead: 2,
          localDate,
          timezone: 'Asia/Tashkent',
        }),
      },
      dailyGoal: {
        findMany: jest.fn().mockResolvedValue([goal]),
      },
      dailyGoalResult: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: upsertResult,
      },
    };

    const prisma = {
      userSettings: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Tashkent' }),
      },
      $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<void>) =>
        cb(tx),
      ),
    };

    const repository = new ReadingRepository(
      prisma as unknown as PrismaService,
    );

    await repository.recordAyahOpen({
      userId: 'user-1',
      chapterNumber: 1,
      verseNumber: 1,
      openedAt,
    });

    expect(upsertResult).toHaveBeenCalledTimes(1);
    const [firstCall] = upsertResult.mock.calls as Array<
      [
        {
          create: {
            dailyGoalId: string;
            localDate: Date;
            actualValue: number;
            completedAt: Date | null;
          };
          update: {
            actualValue: number;
            completedAt: Date | null;
          };
        },
      ]
    >;
    expect(firstCall?.[0].create).toEqual({
      dailyGoalId: 'goal-1',
      localDate,
      actualValue: 2,
      completedAt: openedAt,
    });
    expect(firstCall?.[0].update).toEqual({
      actualValue: 2,
      completedAt: openedAt,
    });
  });
});
