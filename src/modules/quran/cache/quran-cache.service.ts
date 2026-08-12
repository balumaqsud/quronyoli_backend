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

  /** Literal Redis key for a single page metadata payload (`page:1` … `page:604`). */
  pageMetadataKey(pageNumber: number, mushafId = 1): string {
    return mushafId === 1
      ? `page:${pageNumber}`
      : `page:${mushafId}:${pageNumber}`;
  }

  /** Literal Redis key for the compact pages list. */
  pagesListKey(mushafId = 1): string {
    return mushafId === 1 ? 'pages:list' : `pages:list:${mushafId}`;
  }

  /**
   * Composed page+verses bundle key. Query digest avoids collisions across
   * translations / tafsirs / audio / words variants.
   */
  pageVersesKey(
    pageNumber: number,
    mushafId: number,
    query?: QuranQueryParams,
  ): string {
    const digest = createHash('sha1')
      .update(this.canonicalizeQuery(query))
      .digest('hex')
      .slice(0, 16);
    const base = this.pageMetadataKey(pageNumber, mushafId);
    return `${base}:verses:${digest}`;
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

  /**
   * After mushaf page metadata sync/warm, drop stale page+verses bundles
   * so the next read rebuilds from fresh page coordinates + QF.
   * Does not touch OAuth token keys.
   */
  async invalidateAfterPagesSync(mushafId = 1): Promise<number> {
    const patterns =
      mushafId === 1
        ? ['page:*:verses:*', 'qf:cache:verses:*']
        : [`page:${mushafId}:*:verses:*`, 'qf:cache:verses:*'];

    let deleted = 0;
    for (const pattern of patterns) {
      deleted += await this.redisService.delByPattern(pattern);
    }
    this.logger.info(
      { mushafId, deleted },
      'Invalidated Quran page/verses cache after pages sync',
    );
    return deleted;
  }

  /**
   * After catalog sync (translations/tafsirs/reciters), drop cached resource
   * lists and verse payloads that may embed translation merges.
   * Does not touch OAuth token keys.
   */
  async invalidateAfterCatalogSync(): Promise<number> {
    const patterns = ['qf:cache:resources:*', 'qf:cache:verses:*'];
    let deleted = 0;
    for (const pattern of patterns) {
      deleted += await this.redisService.delByPattern(pattern);
    }
    this.logger.info(
      { deleted },
      'Invalidated Quran resources/verses cache after catalog sync',
    );
    return deleted;
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
