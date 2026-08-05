import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../common/constants';
import { resolveDailyAyahForDate } from '../../common/quran/daily-ayah';
import { QuranFoundationConfig } from '../../config/configuration';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
import { ReadingService } from '../reading/reading.service';
import { formatLocalDate } from '../reading/utils/reading-date.utils';
import { QuranCacheService } from './cache/quran-cache.service';
import {
  toQfReciterResource,
  toQfTranslationResource,
} from './catalog/qf-catalog-list.mapper';
import { mapLanguageNameToCode } from './catalog/qf-catalog.mapper';
import { QfCatalogRepository } from './catalog/qf-catalog.repository';
import { QuranFoundationClient } from './client/quran-foundation.client';
import { DailyAyahResponseDto } from './dto/daily-ayah-response.dto';
import {
  AudioTimestampQueryDto,
  LanguageQueryDto,
  MushafPagesQueryDto,
  PageLookupQueryDto,
  PaginationQueryDto,
  ScriptQueryDto,
  SearchQueryDto,
  VersesQueryDto,
} from './dto/quran-query.dto';
import {
  QuranQueryParams,
  QuranQueryValue,
} from './interfaces/quran-foundation.interface';
import {
  isQfMushafId,
  isQfScriptName,
  QF_MUSHAF_RESOURCES,
} from './mushafs/qf-mushafs';
import {
  DEFAULT_MUSHAF_ID,
  DEFAULT_PAGE_VERSE_FIELDS,
  DEFAULT_PAGE_VERSE_PER_PAGE,
  DEFAULT_PAGE_WORDS,
  MADANI_MUSHAF_PAGE_COUNT,
} from './pages/qf-pages.constants';
import {
  toMushafPageDetail,
  toMushafPageListItem,
} from './pages/qf-pages.mapper';
import { QfPagesRepository } from './pages/qf-pages.repository';
import { normalizeQfMediaUrls } from './utils/qf-media-url.normalizer';

@Injectable()
export class QuranService {
  private readonly config: QuranFoundationConfig;

  constructor(
    private readonly client: QuranFoundationClient,
    private readonly cache: QuranCacheService,
    private readonly configService: ConfigService,
    private readonly analyticsTracking: AnalyticsTrackingService,
    private readonly readingService: ReadingService,
    private readonly pagesRepository: QfPagesRepository,
    private readonly catalogRepository: QfCatalogRepository,
  ) {
    this.config = this.configService.getOrThrow<QuranFoundationConfig>(
      CONFIG_KEYS.QURAN_FOUNDATION,
    );
  }

  getSurahs(query: LanguageQueryDto): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      '/chapters',
      this.pick(query, ['language']),
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getSurah(id: number, query: LanguageQueryDto): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      `/chapters/${id}`,
      this.pick(query, ['language']),
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getSurahInfo(id: number, query: LanguageQueryDto): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      `/chapters/${id}/info`,
      this.pick(query, ['language']),
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getAyahsBySurah(chapter: number, query: VersesQueryDto): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/verses/by_chapter/${chapter}`,
      this.verseQuery(query),
      this.config.cacheTtl.versesSeconds,
      true,
    );
  }

  getAyahByKey(verseKey: string, query: VersesQueryDto): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/verses/by_key/${encodeURIComponent(verseKey)}`,
      this.verseQuery(query),
      this.config.cacheTtl.versesSeconds,
      true,
    );
  }

  /**
   * Fetch ayah by key and record reading progress for the authenticated user.
   * Side effect retained for Mini App compatibility (GET remains non-idempotent).
   */
  async getAyahByKeyForUser(
    userId: string,
    verseKey: string,
    query: VersesQueryDto,
  ): Promise<unknown> {
    const content = await this.getAyahByKey(verseKey, query);
    await this.readingService.recordAyahOpen(userId, verseKey);
    return content;
  }

  async getDailyAyahForUser(
    userId: string,
    query: VersesQueryDto,
    now: Date = new Date(),
  ): Promise<DailyAyahResponseDto> {
    const timezone = await this.readingService.getTimezone(userId);
    return this.getDailyAyah(userId, timezone, query, now);
  }

  async getDailyAyah(
    userId: string,
    timezone: string,
    query: VersesQueryDto,
    now: Date = new Date(),
  ): Promise<DailyAyahResponseDto> {
    const localDate = formatLocalDate(now, timezone);
    const coordinate = resolveDailyAyahForDate(localDate);
    const content = await this.getAyahByKey(coordinate.verseKey, query);

    await this.analyticsTracking.track({
      userId,
      eventName: 'DAILY_AYAH',
      properties: {
        chapterNumber: coordinate.chapterNumber,
        verseNumber: coordinate.verseNumber,
        verseKey: coordinate.verseKey,
        localDate,
        timezone,
      },
    });

    return {
      localDate,
      timezone,
      verseKey: coordinate.verseKey,
      chapterNumber: coordinate.chapterNumber,
      verseNumber: coordinate.verseNumber,
      content,
    };
  }

  getAyahsByJuz(juz: number, query: VersesQueryDto): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/verses/by_juz/${juz}`,
      this.verseQuery(query),
      this.config.cacheTtl.versesSeconds,
      true,
    );
  }

  getAyahsByPage(page: number, query: VersesQueryDto): Promise<unknown> {
    this.assertMadaniPageNumber(page);
    return this.getPageVerses(page, query);
  }

  getAyahsByHizb(hizb: number, query: VersesQueryDto): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/verses/by_hizb/${hizb}`,
      this.verseQuery(query),
      this.config.cacheTtl.versesSeconds,
      true,
    );
  }

  getAyahsByRub(rub: number, query: VersesQueryDto): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/verses/by_rub/${rub}`,
      this.verseQuery(query),
      this.config.cacheTtl.versesSeconds,
      true,
    );
  }

  getAyahsByRubElHizb(rub: number, query: VersesQueryDto): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/verses/by_rub_el_hizb/${rub}`,
      this.verseQuery(query),
      this.config.cacheTtl.versesSeconds,
      true,
    );
  }

  getAyahsByRuku(ruku: number, query: VersesQueryDto): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/verses/by_ruku/${ruku}`,
      this.verseQuery(query),
      this.config.cacheTtl.versesSeconds,
      true,
    );
  }

  getAyahsByManzil(manzil: number, query: VersesQueryDto): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/verses/by_manzil/${manzil}`,
      this.verseQuery(query),
      this.config.cacheTtl.versesSeconds,
      true,
    );
  }

  getJuzs(): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      '/juzs',
      undefined,
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getJuz(id: number): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      `/juzs/${id}`,
      undefined,
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  /**
   * Local synced Madani page index (not live QF GET /pages).
   * Empty DB → 404 until `npm run qf:sync-pages`.
   */
  getPages(query: MushafPagesQueryDto): Promise<unknown> {
    const mushafId = this.resolveMushafId(query.mushaf);
    const cacheKey = this.cache.pagesListKey(mushafId);

    return this.cache.getOrSet(
      cacheKey,
      this.config.cacheTtl.chaptersSeconds,
      async () => {
        const pages = await this.pagesRepository.findActiveByMushaf(mushafId);
        if (pages.length === 0) {
          throw new NotFoundException(
            `No mushaf pages synced for mushaf=${mushafId}. Run npm run qf:sync-pages.`,
          );
        }
        const list = pages.map((row) => toMushafPageListItem(row));
        const total = list.length;
        return {
          pages: list,
          total,
          totalPages: total,
        };
      },
    ).then((cached) => this.normalizePagesListPayload(cached));
  }

  /** Accept legacy cached bare arrays from older sync warmers. */
  private normalizePagesListPayload(cached: unknown): {
    pages: unknown[];
    total: number;
    totalPages: number;
  } {
    if (Array.isArray(cached)) {
      return {
        pages: cached,
        total: cached.length,
        totalPages: cached.length,
      };
    }
    if (cached && typeof cached === 'object') {
      const body = cached as {
        pages?: unknown[];
        total?: number;
        totalPages?: number;
      };
      const pages = Array.isArray(body.pages) ? body.pages : [];
      const total =
        typeof body.total === 'number'
          ? body.total
          : typeof body.totalPages === 'number'
            ? body.totalPages
            : pages.length;
      return {
        pages,
        total,
        totalPages:
          typeof body.totalPages === 'number' ? body.totalPages : total,
      };
    }
    return { pages: [], total: 0, totalPages: 0 };
  }

  getPage(pageNumber: number, query: MushafPagesQueryDto): Promise<unknown> {
    this.assertMadaniPageNumber(pageNumber);
    const mushafId = this.resolveMushafId(query.mushaf);
    const cacheKey = this.cache.pageMetadataKey(pageNumber, mushafId);

    return this.cache.getOrSet(
      cacheKey,
      this.config.cacheTtl.chaptersSeconds,
      async () => {
        const row = await this.pagesRepository.findActivePage(
          mushafId,
          pageNumber,
        );
        if (!row) {
          throw new NotFoundException(
            `Mushaf page ${pageNumber} (mushaf=${mushafId}) not found. Run npm run qf:sync-pages.`,
          );
        }
        return toMushafPageDetail(row);
      },
    );
  }

  getPageVerses(page: number, query: VersesQueryDto): Promise<unknown> {
    this.assertMadaniPageNumber(page);
    const mushafId = this.resolveMushafId(
      query.mushaf !== undefined ? Number(query.mushaf) : undefined,
    );
    const params = this.verseQueryWithPageDefaults(query);
    params.mushaf = mushafId;
    const cacheKey = this.cache.pageVersesKey(page, mushafId, params);

    return this.cache.getOrSet(
      cacheKey,
      this.config.cacheTtl.versesSeconds,
      async () => {
        const row = await this.pagesRepository.findActivePage(mushafId, page);
        if (!row) {
          throw new NotFoundException(
            `Mushaf page ${page} (mushaf=${mushafId}) not found. Run npm run qf:sync-pages.`,
          );
        }

        const { verses, pagination } = await this.fetchCompletePageVerses(
          page,
          params,
          row.verseCount,
        );

        return {
          page: toMushafPageDetail(row),
          verses,
          pagination,
        };
      },
    );
  }

  lookupPages(query: PageLookupQueryDto): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      '/pages/lookup',
      this.pick(query, [
        'mushaf',
        'chapter_number',
        'juz_number',
        'page_number',
        'from',
        'to',
      ]),
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getHizbs(): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      '/hizbs',
      undefined,
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getHizb(id: number): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      `/hizbs/${id}`,
      undefined,
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getRubElHizbs(): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      '/rub_el_hizbs',
      undefined,
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getRubElHizb(id: number): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      `/rub_el_hizbs/${id}`,
      undefined,
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getRukus(): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      '/rukus',
      undefined,
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getRuku(id: number): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      `/rukus/${id}`,
      undefined,
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getManzils(): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      '/manzils',
      undefined,
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getManzil(id: number): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      `/manzils/${id}`,
      undefined,
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getLanguages(query: LanguageQueryDto): Promise<unknown> {
    return this.cachedContent(
      'resources',
      '/resources/languages',
      this.pick(query, ['language']),
      this.config.cacheTtl.resourcesSeconds,
    );
  }

  getMushafs(): { mushafs: typeof QF_MUSHAF_RESOURCES } {
    return { mushafs: QF_MUSHAF_RESOURCES };
  }

  async getScript(script: string, query: ScriptQueryDto): Promise<unknown> {
    if (!isQfScriptName(script)) {
      throw new BadRequestException(
        `Unsupported Quran script "${script}". Allowed: uthmani, uthmani_tajweed, uthmani_simple, imlaei, indopak, indopak_nastaleeq, code_v1, code_v2, qpc_hafs`,
      );
    }

    return this.cachedContent(
      'verses',
      `/quran/verses/${script}`,
      this.pick(query, [
        'verse_key',
        'chapter_number',
        'juz_number',
        'page_number',
        'hizb_number',
        'rub_el_hizb_number',
        'ruku_number',
        'manzil_number',
      ]),
      this.config.cacheTtl.versesSeconds,
      true,
    );
  }

  getFootnote(id: number): Promise<unknown> {
    return this.cachedContent(
      'resources',
      `/foot_notes/${id}`,
      undefined,
      this.config.cacheTtl.resourcesSeconds,
    );
  }

  async getTranslations(query: LanguageQueryDto): Promise<unknown> {
    const languageCode = this.resolveCatalogLanguageFilter(query.language);
    const rows = await this.catalogRepository.listActiveTranslations(
      languageCode ? { languageCode } : undefined,
    );
    return {
      translations: rows.map(toQfTranslationResource),
    };
  }

  getTranslationInfo(translationId: number): Promise<unknown> {
    return this.cachedContent(
      'resources',
      `/resources/translations/${translationId}/info`,
      undefined,
      this.config.cacheTtl.resourcesSeconds,
    );
  }

  getTranslationBySurah(
    resourceId: number,
    chapter: number,
    query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/translations/${resourceId}/by_chapter/${chapter}`,
      this.pick(query, ['language', 'page', 'per_page']),
      this.config.cacheTtl.versesSeconds,
    );
  }

  getTranslationByAyah(resourceId: number, ayahKey: string): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/translations/${resourceId}/by_ayah/${encodeURIComponent(ayahKey)}`,
      undefined,
      this.config.cacheTtl.versesSeconds,
    );
  }

  getTranslationByJuz(
    resourceId: number,
    juz: number,
    query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/translations/${resourceId}/by_juz/${juz}`,
      this.pick(query, ['language', 'page', 'per_page']),
      this.config.cacheTtl.versesSeconds,
    );
  }

  getTranslationByPage(
    resourceId: number,
    page: number,
    query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/translations/${resourceId}/by_page/${page}`,
      this.pick(query, ['language', 'page', 'per_page']),
      this.config.cacheTtl.versesSeconds,
    );
  }

  getTafsirs(query: LanguageQueryDto): Promise<unknown> {
    return this.cachedContent(
      'resources',
      '/resources/tafsirs',
      this.pick(query, ['language']),
      this.config.cacheTtl.resourcesSeconds,
    );
  }

  getTafsirInfo(tafsirId: number): Promise<unknown> {
    return this.cachedContent(
      'resources',
      `/resources/tafsirs/${tafsirId}/info`,
      undefined,
      this.config.cacheTtl.resourcesSeconds,
    );
  }

  getTafsirBySurah(
    resourceId: number,
    chapter: number,
    query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/tafsirs/${resourceId}/by_chapter/${chapter}`,
      this.pick(query, ['language', 'page', 'per_page']),
      this.config.cacheTtl.versesSeconds,
    );
  }

  getTafsirByAyah(resourceId: number, ayahKey: string): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/tafsirs/${resourceId}/by_ayah/${encodeURIComponent(ayahKey)}`,
      undefined,
      this.config.cacheTtl.versesSeconds,
    );
  }

  getTafsirByJuz(
    resourceId: number,
    juz: number,
    query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/tafsirs/${resourceId}/by_juz/${juz}`,
      this.pick(query, ['language', 'page', 'per_page']),
      this.config.cacheTtl.versesSeconds,
    );
  }

  getTafsirByPage(
    resourceId: number,
    page: number,
    query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/tafsirs/${resourceId}/by_page/${page}`,
      this.pick(query, ['language', 'page', 'per_page']),
      this.config.cacheTtl.versesSeconds,
    );
  }

  async getRecitations(_query: LanguageQueryDto): Promise<unknown> {
    const rows = await this.catalogRepository.listActiveReciters({
      kind: 'AYAH',
    });
    return {
      recitations: rows.map(toQfReciterResource),
    };
  }

  async getChapterReciters(_query: LanguageQueryDto): Promise<unknown> {
    const rows = await this.catalogRepository.listActiveReciters({
      kind: 'CHAPTER',
    });
    return {
      reciters: rows.map(toQfReciterResource),
    };
  }

  getChapterAudioFiles(reciterId: number): Promise<unknown> {
    return this.cachedContent(
      'audio',
      `/chapter_recitations/${reciterId}`,
      undefined,
      this.config.cacheTtl.audioSeconds,
      true,
    );
  }

  getChapterAudioFile(reciterId: number, chapter: number): Promise<unknown> {
    return this.cachedContent(
      'audio',
      `/chapter_recitations/${reciterId}/${chapter}`,
      { segments: true },
      this.config.cacheTtl.audioSeconds,
      true,
    );
  }

  getAyahAudioBySurah(
    recitationId: number,
    chapter: number,
    query: PaginationQueryDto,
  ): Promise<unknown> {
    return this.cachedContent(
      'audio',
      `/recitations/${recitationId}/by_chapter/${chapter}`,
      this.pick(query, ['page', 'per_page']),
      this.config.cacheTtl.audioSeconds,
      true,
    );
  }

  getAyahAudioByKey(recitationId: number, ayahKey: string): Promise<unknown> {
    return this.cachedContent(
      'audio',
      `/recitations/${recitationId}/by_ayah/${encodeURIComponent(ayahKey)}`,
      undefined,
      this.config.cacheTtl.audioSeconds,
      true,
    );
  }

  getAudioTimestamps(
    reciterId: number,
    query: AudioTimestampQueryDto,
  ): Promise<unknown> {
    return this.cachedContent(
      'audio',
      `/audio/reciters/${reciterId}/timestamp`,
      this.pick(query, ['chapter_number', 'verse_key', 'verse_id', 'word']),
      this.config.cacheTtl.audioSeconds,
    );
  }

  async search(userId: string, query: SearchQueryDto): Promise<unknown> {
    const params = this.pick(query, [
      'query',
      'mode',
      'page',
      'size',
      'translation_ids',
      'navigationalResultsNumber',
      'versesResultsNumber',
      'exact_matches_only',
    ]);

    const cacheKey = this.cache.buildKey('search', '/search', params);
    const result = await this.cache.getOrSet(
      cacheKey,
      this.config.cacheTtl.searchSeconds,
      () => this.client.getSearch<unknown>('/search', params),
    );

    await this.analyticsTracking.track({
      userId,
      eventName: 'SEARCH',
      properties: {
        queryLength: query.query?.length ?? 0,
        source: 'quran-search',
      },
    });

    return result;
  }

  private cachedContent(
    namespace: string,
    path: string,
    query: QuranQueryParams | undefined,
    ttlSeconds: number,
    normalizeMedia = false,
  ): Promise<unknown> {
    const cacheKey = this.cache.buildKey(namespace, path, query);
    return this.cache.getOrSet(cacheKey, ttlSeconds, async () => {
      const payload = await this.client.getContent<unknown>(path, query);
      if (!normalizeMedia) {
        return payload;
      }
      return normalizeQfMediaUrls(payload, this.config.audioCdnBase);
    });
  }

  /**
   * Map optional list `language` query to a DB languageCode filter.
   * Returns undefined when missing/unknown so all active rows are returned.
   */
  private resolveCatalogLanguageFilter(
    language: string | undefined,
  ): string | undefined {
    if (!language?.trim()) {
      return undefined;
    }
    const code = mapLanguageNameToCode(language);
    return code === 'und' ? undefined : code;
  }

  private verseQuery(query: VersesQueryDto): QuranQueryParams {
    return this.pick(query, [
      'language',
      'page',
      'per_page',
      'translations',
      'tafsirs',
      'words',
      'audio',
      'fields',
      'word_fields',
      'translation_fields',
      'tafsir_fields',
      'mushaf',
    ]);
  }

  private verseQueryWithPageDefaults(query: VersesQueryDto): QuranQueryParams {
    const params = this.verseQuery(query);
    if (!params.mushaf) {
      params.mushaf = DEFAULT_MUSHAF_ID;
    }
    params.fields = this.mergeFields(
      typeof params.fields === 'string' ? params.fields : undefined,
      DEFAULT_PAGE_VERSE_FIELDS,
    );
    if (params.words === undefined) {
      params.words = DEFAULT_PAGE_WORDS;
    }
    if (params.per_page === undefined) {
      params.per_page = DEFAULT_PAGE_VERSE_PER_PAGE;
    }
    return params;
  }

  /**
   * Fetch QF `/verses/by_page/{n}` and follow `pagination.next_page` until
   * `expectedCount` ayahs are collected (or no next page).
   */
  private async fetchCompletePageVerses(
    mushafPage: number,
    params: QuranQueryParams,
    expectedCount: number,
  ): Promise<{
    verses: unknown[];
    pagination: {
      per_page?: number;
      current_page?: number;
      next_page?: number | null;
      total_pages?: number;
      total_records: number;
      complete: boolean;
    };
  }> {
    const verses: unknown[] = [];
    let qfPage =
      typeof params.page === 'number' && Number.isFinite(params.page)
        ? params.page
        : 1;
    let lastPagination: Record<string, unknown> | undefined;
    const maxRounds = 20;

    for (let round = 0; round < maxRounds; round += 1) {
      const requestParams: QuranQueryParams = { ...params, page: qfPage };
      const payload = await this.client.getContent<{
        verses?: unknown[];
        pagination?: Record<string, unknown>;
      }>(`/verses/by_page/${mushafPage}`, requestParams);
      const normalized = normalizeQfMediaUrls(
        payload,
        this.config.audioCdnBase,
      ) as {
        verses?: unknown[];
        pagination?: Record<string, unknown>;
      };

      const batch = normalized.verses ?? [];
      verses.push(...batch);
      lastPagination = normalized.pagination;

      if (expectedCount > 0 && verses.length >= expectedCount) {
        break;
      }

      const nextPage = lastPagination?.next_page;
      if (typeof nextPage !== 'number' || !Number.isFinite(nextPage)) {
        break;
      }
      if (nextPage === qfPage) {
        break;
      }
      qfPage = nextPage;
    }

    const complete = expectedCount <= 0 || verses.length >= expectedCount;
    const sliced =
      expectedCount > 0 && verses.length > expectedCount
        ? verses.slice(0, expectedCount)
        : verses;

    return {
      verses: sliced,
      pagination: {
        per_page:
          typeof lastPagination?.per_page === 'number'
            ? lastPagination.per_page
            : typeof params.per_page === 'number'
              ? params.per_page
              : DEFAULT_PAGE_VERSE_PER_PAGE,
        current_page:
          typeof lastPagination?.current_page === 'number'
            ? lastPagination.current_page
            : qfPage,
        next_page:
          typeof lastPagination?.next_page === 'number'
            ? lastPagination.next_page
            : null,
        total_pages:
          typeof lastPagination?.total_pages === 'number'
            ? lastPagination.total_pages
            : undefined,
        total_records: sliced.length,
        complete,
      },
    };
  }

  private mergeFields(
    clientFields: string | undefined,
    defaults: string,
  ): string {
    const parts = new Set<string>();
    for (const field of `${defaults},${clientFields ?? ''}`.split(',')) {
      const trimmed = field.trim();
      if (trimmed) {
        parts.add(trimmed);
      }
    }
    return [...parts].join(',');
  }

  private resolveMushafId(mushaf?: number): number {
    const mushafId = mushaf ?? DEFAULT_MUSHAF_ID;
    if (!isQfMushafId(mushafId)) {
      throw new BadRequestException(
        `Unsupported mushaf id "${mushafId}". Allowed: ${QF_MUSHAF_RESOURCES.map((m) => m.id).join(', ')}`,
      );
    }
    return mushafId;
  }

  private assertMadaniPageNumber(page: number): void {
    if (page < 1 || page > MADANI_MUSHAF_PAGE_COUNT) {
      throw new BadRequestException(
        `Page must be between 1 and ${MADANI_MUSHAF_PAGE_COUNT}`,
      );
    }
  }

  private pick<T extends object>(
    source: T,
    keys: Array<keyof T & string>,
  ): QuranQueryParams {
    const result: QuranQueryParams = {};

    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== '') {
        result[key] = value as QuranQueryValue;
      }
    }

    return result;
  }
}
