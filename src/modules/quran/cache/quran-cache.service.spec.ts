import { QuranCacheService } from './quran-cache.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PinoLogger } from 'nestjs-pino';

describe('QuranCacheService', () => {
  let service: QuranCacheService;
  let redis: jest.Mocked<
    Pick<RedisService, 'get' | 'set' | 'del' | 'delByPattern'>
  >;

  beforeEach(() => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPattern: jest.fn().mockResolvedValue(0),
    };

    service = new QuranCacheService(
      redis as unknown as RedisService,
      {
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      } as unknown as PinoLogger,
    );
  });

  it('returns cached JSON on hit', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ ok: true }));

    await expect(service.getJson<{ ok: boolean }>('key')).resolves.toEqual({
      ok: true,
    });
  });

  it('evicts corrupt cache entries', async () => {
    redis.get.mockResolvedValue('{bad');

    await expect(service.getJson('key')).resolves.toBeNull();
    expect(redis.del).toHaveBeenCalledWith('key');
  });

  it('returns a fresh envelope without calling the loader', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        v: 1,
        freshUntil: Date.now() + 60_000,
        value: { ok: true },
      }),
    );
    const loader = jest.fn();

    await expect(service.getOrSet('fresh', 60, loader)).resolves.toEqual({
      ok: true,
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it('returns legacy raw JSON as a hit', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ chapters: [1] }));
    const loader = jest.fn();

    await expect(service.getOrSet('legacy', 60, loader)).resolves.toEqual({
      chapters: [1],
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it('returns a stale entry without waiting for refresh', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        v: 1,
        freshUntil: Date.now() - 1_000,
        value: { ok: true },
      }),
    );
    let resolveLoader: (value: unknown) => void = () => undefined;
    const loader = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoader = resolve;
        }),
    );

    await expect(
      service.getOrSet('stale', 60, loader, { retainSeconds: 86_400 }),
    ).resolves.toEqual({ ok: true });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redis.set).not.toHaveBeenCalled();

    resolveLoader({ ok: false });
    await new Promise((resolve) => setImmediate(resolve));
    expect(redis.set).toHaveBeenCalled();
  });

  it('keeps the stale body when refresh fails', async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        v: 1,
        freshUntil: Date.now() - 5_000,
        value: { ok: true },
      }),
    );
    const loader = jest.fn().mockRejectedValue(new Error('upstream'));

    await expect(service.getOrSet('stale-fail', 60, loader)).resolves.toEqual({
      ok: true,
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('loads once for concurrent misses', async () => {
    redis.get.mockResolvedValue(null);
    const loader = jest.fn().mockResolvedValue({ value: 1 });

    const [a, b] = await Promise.all([
      service.getOrSet('miss', 60, loader),
      service.getOrSet('miss', 60, loader),
    ]);

    expect(a).toEqual({ value: 1 });
    expect(b).toEqual({ value: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalled();
  });

  it('canonicalizes query keys stably', () => {
    const left = service.buildKey('verses', '/verses/by_chapter/1', {
      translations: [20, 131],
      page: 1,
    });
    const right = service.buildKey('verses', '/verses/by_chapter/1', {
      page: 1,
      translations: [131, 20],
    });

    expect(left).toBe(right);
  });

  it('builds literal page Redis keys', () => {
    expect(service.pageMetadataKey(1)).toBe('page:1');
    expect(service.pageMetadataKey(2, 1)).toBe('page:2');
    expect(service.pageMetadataKey(1, 19)).toBe('page:19:1');
    expect(service.pagesListKey()).toBe('pages:list');
    expect(service.pagesListKey(19)).toBe('pages:list:19');
    expect(service.pageVersesKey(1, 1, { translations: '20' })).toMatch(
      /^page:1:verses:[a-f0-9]{16}$/,
    );
  });

  it('invalidates page verse digests after pages sync', async () => {
    redis.delByPattern.mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    await expect(service.invalidateAfterPagesSync(1)).resolves.toBe(5);
    expect(redis.delByPattern).toHaveBeenCalledWith('page:*:verses:*');
    expect(redis.delByPattern).toHaveBeenCalledWith('qf:cache:verses:*');
  });

  it('invalidates resources and verses after catalog sync', async () => {
    redis.delByPattern.mockResolvedValue(1);

    await expect(service.invalidateAfterCatalogSync()).resolves.toBe(2);
    expect(redis.delByPattern).toHaveBeenCalledWith('qf:cache:resources:*');
    expect(redis.delByPattern).toHaveBeenCalledWith('qf:cache:verses:*');
  });
});
