import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../common/constants';
import { resolveDailyAyahForDate } from '../../common/quran/daily-ayah';
import { QuranFoundationConfig } from '../../config/configuration';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
import { formatLocalDate } from '../reading/utils/reading-date.utils';
import { QuranCacheService } from './cache/quran-cache.service';
import { QuranFoundationClient } from './client/quran-foundation.client';
import { DailyAyahResponseDto } from './dto/daily-ayah-response.dto';
import {
  AudioTimestampQueryDto,
  LanguageQueryDto,
  PageLookupQueryDto,
  PaginationQueryDto,
  SearchQueryDto,
  VersesQueryDto,
} from './dto/quran-query.dto';
import {
  QuranQueryParams,
  QuranQueryValue,
} from './interfaces/quran-foundation.interface';

@Injectable()
export class QuranService {
  private readonly config: QuranFoundationConfig;

  constructor(
    private readonly client: QuranFoundationClient,
    private readonly cache: QuranCacheService,
    private readonly configService: ConfigService,
    private readonly analyticsTracking: AnalyticsTrackingService,
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
    );
  }

  getAyahByKey(verseKey: string, query: VersesQueryDto): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/verses/by_key/${encodeURIComponent(verseKey)}`,
      this.verseQuery(query),
      this.config.cacheTtl.versesSeconds,
    );
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
    );
  }

  getAyahsByPage(page: number, query: VersesQueryDto): Promise<unknown> {
    return this.cachedContent(
      'verses',
      `/verses/by_page/${page}`,
      this.verseQuery(query),
      this.config.cacheTtl.versesSeconds,
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

  getPages(query: LanguageQueryDto): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      '/pages',
      this.pick(query, ['language']),
      this.config.cacheTtl.chaptersSeconds,
    );
  }

  getPage(pageNumber: number, query: LanguageQueryDto): Promise<unknown> {
    return this.cachedContent(
      'chapters',
      `/pages/${pageNumber}`,
      this.pick(query, ['language']),
      this.config.cacheTtl.chaptersSeconds,
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

  getTranslations(query: LanguageQueryDto): Promise<unknown> {
    return this.cachedContent(
      'resources',
      '/resources/translations',
      this.pick(query, ['language']),
      this.config.cacheTtl.resourcesSeconds,
    );
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

  getRecitations(query: LanguageQueryDto): Promise<unknown> {
    return this.cachedContent(
      'resources',
      '/resources/recitations',
      this.pick(query, ['language']),
      this.config.cacheTtl.resourcesSeconds,
    );
  }

  getChapterReciters(query: LanguageQueryDto): Promise<unknown> {
    return this.cachedContent(
      'resources',
      '/resources/chapter_reciters',
      this.pick(query, ['language']),
      this.config.cacheTtl.resourcesSeconds,
    );
  }

  getChapterAudioFiles(reciterId: number): Promise<unknown> {
    return this.cachedContent(
      'audio',
      `/chapter_recitations/${reciterId}`,
      undefined,
      this.config.cacheTtl.audioSeconds,
    );
  }

  getChapterAudioFile(reciterId: number, chapter: number): Promise<unknown> {
    return this.cachedContent(
      'audio',
      `/chapter_recitations/${reciterId}/${chapter}`,
      undefined,
      this.config.cacheTtl.audioSeconds,
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
    );
  }

  getAyahAudioByKey(recitationId: number, ayahKey: string): Promise<unknown> {
    return this.cachedContent(
      'audio',
      `/recitations/${recitationId}/by_ayah/${encodeURIComponent(ayahKey)}`,
      undefined,
      this.config.cacheTtl.audioSeconds,
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
  ): Promise<unknown> {
    const cacheKey = this.cache.buildKey(namespace, path, query);
    return this.cache.getOrSet(cacheKey, ttlSeconds, () =>
      this.client.getContent<unknown>(path, query),
    );
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
