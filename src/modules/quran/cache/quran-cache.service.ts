import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { QuranQueryParams } from '../interfaces/quran-foundation.interface';

/** How long a fresh Quran entry may still be served after its freshness window. */
export const QURAN_STALE_RETENTION_SECONDS = 7 * 24 * 60 * 60;

type CacheEnvelope<T> = {
  v: 1;
  freshUntil: number;
  value: T;
};

export type QuranCacheSetOptions = {
  /**
   * Redis TTL. When longer than `freshSeconds`, the value is served immediately
   * after freshness expires while a refresh runs in the background.
   * Defaults to 7 days. Pass the freshness TTL itself to disable stale serving.
   */
  retainSeconds?: number;
};

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
    freshSeconds: number,
    loader: () => Promise<T>,
    options?: QuranCacheSetOptions,
  ): Promise<T> {
    const retainSeconds = Math.max(
      freshSeconds,
      options?.retainSeconds ?? QURAN_STALE_RETENTION_SECONDS,
    );
    const redisStarted = Date.now();
    const cached = await this.getJson<unknown>(key);
    const redisMs = Date.now() - redisStarted;
    const entry = this.readStored<T>(cached);
    const label = this.keyLabel(key);

    if (entry.kind === 'fresh' || entry.kind === 'legacy') {
      this.logger.debug(
        {
          outcome: 'CACHE_HIT',
          key: label,
          redisMs,
          legacy: entry.kind === 'legacy',
        },
        'Quran cache hit',
      );
      return entry.value;
    }

    if (entry.kind === 'stale') {
      this.logger.info(
        { outcome: 'STALE_CACHE', key: label, redisMs },
        'Quran cache stale',
      );
      void this.loadShared(
        key,
        freshSeconds,
        retainSeconds,
        loader,
        redisMs,
        'refresh',
      ).catch(() => undefined);
      return entry.value;
    }

    return this.loadShared(
      key,
      freshSeconds,
      retainSeconds,
      loader,
      redisMs,
      'miss',
    );
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
  /** Drop public catalog list entries after an admin edit. Verse bodies stay. */
  async invalidateResourceLists(): Promise<number> {
    const deleted = await this.redisService.delByPattern(
      'qf:cache:resources:*',
    );
    this.logger.info({ deleted }, 'Invalidated Quran resource list cache');
    return deleted;
  }

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

  private loadShared<T>(
    key: string,
    freshSeconds: number,
    retainSeconds: number,
    loader: () => Promise<T>,
    redisMs: number,
    reason: 'miss' | 'refresh',
  ): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const loaderStarted = Date.now();
    const label = this.keyLabel(key);
    const promise = (async () => {
      try {
        const value = await loader();
        await this.writeEntry(key, value, freshSeconds, retainSeconds);
        if (reason === 'miss') {
          this.logger.info(
            {
              outcome: 'CACHE_MISS',
              key: label,
              redisMs,
              loaderMs: Date.now() - loaderStarted,
            },
            'Quran cache miss loaded',
          );
        }
        return value;
      } catch (error) {
        this.logger.warn(
          {
            outcome: 'EXTERNAL_ERROR',
            key: label,
            redisMs,
            loaderMs: Date.now() - loaderStarted,
            err: error,
          },
          'Quran cache load failed',
        );
        throw error;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  private async writeEntry<T>(
    key: string,
    value: T,
    freshSeconds: number,
    retainSeconds: number,
  ): Promise<void> {
    const envelope: CacheEnvelope<T> = {
      v: 1,
      freshUntil: Date.now() + freshSeconds * 1000,
      value,
    };
    await this.setJson(key, envelope, retainSeconds);
    this.logger.info(
      {
        outcome: 'CACHE_WRITE',
        key: this.keyLabel(key),
        freshSeconds,
        retainSeconds,
      },
      'Quran cache write',
    );
  }

  private readStored<T>(
    cached: unknown,
  ): { kind: 'miss' } | { kind: 'fresh' | 'legacy' | 'stale'; value: T } {
    if (cached === null || cached === undefined) {
      return { kind: 'miss' };
    }

    if (this.isEnvelope(cached)) {
      return {
        kind: cached.freshUntil > Date.now() ? 'fresh' : 'stale',
        value: cached.value as T,
      };
    }

    return { kind: 'legacy', value: cached as T };
  }

  private isEnvelope(value: unknown): value is CacheEnvelope<unknown> {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const entry = value as Partial<CacheEnvelope<unknown>>;
    return (
      entry.v === 1 && typeof entry.freshUntil === 'number' && 'value' in entry
    );
  }

  private keyLabel(key: string): string {
    return key.length > 64 ? key.slice(0, 64) : key;
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
