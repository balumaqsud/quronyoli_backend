import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { QuranQueryParams } from '../interfaces/quran-foundation.interface';

@Injectable()
export class QuranCacheService {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly redisService: RedisService,
    @InjectPinoLogger(QuranCacheService.name)
    private readonly logger: PinoLogger,
  ) {}

  buildKey(namespace: string, path: string, query?: QuranQueryParams): string {
    const normalizedQuery = this.canonicalizeQuery(query);
    const digest = createHash('sha1')
      .update(`${path}?${normalizedQuery}`)
      .digest('hex');
    return `qf:cache:${namespace}:${digest}`;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redisService.get(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        { err: error, key },
        'Evicting corrupt Quran cache entry',
      );
      await this.redisService.del(key);
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redisService.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) {
      return cached;
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = loader()
      .then(async (value) => {
        await this.setJson(key, value, ttlSeconds);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  private canonicalizeQuery(query?: QuranQueryParams): string {
    if (!query) {
      return '';
    }

    return Object.keys(query)
      .sort()
      .map((key) => {
        const value = query[key];
        if (value === undefined) {
          return '';
        }

        if (Array.isArray(value)) {
          return `${key}=${value.map(String).sort().join(',')}`;
        }

        return `${key}=${String(value)}`;
      })
      .filter((part) => part.length > 0)
      .join('&');
  }
}
