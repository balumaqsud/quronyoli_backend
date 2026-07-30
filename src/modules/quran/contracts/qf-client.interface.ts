import {
  AudioTimestampQuery,
  AudioTimestampsResponse,
  AyahAudioQuery,
  AyahAudioResponse,
  ChapterAudioFileResponse,
  ChapterAudioFilesResponse,
} from './qf-audio.types';
import {
  ChapterInfoResponse,
  ChapterResponse,
  ChaptersQuery,
  ChaptersResponse,
  JuzResponse,
  JuzsResponse,
  PageLookupQuery,
  PageLookupResponse,
  PageResponse,
  PagesResponse,
} from './qf-chapters.types';
import { LanguageQuery, PaginationQuery } from './qf-common.types';
import {
  ChapterRecitersResponse,
  RecitationsResponse,
  ResourcesLanguageQuery,
  TafsirInfoResponse,
  TafsirsResponse,
  TranslationInfoResponse,
  TranslationsResponse,
} from './qf-resources.types';
import { SearchQuery, SearchResponse } from './qf-search.types';
import {
  TafsirContentResponse,
  TranslationContentResponse,
  VerseByKeyResponse,
  VersesQuery,
  VersesResponse,
} from './qf-verses.types';

/**
 * Design-only Content + Search client surface.
 * Token acquisition stays in QuranFoundationTokenService.
 * Today's Axios QuranFoundationClient is a thin GET proxy and will later implement this.
 */
export interface QuranFoundationClientContract {
  getChapters(params?: ChaptersQuery): Promise<ChaptersResponse>;
  getChapter(id: number, params?: LanguageQuery): Promise<ChapterResponse>;
  getChapterInfo(
    id: number,
    params?: LanguageQuery,
  ): Promise<ChapterInfoResponse>;

  getVersesByChapter(
    chapter: number,
    params?: VersesQuery,
  ): Promise<VersesResponse>;
  getVersesByKey(
    verseKey: string,
    params?: VersesQuery,
  ): Promise<VerseByKeyResponse>;
  getVersesByJuz(juz: number, params?: VersesQuery): Promise<VersesResponse>;
  getVersesByPage(page: number, params?: VersesQuery): Promise<VersesResponse>;

  getJuzs(): Promise<JuzsResponse>;
  getJuz(id: number): Promise<JuzResponse>;

  getPages(params?: LanguageQuery): Promise<PagesResponse>;
  getPage(pageNumber: number, params?: LanguageQuery): Promise<PageResponse>;
  lookupPages(params?: PageLookupQuery): Promise<PageLookupResponse>;

  getTranslations(
    params?: ResourcesLanguageQuery,
  ): Promise<TranslationsResponse>;
  getTranslationInfo(translationId: number): Promise<TranslationInfoResponse>;
  getTranslationByChapter(
    resourceId: number,
    chapter: number,
    params?: PaginationQuery,
  ): Promise<TranslationContentResponse>;
  getTranslationByAyah(
    resourceId: number,
    ayahKey: string,
  ): Promise<TranslationContentResponse>;
  getTranslationByJuz(
    resourceId: number,
    juz: number,
    params?: PaginationQuery,
  ): Promise<TranslationContentResponse>;
  getTranslationByPage(
    resourceId: number,
    page: number,
    params?: PaginationQuery,
  ): Promise<TranslationContentResponse>;

  getTafsirs(params?: ResourcesLanguageQuery): Promise<TafsirsResponse>;
  getTafsirInfo(tafsirId: number): Promise<TafsirInfoResponse>;
  getTafsirByChapter(
    resourceId: number,
    chapter: number,
    params?: PaginationQuery,
  ): Promise<TafsirContentResponse>;
  getTafsirByAyah(
    resourceId: number,
    ayahKey: string,
  ): Promise<TafsirContentResponse>;
  getTafsirByJuz(
    resourceId: number,
    juz: number,
    params?: PaginationQuery,
  ): Promise<TafsirContentResponse>;
  getTafsirByPage(
    resourceId: number,
    page: number,
    params?: PaginationQuery,
  ): Promise<TafsirContentResponse>;

  getRecitations(params?: ResourcesLanguageQuery): Promise<RecitationsResponse>;
  getChapterReciters(
    params?: ResourcesLanguageQuery,
  ): Promise<ChapterRecitersResponse>;
  getChapterAudioFiles(reciterId: number): Promise<ChapterAudioFilesResponse>;
  getChapterAudioFile(
    reciterId: number,
    chapter: number,
  ): Promise<ChapterAudioFileResponse>;
  getAyahAudioByChapter(
    recitationId: number,
    chapter: number,
    params?: AyahAudioQuery,
  ): Promise<AyahAudioResponse>;
  getAyahAudioByKey(
    recitationId: number,
    ayahKey: string,
  ): Promise<AyahAudioResponse>;
  getAudioTimestamps(
    reciterId: number,
    params?: AudioTimestampQuery,
  ): Promise<AudioTimestampsResponse>;

  search(params: SearchQuery): Promise<SearchResponse>;
}
