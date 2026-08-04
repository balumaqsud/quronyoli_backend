import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CONFIG_KEYS } from '../../common/constants';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
import { ReadingService } from '../reading/reading.service';
import { QuranCacheService } from './cache/quran-cache.service';
import { QfCatalogRepository } from './catalog/qf-catalog.repository';
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
    pagesListKey: jest.Mock;
    pageMetadataKey: jest.Mock;
    pageVersesKey: jest.Mock;
  };
  let pagesRepository: {
    findActiveByMushaf: jest.Mock;
    findActivePage: jest.Mock;
  };
  let catalogRepository: {
    listActiveTranslations: jest.Mock;
    listActiveReciters: jest.Mock;
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
      pagesListKey: jest.fn().mockReturnValue('pages:list'),
      pageMetadataKey: jest.fn().mockReturnValue('page:1'),
      pageVersesKey: jest.fn().mockReturnValue('page:1:verses:digest'),
    };
    pagesRepository = {
      findActiveByMushaf: jest.fn(),
      findActivePage: jest.fn(),
    };
    catalogRepository = {
      listActiveTranslations: jest.fn().mockResolvedValue([]),
      listActiveReciters: jest.fn().mockResolvedValue([]),
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
        { provide: QfCatalogRepository, useValue: catalogRepository },
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

    await expect(service.getPages({})).resolves.toEqual([
      {
        page: 1,
        firstVerse: '1:1',
        lastVerse: '1:7',
        verseCount: 2,
      },
    ]);
    expect(cache.pagesListKey).toHaveBeenCalledWith(1);
  });

  it('composes page metadata with QF verses and applies defaults', async () => {
    pagesRepository.findActivePage.mockResolvedValue({
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
    });
    client.getContent.mockResolvedValue({
      verses: [{ verse_key: '1:1', text_uthmani: 'بِسْمِ' }],
    });

    const result = await service.getPageVerses(1, {});

    expect(result).toEqual({
      page: {
        pageNumber: 1,
        mushafId: 1,
        firstVerseKey: '1:1',
        lastVerseKey: '1:7',
        verseCount: 2,
        surahIds: [1],
        juzNumber: 1,
        hizbNumber: 1,
        rubElHizb: 1,
        juzNumbers: [1],
        hizbNumbers: [1],
        rubElHizbNumbers: [1],
        verses: ['1:1', '1:7'],
        imageUrl: null,
        imageWidth: null,
        syncedAt: '2026-08-01T00:00:00.000Z',
      },
      verses: [{ verse_key: '1:1', text_uthmani: 'بِسْمِ' }],
    });

    expect(client.getContent).toHaveBeenCalledWith('/verses/by_page/1', {
      mushaf: 1,
      fields:
        'text_uthmani,page_number,juz_number,hizb_number,rub_el_hizb_number',
      words: 'true',
    });
    expect(cache.pageVersesKey).toHaveBeenCalled();
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

  it('requests chapter audio with segments=true for ayah timestamps', async () => {
    client.getContent.mockResolvedValue({
      audio_file: {
        id: 911,
        chapter_id: 101,
        audio_url:
          'https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/101.mp3',
        timestamps: [
          {
            verse_key: '101:1',
            timestamp_from: 0,
            timestamp_to: 2500,
          },
        ],
      },
    });

    await expect(service.getChapterAudioFile(7, 101)).resolves.toEqual({
      audio_file: {
        id: 911,
        chapter_id: 101,
        audio_url:
          'https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/101.mp3',
        timestamps: [
          {
            verse_key: '101:1',
            timestamp_from: 0,
            timestamp_to: 2500,
          },
        ],
      },
    });

    expect(cache.buildKey).toHaveBeenCalledWith(
      'audio',
      '/chapter_recitations/7/101',
      { segments: true },
    );
    expect(client.getContent).toHaveBeenCalledWith(
      '/chapter_recitations/7/101',
      { segments: true },
    );
  });

  it('lists active translations from local catalog (not QF)', async () => {
    catalogRepository.listActiveTranslations.mockResolvedValue([
      {
        id: 'uuid-1',
        externalId: '85',
        name: 'Mufti Taqi',
        authorName: 'Taqi',
        slug: null,
        languageCode: 'uz',
        metadata: { id: 85, name: 'Mufti Taqi', language_name: 'uzbek' },
      },
    ]);

    await expect(service.getTranslations({ language: 'uz' })).resolves.toEqual({
      translations: [
        expect.objectContaining({
          id: 85,
          name: 'Mufti Taqi',
          language_name: 'uzbek',
        }),
      ],
    });

    expect(catalogRepository.listActiveTranslations).toHaveBeenCalledWith({
      languageCode: 'uz',
    });
    expect(client.getContent).not.toHaveBeenCalled();
  });

  it('lists active ayah recitations from local catalog', async () => {
    catalogRepository.listActiveReciters.mockResolvedValue([
      {
        id: 'uuid-r',
        externalId: '7',
        name: 'Alafasy',
        arabicName: null,
        style: null,
        slug: null,
        metadata: { id: 7, reciter_name: 'Alafasy', source: 'recitations' },
      },
    ]);

    await expect(service.getRecitations({})).resolves.toEqual({
      recitations: [expect.objectContaining({ id: 7, reciter_name: 'Alafasy' })],
    });

    expect(catalogRepository.listActiveReciters).toHaveBeenCalledWith({
      kind: 'AYAH',
    });
    expect(client.getContent).not.toHaveBeenCalled();
  });

  it('lists active chapter reciters from local catalog', async () => {
    catalogRepository.listActiveReciters.mockResolvedValue([
      {
        id: 'uuid-c',
        externalId: '7',
        name: 'Alafasy',
        arabicName: null,
        style: null,
        slug: null,
        metadata: {
          id: 7,
          name: 'Alafasy',
          source: 'chapter_reciters',
        },
      },
    ]);

    await expect(service.getChapterReciters({})).resolves.toEqual({
      reciters: [expect.objectContaining({ id: 7, name: 'Alafasy' })],
    });

    expect(catalogRepository.listActiveReciters).toHaveBeenCalledWith({
      kind: 'CHAPTER',
    });
    expect(client.getContent).not.toHaveBeenCalled();
  });
});
