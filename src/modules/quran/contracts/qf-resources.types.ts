import { LanguageQuery, TranslatedName } from './qf-common.types';

export type ResourcesLanguageQuery = LanguageQuery;

export interface QfTranslationResource {
  id: number;
  name: string;
  authorName: string;
  slug: string | null;
  languageName: string;
  translatedName?: TranslatedName;
}

export interface TranslationsResponse {
  translations: QfTranslationResource[];
}

export interface TranslationInfoResponse {
  translation?: QfTranslationResource;
  [key: string]: unknown;
}

export interface QfTafsirResource {
  id: number;
  name: string;
  authorName: string;
  slug: string | null;
  languageName: string;
  translatedName?: TranslatedName;
}

export interface TafsirsResponse {
  tafsirs: QfTafsirResource[];
}

export interface TafsirInfoResponse {
  tafsir?: QfTafsirResource;
  [key: string]: unknown;
}

export interface QfRecitationResource {
  id: number;
  reciterName: string;
  style: string | null;
  translatedName?: TranslatedName;
}

export interface RecitationsResponse {
  recitations: QfRecitationResource[];
}

/** Shape soft until authenticated chapter_reciters sample is captured */
export interface QfChapterReciter {
  id: number;
  name?: string;
  reciterName?: string;
  style?: string | null;
  translatedName?: TranslatedName;
  [key: string]: unknown;
}

export interface ChapterRecitersResponse {
  reciters?: QfChapterReciter[];
  chapterReciters?: QfChapterReciter[];
}
