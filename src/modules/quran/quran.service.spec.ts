import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CONFIG_KEYS } from '../../common/constants';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
import { ReadingService } from '../reading/reading.service';
import { QuranCacheService } from './cache/quran-cache.service';
import { QuranFoundationClient } from './client/quran-foundation.client';
import { QfPagesRepository } from './pages/qf-pages.repository';
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
  let pagesRepository: {
    findActiveByMushaf: jest.Mock;
    findActivePage: jest.Mock;
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
    pagesRepository = {
      findActiveByMushaf: jest.fn(),
      findActivePage: jest.fn(),
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
        { provide: QfPagesRepository, useValue: pagesRepository },
        { provide: AnalyticsTrackingService, useValue: analyticsTracking },
        { provide: ReadingService, useValue: readingService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === CONFIG_KEYS.QURAN_FOUNDATION) {
                return {
                  audioCdnBase: 'https://audio.qurancdn.com',
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

  it('returns static mushaf metadata', () => {
    const result = service.getMushafs();
    expect(result.mushafs.some((m) => m.id === 19)).toBe(true);
    expect(result.mushafs.some((m) => m.id === 1)).toBe(true);
  });

  it('lists mushaf pages from the local repository', async () => {
    pagesRepository.findActiveByMushaf.mockResolvedValue([
      {
        mushafId: 1,
        pageNumber: 1,
        firstVerseKey: '1:1',
        lastVerseKey: '1:7',
        verseKeys: ['1:1', '1:7'],
        surahIds: [1],
        juzNumber: 1,
        hizbNumber: 1,
        rubElHizbNumber: 1,
        juzNumbers: [1],
        hizbNumbers: [1],
        rubElHizbNumbers: [1],
        verseCount: 2,
        imageUrl: null,
        imageWidth: null,
        syncedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);

    await expect(service.getPages({})).resolves.toMatchObject({
      mushaf_id: 1,
      total: 1,
      pages: [
        expect.objectContaining({ page_number: 1, first_verse_key: '1:1' }),
      ],
    });
  });

  it('applies default division fields when fetching page verses', async () => {
    client.getContent.mockResolvedValue({ verses: [] });

    await service.getPageVerses(1, {});

    expect(client.getContent).toHaveBeenCalledWith('/verses/by_page/1', {
      mushaf: 1,
      fields: 'page_number,juz_number,hizb_number,rub_el_hizb_number',
    });
  });

  it('rejects unsupported script names', async () => {
    await expect(service.getScript('not-a-script', {})).rejects.toThrow(
      /Unsupported Quran script/,
    );
  });

  it('normalizes relative ayah audio urls', async () => {
    client.getContent.mockResolvedValue({
      audio_files: [{ verse_key: '1:1', url: 'Alafasy/mp3/001001.mp3' }],
    });

    await expect(service.getAyahAudioByKey(7, '1:1')).resolves.toEqual({
      audio_files: [
        {
          verse_key: '1:1',
          url: 'https://audio.qurancdn.com/Alafasy/mp3/001001.mp3',
        },
      ],
    });
  });
});
