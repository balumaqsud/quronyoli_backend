import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getLoggerToken } from 'nestjs-pino';
import { CONFIG_KEYS, ANALYTICS_QUEUES } from '../../common/constants';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { AnalyticsTrackingService } from './analytics-tracking.service';
import { AnalyticsRepository } from './analytics.repository';

describe('AnalyticsTrackingService', () => {
  let service: AnalyticsTrackingService;
  let repository: { insertMany: jest.Mock };
  let redisClient: {
    rpush: jest.Mock;
    expire: jest.Mock;
    llen: jest.Mock;
    ltrim: jest.Mock;
    lrange: jest.Mock;
    lpush: jest.Mock;
  };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    repository = {
      insertMany: jest.fn().mockResolvedValue({ accepted: 1, duplicates: 0 }),
    };
    redisClient = {
      rpush: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      llen: jest.fn().mockResolvedValue(1),
      ltrim: jest.fn().mockResolvedValue('OK'),
      lrange: jest.fn().mockResolvedValue([]),
      lpush: jest.fn().mockResolvedValue(1),
    };
    queue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsTrackingService,
        { provide: AnalyticsRepository, useValue: repository },
        {
          provide: RedisService,
          useValue: {
            getClient: () => redisClient,
            buildKey: (key: string) => `ns:${key}`,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === CONFIG_KEYS.ANALYTICS) {
                return {
                  maxBatchSize: 100,
                  maxClockSkewSeconds: 300,
                  dbChunkSize: 50,
                  bufferTtlSeconds: 3600,
                  flushDelayMs: 2000,
                  flushMaxBatch: 500,
                  queueName: 'analytics-flush',
                  maxAttempts: 5,
                  backoffDelayMs: 5000,
                  maxPropertiesBytes: 4096,
                };
              }
              throw new Error(`Unexpected key ${key}`);
            },
          },
        },
        {
          provide: getQueueToken(ANALYTICS_QUEUES.FLUSH),
          useValue: queue,
        },
        {
          provide: getLoggerToken(AnalyticsTrackingService.name),
          useValue: {
            setContext: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AnalyticsTrackingService);
  });

  it('buffers server events in Redis and schedules a flush job', async () => {
    await service.track({
      userId: 'user-1',
      eventName: 'AYAH_OPEN',
      properties: { chapterNumber: 2, verseNumber: 255, verseKey: '2:255' },
    });

    expect(redisClient.rpush).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      'flush-analytics-buffer',
      { bufferKey: 'analytics:buffer' },
      expect.objectContaining({
        jobId: expect.stringContaining('analytics-flush:') as string,
      }),
    );
    expect(repository.insertMany).not.toHaveBeenCalled();
  });

  it('claims buffered events and inserts them', async () => {
    redisClient.lrange.mockResolvedValue([
      JSON.stringify({
        userId: 'user-1',
        eventName: 'SEARCH',
        occurredAt: new Date().toISOString(),
        schemaVersion: 1,
        properties: { queryLength: 3 },
        idempotencyKey: 'k1',
      }),
    ]);

    await expect(service.flushBuffer()).resolves.toBe(1);
    expect(redisClient.ltrim).toHaveBeenCalled();
    expect(repository.insertMany).toHaveBeenCalled();
  });

  it('restores buffer items when insert fails', async () => {
    const raw = JSON.stringify({
      userId: 'user-1',
      eventName: 'SEARCH',
      occurredAt: new Date().toISOString(),
      schemaVersion: 1,
      properties: null,
      idempotencyKey: 'k2',
    });
    redisClient.lrange.mockResolvedValue([raw]);
    repository.insertMany.mockRejectedValue(new Error('db down'));

    await expect(service.flushBuffer()).rejects.toThrow('db down');
    expect(redisClient.lpush).toHaveBeenCalled();
  });
});
