import { PaginationQuery, QfPagination } from './qf-common.types';

/**
 * Verse list query. Wire names: translations, tafsirs, words, audio, fields,
 * word_fields, translation_fields, tafsir_fields, mushaf, per_page.
 */
export interface VersesQuery extends PaginationQuery {
  /** Comma-separated translation resource IDs */
  translations?: string;
  tafsirs?: string;
  words?: string;
  audio?: string;
  fields?: string;
  wordFields?: string;
  translationFields?: string;
  tafsirFields?: string;
  mushaf?: string;
}

export interface QfWordTranslation {
  text: string;
  languageName: string;
}

export interface QfWord {
  id: number;
  position: number;
  audioUrl?: string | null;
  charTypeName?: string;
  lineNumber?: number;
  pageNumber?: number;
  codeV1?: string;
  text?: string;
  translation?: QfWordTranslation;
  transliteration?:
    QfWordTranslation | { text: string | null; languageName: string };
}

export interface QfVerseTranslation {
  resourceId: number;
  resourceName?: string;
  text: string;
  id?: number;
}

export interface QfVerseTafsir {
  id: number;
  resourceId?: number;
  languageName?: string;
  name?: string;
  text: string;
}

export interface QfVerseAudio {
  verseKey: string;
  url: string;
}

/** Wire: verses[] item (fields present depend on query) */
export interface QfVerse {
  id: number;
  chapterId?: number;
  verseNumber: number;
  verseKey: string;
  verseIndex?: number;
  textUthmani?: string;
  textUthmaniSimple?: string;
  textImlaei?: string;
  textImlaeiSimple?: string;
  textIndopak?: string;
  textUthmaniTajweed?: string;
  juzNumber?: number;
  hizbNumber?: number;
  rubElHizbNumber?: number;
  pageNumber?: number;
  rukuNumber?: number;
  manzilNumber?: number;
  sajdahType?: string | null;
  sajdahNumber?: number | null;
  imageUrl?: string;
  imageWidth?: number;
  words?: QfWord[];
  translations?: QfVerseTranslation[];
  tafsirs?: QfVerseTafsir[];
  audio?: QfVerseAudio;
}

export interface VersesResponse {
  verses: QfVerse[];
  pagination?: QfPagination;
}

/** by_key often returns { verse } rather than { verses } on public API */
export interface VerseByKeyResponse {
  verse?: QfVerse;
  verses?: QfVerse[];
  pagination?: QfPagination;
}

/** Translation/tafsir body endpoints */
export interface QfTranslationRow {
  resourceId: number;
  resourceName?: string;
  id?: number;
  text: string;
  verseId?: number;
  languageId?: number;
  languageName?: string;
  verseKey?: string;
  chapterId?: number;
  verseNumber?: number;
  juzNumber?: number;
  pageNumber?: number;
  footNotes?: Record<string, string> | unknown[];
}

export interface TranslationContentResponse {
  translations: QfTranslationRow[];
  meta?: {
    translationName?: string;
    authorName?: string;
    filters?: Record<string, unknown>;
  };
  pagination?: QfPagination;
}

export interface QfTafsirRow {
  id?: number;
  resourceId?: number;
  languageName?: string;
  name?: string;
  text: string;
  verseKey?: string;
  chapterId?: number;
  verseNumber?: number;
}

export interface TafsirContentResponse {
  tafsirs: QfTafsirRow[];
  meta?: Record<string, unknown>;
  pagination?: QfPagination;
}
