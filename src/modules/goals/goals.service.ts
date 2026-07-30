import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DailyGoal, DailyGoalMetric } from '../../generated/prisma';
import { throwIfUniqueConflict } from '../../common/database/prisma-errors';
import { UsersService } from '../users/users.service';
import {
  formatLocalDate,
  toDateOnly,
} from '../reading/utils/reading-date.utils';
import {
  CreateGoalDto,
  ListGoalsQueryDto,
  UpdateGoalDto,
} from './dto/goal.dto';
import {
  GoalProgressItemDto,
  GoalResponseDto,
  GoalsListResponseDto,
  GoalsProgressResponseDto,
} from './dto/goal-response.dto';
import { GoalsRepository } from './goals.repository';

@Injectable()
export class GoalsService {
  constructor(
    private readonly goalsRepository: GoalsRepository,
    private readonly usersService: UsersService,
  ) {}

  async list(
    userId: string,
    query: ListGoalsQueryDto,
  ): Promise<GoalsListResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const items = await this.goalsRepository.list(userId, query.isEnabled);
    return { items: items.map((goal) => this.toResponse(goal)) };
  }

  async create(userId: string, dto: CreateGoalDto): Promise<GoalResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const timezone = await this.goalsRepository.getTimezone(userId);
    const effectiveFromIso =
      dto.effectiveFrom?.slice(0, 10) ?? formatLocalDate(new Date(), timezone);

    try {
      const goal = await this.goalsRepository.createClosingOpenEnded({
        userId,
        metric: dto.metric,
        targetValue: dto.targetValue,
        effectiveFrom: toDateOnly(effectiveFromIso),
      });
      return this.toResponse(goal);
    } catch (error) {
      throwIfUniqueConflict(
        error,
        'An open-ended active goal already exists for this metric',
      );
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateGoalDto,
  ): Promise<GoalResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const existing = await this.goalsRepository.findOwnedActive(id, userId);
    if (!existing) {
      throw new NotFoundException('Goal not found');
    }

    if (
      dto.targetValue === undefined &&
      dto.isEnabled === undefined &&
      dto.effectiveTo === undefined
    ) {
      throw new BadRequestException('No fields provided to update');
    }

    const effectiveTo =
      dto.effectiveTo === undefined
        ? undefined
        : dto.effectiveTo === null
          ? null
          : toDateOnly(dto.effectiveTo.slice(0, 10));

    if (effectiveTo) {
      const fromIso = existing.effectiveFrom.toISOString().slice(0, 10);
      const toIso = effectiveTo.toISOString().slice(0, 10);
      if (toIso < fromIso) {
        throw new BadRequestException(
          'effectiveTo must be on or after effectiveFrom',
        );
      }
    }

    try {
      const updated = await this.goalsRepository.updateOwned(id, userId, {
        ...(dto.targetValue !== undefined
          ? { targetValue: dto.targetValue }
          : {}),
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.effectiveTo !== undefined ? { effectiveTo } : {}),
      });
      if (!updated) {
        throw new NotFoundException('Goal not found');
      }
      return this.toResponse(updated);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throwIfUniqueConflict(
        error,
        'An open-ended active goal already exists for this metric',
      );
    }
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const deleted = await this.goalsRepository.softDeleteOwned(id, userId);
    if (!deleted) {
      throw new NotFoundException('Goal not found');
    }
    return { deleted: true };
  }

  async getProgress(userId: string): Promise<GoalsProgressResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const timezone = await this.goalsRepository.getTimezone(userId);
    const localDateIso = formatLocalDate(new Date(), timezone);
    const localDate = toDateOnly(localDateIso);
    const [goals, readingDay] = await Promise.all([
      this.goalsRepository.findActiveGoalsForDate(userId, localDate),
      this.goalsRepository.findReadingDay(userId, localDate),
    ]);

    const versesRead = readingDay?.versesRead ?? 0;
    const activeSeconds = readingDay?.activeSeconds ?? 0;
    const now = new Date();

    const existingResults = await this.goalsRepository.findGoalResults(
      goals.map((goal) => goal.id),
      localDate,
    );
    const existingByGoalId = new Map(
      existingResults.map((result) => [result.dailyGoalId, result]),
    );

    const progressItems: GoalProgressItemDto[] = await Promise.all(
      goals.map(async (goal) => {
        const actualValue = this.actualValueForMetric(
          goal.metric,
          versesRead,
          activeSeconds,
        );
        const completed = actualValue >= goal.targetValue;
        const existing = existingByGoalId.get(goal.id);
        const completedAt = completed ? (existing?.completedAt ?? now) : null;

        const result = await this.goalsRepository.upsertGoalResult({
          dailyGoalId: goal.id,
          localDate,
          actualValue,
          completedAt,
        });

        return {
          goalId: goal.id,
          metric: goal.metric,
          targetValue: goal.targetValue,
          actualValue: result.actualValue,
          percent: this.toPercent(result.actualValue, goal.targetValue),
          completed,
          completedAt: result.completedAt,
        };
      }),
    );

    return {
      localDate: localDateIso,
      timezone,
      versesRead,
      activeSeconds,
      goals: progressItems,
    };
  }

  private actualValueForMetric(
    metric: DailyGoalMetric,
    versesRead: number,
    activeSeconds: number,
  ): number {
    if (metric === DailyGoalMetric.MINUTES) {
      return Math.floor(activeSeconds / 60);
    }
    return versesRead;
  }

  private toPercent(actualValue: number, targetValue: number): number {
    if (targetValue <= 0) {
      return 0;
    }
    return Math.min(
      100,
      Number(((actualValue / targetValue) * 100).toFixed(2)),
    );
  }

  private toResponse(goal: DailyGoal): GoalResponseDto {
    return {
      id: goal.id,
      metric: goal.metric,
      targetValue: goal.targetValue,
      effectiveFrom: goal.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: goal.effectiveTo
        ? goal.effectiveTo.toISOString().slice(0, 10)
        : null,
      isEnabled: goal.isEnabled,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }
}
