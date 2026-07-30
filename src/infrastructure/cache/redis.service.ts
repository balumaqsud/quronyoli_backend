import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RedisConfig } from '../../config/configuration';
import { CONFIG_KEYS } from '../../common/constants';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  private readonly keyPrefix: string;

  constructor(
    configService: ConfigService,
    @InjectPinoLogger(RedisService.name)
    private readonly logger: PinoLogger,
  ) {
    const redisConfig = configService.getOrThrow<RedisConfig>(
      CONFIG_KEYS.REDIS,
    );

    this.keyPrefix = redisConfig.keyPrefix;
    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password || undefined,
      db: redisConfig.db,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number): number | null => {
        if (times > 10) {
          return null;
        }

        return Math.min(times * 200, 2000);
      },
    });

    this.client.on('error', (error: Error) => {
      this.logger.error({ err: error }, 'Redis client error');
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }

    this.logger.info('Redis connection established');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }

    this.logger.info('Redis connection closed');
  }

  getClient(): Redis {
    return this.client;
  }

  buildKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(this.buildKey(key));
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const namespacedKey = this.buildKey(key);

    if (ttlSeconds !== undefined) {
      await this.client.set(namespacedKey, value, 'EX', ttlSeconds);
      return;
    }

    await this.client.set(namespacedKey, value);
  }

  async del(key: string): Promise<void> {
    await this.client.del(this.buildKey(key));
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error({ err: error }, 'Redis health check failed');
      return false;
    }
  }
}
