import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  ANALYTICS_JOBS,
  ANALYTICS_QUEUES,
  CONFIG_KEYS,
} from '../../common/constants';
import { AnalyticsConfig } from '../../config/configuration';
import { RedisService } from '../../infrastructure/cache/redis.service';
import {
  AnalyticsEventName,
  NormalizedAnalyticsEvent,
} from './analytics.constants';
import { AnalyticsRepository } from './analytics.repository';

export interface TrackServerEventInput {
  userId: string;
  eventName: AnalyticsEventName;
  properties?: Record<string, unknown>;
  occurredAt?: Date;
  deviceId?: string;
  sessionId?: string;
  idempotencyKey?: string;
}

@Injectable()
export class AnalyticsTrackingService {
  private readonly config: AnalyticsConfig;

  constructor(
    private readonly redisService: RedisService,
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly configService: ConfigService,
    @InjectPinoLogger(AnalyticsTrackingService.name)
    private readonly logger: PinoLogger,
    @Optional()
    @InjectQueue(ANALYTICS_QUEUES.FLUSH)
    private readonly queue?: Queue,
  ) {
    this.config = this.configService.getOrThrow<AnalyticsConfig>(
      CONFIG_KEYS.ANALYTICS,
    );
  }

  async track(input: TrackServerEventInput): Promise<void> {
    const event: NormalizedAnalyticsEvent = {
      userId: input.userId,
      eventName: input.eventName,
      occurredAt: input.occurredAt ?? new Date(),
      deviceId: input.deviceId ?? null,
      sessionId: input.sessionId ?? null,
      schemaVersion: 1,
      properties: input.properties ?? null,
      idempotencyKey:
        input.idempotencyKey ??
        `srv:${input.eventName}:${input.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
    };

    if (!this.queue) {
      await this.analyticsRepository.insertMany(
        [event],
        this.config.dbChunkSize,
      );
      return;
    }

    try {
      const bufferKey = this.bufferKey();
      const client = this.redisService.getClient();
      const namespaced = this.redisService.buildKey(bufferKey);
      await client.rpush(namespaced, JSON.stringify(event));
      await client.expire(namespaced, this.config.bufferTtlSeconds);

      const length = await client.llen(namespaced);
      if (length > this.config.flushMaxBatch * 2) {
        await client.ltrim(namespaced, -this.config.flushMaxBatch, -1);
      }

      const bucket = Math.floor(Date.now() / this.config.flushDelayMs);
      await this.queue.add(
        ANALYTICS_JOBS.FLUSH_BUFFER,
        { bufferKey },
        {
          jobId: `analytics-flush:${bucket}`,
          delay: this.config.flushDelayMs,
          attempts: this.config.maxAttempts,
          backoff: {
            type: 'exponential',
            delay: this.config.backoffDelayMs,
          },
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : 'unknown' },
        'Falling back to direct analytics insert',
      );
      try {
        await this.analyticsRepository.insertMany(
          [event],
          this.config.dbChunkSize,
        );
      } catch (insertError) {
        this.logger.error(
          {
            err: insertError instanceof Error ? insertError.message : 'unknown',
          },
          'Failed to persist analytics event',
        );
      }
    }
  }

  async flushBuffer(bufferKey = 'analytics:buffer'): Promise<number> {
    const client = this.redisService.getClient();
    const namespaced = this.redisService.buildKey(bufferKey);

    // Atomically take up to flushMaxBatch items off the buffer.
    const rawItems = (await client.eval(
      `
      local items = redis.call('LRANGE', KEYS[1], 0, ARGV[1] - 1)
      local count = #items
      if count > 0 then
        redis.call('LTRIM', KEYS[1], count, -1)
      end
      return items
      `,
      1,
      namespaced,
      String(this.config.flushMaxBatch),
    )) as string[];

    if (!rawItems || rawItems.length === 0) {
      return 0;
    }

    const events: NormalizedAnalyticsEvent[] = [];
    for (const raw of rawItems) {
      try {
        events.push(JSON.parse(raw) as NormalizedAnalyticsEvent);
      } catch {
        this.logger.warn('Dropped malformed analytics buffer item');
      }
    }

    if (events.length === 0) {
      return 0;
    }

    try {
      const result = await this.analyticsRepository.insertMany(
        events,
        this.config.dbChunkSize,
      );
      return result.accepted;
    } catch (error) {
      if (rawItems.length > 0) {
        await client.lpush(namespaced, ...rawItems.reverse());
        await client.expire(namespaced, this.config.bufferTtlSeconds);
      }
      throw error;
    }
  }

  private bufferKey(): string {
    return 'analytics:buffer';
  }
}
