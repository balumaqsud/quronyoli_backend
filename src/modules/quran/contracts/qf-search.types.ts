/**
 * Search v1 query/response. Live schema was not captured (auth 401);
 * fields mirror app SearchQueryDto + documented capabilities.
 */
export interface SearchQuery {
  query: string;
  mode?: 'quick' | 'advanced';
  page?: number;
  /** Upstream `size`; app max 50 */
  size?: number;
  /** Comma-separated translation IDs → translation_ids */
  translationIds?: string;
  navigationalResultsNumber?: number;
  versesResultsNumber?: number;
  /** Wire: exact_matches_only */
  exactMatchesOnly?: string;
}

export interface QfSearchNavigationalHit {
  resultType?: string;
  [key: string]: unknown;
}

export interface QfSearchVerseHit {
  verseKey?: string;
  text?: string;
  translations?: unknown[];
  [key: string]: unknown;
}

export interface SearchResponse {
  query?: string;
  navigationalResults?: QfSearchNavigationalHit[];
  verses?: QfSearchVerseHit[];
  pagination?: {
    currentPage?: number;
    perPage?: number;
    totalPages?: number;
    totalRecords?: number;
  };
  [key: string]: unknown;
}
