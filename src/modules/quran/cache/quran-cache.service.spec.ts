import { QuranCacheService } from './quran-cache.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PinoLogger } from 'nestjs-pino';

describe('QuranCacheService', () => {
  let service: QuranCacheService;
  let redis: jest.Mocked<Pick<RedisService, 'get' | 'set' | 'del'>>;

  beforeEach(() => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    service = new QuranCacheService(
      redis as unknown as RedisService,
      { warn: jest.fn() } as unknown as PinoLogger,
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
});
