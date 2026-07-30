import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CONFIG_KEYS } from '../../common/constants';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
import { ReadingService } from '../reading/reading.service';
import { QuranCacheService } from './cache/quran-cache.service';
import { QuranFoundationClient } from './client/quran-foundation.client';
import { QuranService } from './quran.service';

describe('QuranService', () => {
  let service: QuranService;
  let client: {
    getContent: jest.Mock;
    getSearch: jest.Mock;
  };
  let cache: {
    buildKey: jest.Mock;
    getOrSet: jest.Mock;
  };
  let analyticsTracking: jest.Mocked<Pick<AnalyticsTrackingService, 'track'>>;

  beforeEach(async () => {
    client = {
      getContent: jest.fn(),
      getSearch: jest.fn(),
    };
    cache = {
      buildKey: jest.fn().mockReturnValue('cache-key'),
      getOrSet: jest
        .fn()
        .mockImplementation(
          async (_key: string, _ttl: number, loader: () => Promise<unknown>) =>
            loader(),
        ),
    };
    analyticsTracking = {
      track: jest.fn().mockResolvedValue(undefined),
    };

    const readingService = {
      recordAyahOpen: jest.fn().mockResolvedValue(undefined),
      getTimezone: jest.fn().mockResolvedValue('Asia/Tashkent'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuranService,
        { provide: QuranFoundationClient, useValue: client },
        { provide: QuranCacheService, useValue: cache },
        { provide: AnalyticsTrackingService, useValue: analyticsTracking },
        { provide: ReadingService, useValue: readingService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === CONFIG_KEYS.QURAN_FOUNDATION) {
                return {
                  cacheTtl: {
                    chaptersSeconds: 10,
                    versesSeconds: 10,
                    resourcesSeconds: 10,
                    searchSeconds: 10,
                    audioSeconds: 10,
                  },
                };
              }

              throw new Error(`Unexpected key ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(QuranService);
  });

  it('proxies surah list through cache and content client', async () => {
    client.getContent.mockResolvedValue({ chapters: [] });

    await expect(service.getSurahs({ language: 'en' })).resolves.toEqual({
      chapters: [],
    });

    expect(cache.buildKey).toHaveBeenCalledWith(
      'chapters',
      '/chapters',
      expect.objectContaining({ language: 'en' }),
    );
    expect(client.getContent).toHaveBeenCalledWith(
      '/chapters',
      expect.objectContaining({ language: 'en' }),
    );
  });

  it('proxies search through the search client', async () => {
    client.getSearch.mockResolvedValue({ result: {} });

    await expect(
      service.search('user-1', { query: 'fatiha', mode: 'quick' }),
    ).resolves.toEqual({ result: {} });

    expect(client.getSearch).toHaveBeenCalledWith(
      '/search',
      expect.objectContaining({ query: 'fatiha', mode: 'quick' }),
    );
    expect(analyticsTracking.track).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        eventName: 'SEARCH',
      }),
    );
  });
});
