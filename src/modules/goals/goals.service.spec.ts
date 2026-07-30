import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DailyGoalMetric } from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import { GoalsRepository } from './goals.repository';
import { GoalsService } from './goals.service';

describe('GoalsService', () => {
  let service: GoalsService;
  let repository: jest.Mocked<
    Pick<
      GoalsRepository,
      | 'getTimezone'
      | 'list'
      | 'findOwnedActive'
      | 'createClosingOpenEnded'
      | 'updateOwned'
      | 'softDeleteOwned'
      | 'findActiveGoalsForDate'
      | 'findReadingDay'
      | 'upsertGoalResult'
      | 'findGoalResult'
    >
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'getActiveByIdOrThrow'>>;

  const goal = {
    id: 'goal-1',
    userId: 'user-1',
    metric: DailyGoalMetric.VERSES,
    targetValue: 10,
    effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
    effectiveTo: null,
    isEnabled: true,
    deletedAt: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    repository = {
      getTimezone: jest.fn().mockResolvedValue('Asia/Tashkent'),
      list: jest.fn().mockResolvedValue([goal]),
      findOwnedActive: jest.fn().mockResolvedValue(goal),
      createClosingOpenEnded: jest.fn().mockResolvedValue(goal),
      updateOwned: jest.fn().mockResolvedValue(goal),
      softDeleteOwned: jest.fn().mockResolvedValue(true),
      findActiveGoalsForDate: jest.fn().mockResolvedValue([goal]),
      findReadingDay: jest.fn().mockResolvedValue({
        id: 'day-1',
        userId: 'user-1',
        localDate: new Date('2026-07-30T00:00:00.000Z'),
        timezone: 'Asia/Tashkent',
        versesRead: 4,
        activeSeconds: 120,
        sessionsCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      upsertGoalResult: jest
        .fn()
        .mockImplementation(
          (input: {
            dailyGoalId: string;
            localDate: Date;
            actualValue: number;
            completedAt: Date | null;
          }) =>
            Promise.resolve({
              id: 'result-1',
              dailyGoalId: input.dailyGoalId,
              localDate: input.localDate,
              actualValue: input.actualValue,
              completedAt: input.completedAt,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
        ),
      findGoalResult: jest.fn().mockResolvedValue(null),
    };
    usersService = {
      getActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: GoalsRepository, useValue: repository },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(GoalsService);
  });

  it('creates a goal and closes prior open-ended via repository', async () => {
    const created = await service.create('user-1', {
      metric: DailyGoalMetric.VERSES,
      targetValue: 10,
      effectiveFrom: '2026-07-30',
    });

    expect(repository.createClosingOpenEnded).toHaveBeenCalledWith({
      userId: 'user-1',
      metric: DailyGoalMetric.VERSES,
      targetValue: 10,
      effectiveFrom: new Date('2026-07-30T00:00:00.000Z'),
    });
    expect(created.metric).toBe(DailyGoalMetric.VERSES);
  });

  it('computes progress percent and completion from ReadingDay', async () => {
    const progress = await service.getProgress('user-1');

    expect(progress.versesRead).toBe(4);
    expect(progress.goals[0]).toMatchObject({
      goalId: 'goal-1',
      actualValue: 4,
      percent: 40,
      completed: false,
    });
    expect(repository.upsertGoalResult).toHaveBeenCalled();
  });

  it('marks goal completed when target is met', async () => {
    repository.findReadingDay.mockResolvedValue({
      id: 'day-1',
      userId: 'user-1',
      localDate: new Date('2026-07-30T00:00:00.000Z'),
      timezone: 'Asia/Tashkent',
      versesRead: 10,
      activeSeconds: 0,
      sessionsCount: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const progress = await service.getProgress('user-1');
    expect(progress.goals[0]?.completed).toBe(true);
    expect(progress.goals[0]?.percent).toBe(100);
  });

  it('rejects empty updates', async () => {
    await expect(service.update('user-1', 'goal-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('soft-deletes goals', async () => {
    await expect(service.remove('user-1', 'goal-1')).resolves.toEqual({
      deleted: true,
    });
    repository.softDeleteOwned.mockResolvedValueOnce(false);
    await expect(service.remove('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
