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
    countActive: jest.Mock;
  };
  let catalogRepository: {
    listActiveTranslations: jest.Mock;
    listActiveTafsirs: jest.Mock;
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
      countActive: jest.fn().mockResolvedValue(0),
    };
    catalogRepository = {
      listActiveTranslations: jest.fn().mockResolvedValue([]),
      listActiveTafsirs: jest.fn().mockResolvedValue([]),
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
                  tajweedPageImageBase:
                    'https://www.noureddin.dev/quran-pages/2/pages/776x1053-webp',
                  tajweedPageImageExt: 'webp',
                  madina1405PageImageBase: '',
                  madina1405PageImageExt: 'webp',
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

  it('omits mushaf 1405 when image base is not configured', async () => {
    const result = await service.getMushafs();
    expect(result.mushafs.some((m) => m.id === 19)).toBe(true);
    expect(result.mushafs.some((m) => m.id === 1)).toBe(true);
    expect(result.mushafs.some((m) => m.id === 10)).toBe(true);
    expect(result.mushafs.some((m) => m.id === 1405)).toBe(false);
    const standard = result.mushafs.filter((m) => m.isStandard);
    expect(standard).toHaveLength(1);
    expect(standard[0]?.id).toBe(10);
    expect(pagesRepository.countActive).not.toHaveBeenCalled();
  });

  it('includes mushaf 1405 when image base is set and 604 pages are synced', async () => {
    (
      service as unknown as {
        config: { madina1405PageImageBase: string };
      }
    ).config.madina1405PageImageBase =
      'https://api.example/uploads/mushaf/1405';
    pagesRepository.countActive.mockResolvedValue(604);

    const result = await service.getMushafs();
    expect(result.mushafs.some((m) => m.id === 1405)).toBe(true);
    expect(pagesRepository.countActive).toHaveBeenCalledWith(1405);
  });

  it('omits mushaf 1405 when image base is set but pages are not synced', async () => {
    (
      service as unknown as {
        config: { madina1405PageImageBase: string };
      }
    ).config.madina1405PageImageBase =
      'https://api.example/uploads/mushaf/1405';
    pagesRepository.countActive.mockResolvedValue(0);

    const result = await service.getMushafs();
    expect(result.mushafs.some((m) => m.id === 1405)).toBe(false);
    expect(pagesRepository.countActive).toHaveBeenCalledWith(1405);
  });
  it('heals stale verse-strip imageUrl on GET page cache hits', async () => {
    cache.getOrSet.mockResolvedValue({
      pageNumber: 1,
      mushafId: 1,
      firstVerseKey: '1:1',
      lastVerseKey: '1:7',
      verseCount: 7,
      surahIds: [1],
      juzNumber: 1,
      hizbNumber: 1,
      rubElHizb: 1,
      juzNumbers: [1],
      hizbNumbers: [1],
      rubElHizbNumbers: [1],
      verses: ['1:1'],
      imageUrl: 'https://c22506.r6.cf1.rackcdn.com/1_1.png',
      imageWidth: 675,
      syncedAt: '2026-08-01T00:00:00.000Z',
    });

    await expect(service.getPage(1, {})).resolves.toEqual(
      expect.objectContaining({
        imageUrl: null,
        imageWidth: null,
      }),
    );
  });

  it('heals stale verse-strip imageUrl on GET page verses cache hits', async () => {
    cache.getOrSet.mockResolvedValue({
      page: {
        pageNumber: 1,
        mushafId: 1,
        firstVerseKey: '1:1',
        lastVerseKey: '1:7',
        verseCount: 7,
        surahIds: [1],
        juzNumber: 1,
        hizbNumber: 1,
        rubElHizb: 1,
        juzNumbers: [1],
        hizbNumbers: [1],
        rubElHizbNumbers: [1],
        verses: ['1:1'],
        imageUrl: 'https://c22506.r6.cf1.rackcdn.com/1_1.png',
        imageWidth: 675,
        syncedAt: '2026-08-01T00:00:00.000Z',
      },
      verses: [{ verse_key: '1:1' }],
      pagination: { complete: true },
    });

    const result = (await service.getPageVerses(1, {})) as {
      page: { imageUrl: string | null; imageWidth: number | null };
    };

    expect(result.page.imageUrl).toBeNull();
    expect(result.page.imageWidth).toBeNull();
  });

  it('attaches Dar al-Marefa page art for mushaf 10 on verses cache hits', async () => {
    cache.getOrSet.mockResolvedValue({
      page: {
        pageNumber: 1,
        mushafId: 10,
        firstVerseKey: '1:1',
        lastVerseKey: '1:7',
        verseCount: 7,
        surahIds: [1],
        juzNumber: 1,
        hizbNumber: 1,
        rubElHizb: 1,
        juzNumbers: [1],
        hizbNumbers: [1],
        rubElHizbNumbers: [1],
        verses: ['1:1'],
        imageUrl: null,
        imageWidth: null,
        syncedAt: '2026-08-01T00:00:00.000Z',
      },
      verses: [{ verse_key: '1:1' }],
      pagination: { complete: true },
    });

    const result = (await service.getPageVerses(1, { mushaf: '10' })) as {
      page: { imageUrl: string | null; imageWidth: number | null };
    };

    expect(result.page.imageUrl).toBe(
      'https://www.noureddin.dev/quran-pages/2/pages/776x1053-webp/1.webp',
    );
    expect(result.page.imageWidth).toBe(776);
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

    await expect(service.getPages({})).resolves.toEqual({
      pages: [
        {
          page: 1,
          firstVerse: '1:1',
          lastVerse: '1:7',
          verseCount: 2,
        },
      ],
      total: 1,
      totalPages: 1,
    });
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
      verses: [
        { verse_key: '1:1', text_uthmani: 'بِسْمِ' },
        { verse_key: '1:7', text_uthmani: 'صِرَٰط' },
      ],
      pagination: {
        per_page: 50,
        current_page: 1,
        next_page: null,
        total_pages: 1,
        total_records: 2,
      },
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
      verses: [
        { verse_key: '1:1', text_uthmani: 'بِسْمِ' },
        { verse_key: '1:7', text_uthmani: 'صِرَٰط' },
      ],
      pagination: {
        per_page: 50,
        current_page: 1,
        next_page: null,
        total_pages: 1,
        total_records: 2,
        complete: true,
      },
    });

    expect(client.getContent).toHaveBeenCalledWith('/verses/by_page/1', {
      mushaf: 1,
      fields:
        'text_uthmani,chapter_id,verse_number,verse_key,page_number,juz_number,hizb_number,rub_el_hizb_number,sajdah_number,sajdah_type',
      words: 'true',
      per_page: 50,
      page: 1,
    });
    expect(cache.pageVersesKey).toHaveBeenCalled();
  });

  it('follows QF pagination until page verseCount is complete', async () => {
    pagesRepository.findActivePage.mockResolvedValue({
      mushafId: 1,
      pageNumber: 604,
      firstVerseKey: '112:1',
      lastVerseKey: '114:6',
      verseKeys: Array.from({ length: 15 }, (_, i) => `x:${i + 1}`),
      surahIds: [112, 113, 114],
      juzNumber: 30,
      hizbNumber: 60,
      rubElHizbNumber: 240,
      juzNumbers: [30],
      hizbNumbers: [60],
      rubElHizbNumbers: [240],
      verseCount: 15,
      imageUrl: null,
      imageWidth: null,
      syncedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    client.getContent
      .mockResolvedValueOnce({
        verses: Array.from({ length: 10 }, (_, i) => ({
          verse_key: `112:${i + 1}`,
        })),
        pagination: {
          per_page: 10,
          current_page: 1,
          next_page: 2,
          total_pages: 2,
          total_records: 15,
        },
      })
      .mockResolvedValueOnce({
        verses: Array.from({ length: 5 }, (_, i) => ({
          verse_key: `114:${i + 1}`,
        })),
        pagination: {
          per_page: 10,
          current_page: 2,
          next_page: null,
          total_pages: 2,
          total_records: 15,
        },
      });

    const result = (await service.getPageVerses(604, {
      per_page: 10,
    })) as { verses: unknown[]; pagination: { complete: boolean } };

    expect(result.verses).toHaveLength(15);
    expect(result.pagination.complete).toBe(true);
    expect(client.getContent).toHaveBeenCalledTimes(2);
    expect(client.getContent).toHaveBeenNthCalledWith(1, '/verses/by_page/604', {
      mushaf: 1,
      fields:
        'text_uthmani,chapter_id,verse_number,verse_key,page_number,juz_number,hizb_number,rub_el_hizb_number,sajdah_number,sajdah_type',
      words: 'true',
      per_page: 10,
      page: 1,
    });
    expect(client.getContent).toHaveBeenNthCalledWith(2, '/verses/by_page/604', {
      mushaf: 1,
      fields:
        'text_uthmani,chapter_id,verse_number,verse_key,page_number,juz_number,hizb_number,rub_el_hizb_number,sajdah_number,sajdah_type',
      words: 'true',
      per_page: 10,
      page: 2,
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
        isDefault: true,
        sortOrder: 0,
        metadata: { id: 85, name: 'Mufti Taqi', language_name: 'uzbek' },
      },
    ]);

    await expect(service.getTranslations({ language: 'uz' })).resolves.toEqual({
      translations: [
        expect.objectContaining({
          id: 85,
          name: 'Mufti Taqi',
          language_name: 'uzbek',
          is_default: true,
          sort_order: 0,
        }),
      ],
    });

    expect(catalogRepository.listActiveTranslations).toHaveBeenCalledWith({
      languageCode: 'uz',
    });
    expect(client.getContent).not.toHaveBeenCalled();
  });

  it('lists active tafsirs from local catalog (not QF)', async () => {
    catalogRepository.listActiveTafsirs.mockResolvedValue([
      {
        id: 'uuid-t',
        externalId: '169',
        name: 'Ibn Kathir',
        authorName: null,
        slug: null,
        languageCode: 'en',
        sortOrder: 1,
        metadata: { id: 169, name: 'Ibn Kathir' },
      },
    ]);

    await expect(service.getTafsirs({})).resolves.toEqual({
      tafsirs: [
        expect.objectContaining({
          id: 169,
          name: 'Ibn Kathir',
          sort_order: 1,
        }),
      ],
    });

    expect(catalogRepository.listActiveTafsirs).toHaveBeenCalledWith(undefined);
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
        isPopular: true,
        sortOrder: 2,
        metadata: { id: 7, reciter_name: 'Alafasy', source: 'recitations' },
      },
    ]);

    await expect(service.getRecitations({})).resolves.toEqual({
      recitations: [
        expect.objectContaining({
          id: 7,
          reciter_name: 'Alafasy',
          is_popular: true,
          sort_order: 2,
        }),
      ],
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
        isPopular: false,
        sortOrder: 0,
        metadata: {
          id: 7,
          name: 'Alafasy',
          source: 'chapter_reciters',
        },
      },
    ]);

    await expect(service.getChapterReciters({})).resolves.toEqual({
      reciters: [
        expect.objectContaining({
          id: 7,
          name: 'Alafasy',
          is_popular: false,
          sort_order: 0,
        }),
      ],
    });

    expect(catalogRepository.listActiveReciters).toHaveBeenCalledWith({
      kind: 'CHAPTER',
    });
    expect(client.getContent).not.toHaveBeenCalled();
  });
});
