import { PaginationQuery } from './qf-common.types';

export type AyahAudioQuery = Pick<PaginationQuery, 'page' | 'perPage'>;

export interface AudioTimestampQuery {
  chapterNumber?: number;
  verseKey?: string;
  verseId?: string;
  word?: string;
}

/** Word segment: [word_index, start_ms, end_ms] */
export type QfAudioWordSegment = [number, number, number];

export interface QfChapterAudioTimestamp {
  verseKey?: string;
  timestampFrom?: number;
  timestampTo?: number;
  duration?: number;
  segments?: QfAudioWordSegment[];
  [key: string]: unknown;
}

export interface QfChapterAudioFile {
  id?: number;
  chapterId?: number;
  fileSize?: number;
  format?: string;
  audioUrl?: string;
  /** Present when upstream is called with segments=true */
  timestamps?: QfChapterAudioTimestamp[];
  [key: string]: unknown;
}

export interface ChapterAudioFilesResponse {
  audioFiles?: QfChapterAudioFile[];
  [key: string]: unknown;
}

export type ChapterAudioFileResponse =
  QfChapterAudioFile | Record<string, unknown>;

export interface QfAyahAudioFile {
  verseKey?: string;
  url?: string;
  [key: string]: unknown;
}

export interface AyahAudioResponse {
  audioFiles?: QfAyahAudioFile[];
  [key: string]: unknown;
}

/** Timestamps payload varies by word=true/false; keep open until live sample */
export type AudioTimestampsResponse = Record<string, unknown>;
