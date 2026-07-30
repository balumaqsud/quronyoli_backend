import { Injectable } from '@nestjs/common';
import {
  DailyGoal,
  DailyGoalMetric,
  DailyGoalResult,
  ReadingDay,
} from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DEFAULT_READING_TIMEZONE } from '../reading/constants/quran-coordinates';
import { shiftIsoDate, toDateOnly } from '../reading/utils/reading-date.utils';

export interface CreateGoalInput {
  userId: string;
  metric: DailyGoalMetric;
  targetValue: number;
  effectiveFrom: Date;
}

export interface UpdateGoalInput {
  targetValue?: number;
  isEnabled?: boolean;
  effectiveTo?: Date | null;
}

@Injectable()
export class GoalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getTimezone(userId: string): Promise<string> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { timezone: true },
    });

    return settings?.timezone ?? DEFAULT_READING_TIMEZONE;
  }

  async list(userId: string, isEnabled?: boolean): Promise<DailyGoal[]> {
    return await this.prisma.dailyGoal.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(isEnabled === undefined ? {} : { isEnabled }),
      },
      orderBy: [{ metric: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  async findOwnedActive(id: string, userId: string): Promise<DailyGoal | null> {
    return await this.prisma.dailyGoal.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });
  }

  async createClosingOpenEnded(input: CreateGoalInput): Promise<DailyGoal> {
    const effectiveFromIso = input.effectiveFrom.toISOString().slice(0, 10);

    return await this.prisma.$transaction(async (tx) => {
      const openEnded = await tx.dailyGoal.findMany({
        where: {
          userId: input.userId,
          metric: input.metric,
          isEnabled: true,
          deletedAt: null,
          effectiveTo: null,
        },
      });

      for (const goal of openEnded) {
        const fromIso = goal.effectiveFrom.toISOString().slice(0, 10);
        if (fromIso < effectiveFromIso) {
          await tx.dailyGoal.update({
            where: { id: goal.id },
            data: {
              effectiveTo: toDateOnly(shiftIsoDate(effectiveFromIso, -1)),
            },
          });
        } else {
          await tx.dailyGoal.update({
            where: { id: goal.id },
            data: { isEnabled: false },
          });
        }
      }

      return await tx.dailyGoal.create({
        data: {
          userId: input.userId,
          metric: input.metric,
          targetValue: input.targetValue,
          effectiveFrom: input.effectiveFrom,
          isEnabled: true,
        },
      });
    });
  }

  async updateOwned(
    id: string,
    userId: string,
    data: UpdateGoalInput,
  ): Promise<DailyGoal | null> {
    const result = await this.prisma.dailyGoal.updateMany({
      where: { id, userId, deletedAt: null },
      data,
    });

    if (result.count === 0) {
      return null;
    }

    return await this.findOwnedActive(id, userId);
  }

  async softDeleteOwned(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.dailyGoal.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date(), isEnabled: false },
    });

    return result.count > 0;
  }

  async findActiveGoalsForDate(
    userId: string,
    localDate: Date,
  ): Promise<DailyGoal[]> {
    return await this.prisma.dailyGoal.findMany({
      where: {
        userId,
        isEnabled: true,
        deletedAt: null,
        effectiveFrom: { lte: localDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: localDate } }],
      },
      orderBy: [{ metric: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  async findReadingDay(
    userId: string,
    localDate: Date,
  ): Promise<ReadingDay | null> {
    return await this.prisma.readingDay.findUnique({
      where: {
        userId_localDate: {
          userId,
          localDate,
        },
      },
    });
  }

  async upsertGoalResult(input: {
    dailyGoalId: string;
    localDate: Date;
    actualValue: number;
    completedAt: Date | null;
  }): Promise<DailyGoalResult> {
    return await this.prisma.dailyGoalResult.upsert({
      where: {
        dailyGoalId_localDate: {
          dailyGoalId: input.dailyGoalId,
          localDate: input.localDate,
        },
      },
      create: {
        dailyGoalId: input.dailyGoalId,
        localDate: input.localDate,
        actualValue: input.actualValue,
        completedAt: input.completedAt,
      },
      update: {
        actualValue: input.actualValue,
        completedAt: input.completedAt,
      },
    });
  }

  async findGoalResult(
    dailyGoalId: string,
    localDate: Date,
  ): Promise<DailyGoalResult | null> {
    return await this.prisma.dailyGoalResult.findUnique({
      where: {
        dailyGoalId_localDate: {
          dailyGoalId,
          localDate,
        },
      },
    });
  }
}
