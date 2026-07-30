import { LanguageQuery, TranslatedName } from './qf-common.types';

export type ChaptersQuery = LanguageQuery;

/** Wire: chapters[] item */
export interface QfChapter {
  id: number;
  revelationPlace: string;
  revelationOrder: number;
  bismillahPre: boolean;
  nameSimple: string;
  nameComplex: string;
  nameArabic: string;
  versesCount: number;
  pages: number[];
  translatedName?: TranslatedName;
}

export interface ChaptersResponse {
  chapters: QfChapter[];
}

export interface ChapterResponse {
  chapter: QfChapter;
}

/** Chapter info payloads vary; keep extensible until live samples harden fields */
export interface ChapterInfoResponse {
  chapterInfo: Record<string, unknown>;
}

export interface QfJuz {
  id: number;
  juzNumber: number;
  verseMapping?: Record<string, string>;
  firstVerseId?: number;
  lastVerseId?: number;
  versesCount?: number;
}

export interface JuzsResponse {
  juzs: QfJuz[];
}

export interface JuzResponse {
  juz: QfJuz;
}

export interface QfPage {
  id?: number;
  pageNumber: number;
  [key: string]: unknown;
}

export interface PagesResponse {
  pages: QfPage[];
}

export interface PageResponse {
  page: QfPage;
}

export interface PageLookupQuery {
  mushaf?: string;
  chapterNumber?: number;
  juzNumber?: number;
  pageNumber?: number;
  from?: string;
  to?: string;
}

export type PageLookupResponse = Record<string, unknown>;
