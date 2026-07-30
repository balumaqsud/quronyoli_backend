import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CONFIG_KEYS } from '../../common/constants';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { UsersService } from '../users/users.service';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repository: jest.Mocked<
    Pick<
      AnalyticsRepository,
      | 'insertMany'
      | 'countTotal'
      | 'countByEventName'
      | 'dailySeries'
      | 'uniqueActiveDays'
      | 'topProperty'
      | 'findFirstLast'
    >
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'getActiveByIdOrThrow'>>;
  let redisService: jest.Mocked<Pick<RedisService, 'get' | 'set'>>;

  beforeEach(async () => {
    repository = {
      insertMany: jest.fn().mockResolvedValue({ accepted: 1, duplicates: 0 }),
      countTotal: jest.fn().mockResolvedValue(3),
      countByEventName: jest
        .fn()
        .mockResolvedValue([{ eventName: 'APP_OPEN', count: 2 }]),
      dailySeries: jest
        .fn()
        .mockResolvedValue([{ localDate: '2026-07-30', count: 3 }]),
      uniqueActiveDays: jest.fn().mockResolvedValue(1),
      topProperty: jest.fn().mockResolvedValue([{ key: '2', count: 1 }]),
      findFirstLast: jest.fn().mockResolvedValue({
        firstEventAt: new Date('2026-07-30T10:00:00.000Z'),
        lastEventAt: new Date('2026-07-30T12:00:00.000Z'),
      }),
    };
    usersService = {
      getActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: AnalyticsRepository, useValue: repository },
        { provide: UsersService, useValue: usersService },
        { provide: RedisService, useValue: redisService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === CONFIG_KEYS.ANALYTICS) {
                return {
                  maxBatchSize: 2,
                  maxClockSkewSeconds: 300,
                  dbChunkSize: 50,
                  bufferTtlSeconds: 3600,
                  flushDelayMs: 2000,
                  flushMaxBatch: 500,
                  queueName: 'analytics-flush',
                  maxAttempts: 5,
                  backoffDelayMs: 5000,
                  maxPropertiesBytes: 4096,
                  statsCacheTtlSeconds: 30,
                };
              }
              throw new Error(`Unexpected key ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  it('ingests a single event', async () => {
    await expect(
      service.ingestOne('user-1', { eventName: 'APP_OPEN' }),
    ).resolves.toEqual({ accepted: 1, duplicates: 0 });
    expect(repository.insertMany).toHaveBeenCalled();
  });

  it('rejects oversized batches', async () => {
    await expect(
      service.ingestBatch('user-1', [
        { eventName: 'APP_OPEN' },
        { eventName: 'APP_OPEN' },
        { eventName: 'APP_OPEN' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns bounded statistics', async () => {
    const stats = await service.getStatistics('user-1', {
      from: '2026-07-01',
      to: '2026-07-30',
      timezone: 'Asia/Tashkent',
    });

    expect(stats).toMatchObject({
      from: '2026-07-01',
      to: '2026-07-30',
      timezone: 'Asia/Tashkent',
      totalEvents: 3,
      uniqueActiveDays: 1,
      searchCount: 0,
      shareCount: 0,
      audioPlayCount: 0,
    });
  });

  it('rejects inverted statistics ranges', async () => {
    await expect(
      service.getStatistics('user-1', {
        from: '2026-07-30',
        to: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects statistics ranges longer than 366 days', async () => {
    await expect(
      service.getStatistics('user-1', {
        from: '2025-01-01',
        to: '2026-07-30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
