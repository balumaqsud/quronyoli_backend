/**
 * Shared Quran.Foundation contract types (camelCase internal).
 * Wire JSON uses snake_case; mappers belong in a follow-up phase.
 */

/** Query: language → language */
export interface LanguageQuery {
  language?: string;
}

/** Query: page, per_page → page, perPage */
export interface PaginationQuery extends LanguageQuery {
  page?: number;
  /** Upstream `per_page`; app max 100 */
  perPage?: number;
}

/** Wire: pagination object on list responses */
export interface QfPagination {
  perPage: number;
  currentPage: number;
  nextPage: number | null;
  totalPages: number;
  totalRecords: number;
}

export interface TranslatedName {
  languageName: string;
  name: string;
}

/** Documented QF error body */
export interface QfErrorBody {
  message: string;
  type: string;
  success: boolean;
}

/** Known documented values; upstream may add more. */
export type QfErrorType =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'unprocessable_entity'
  | 'rate_limit_exceeded'
  | 'internal_server_error'
  | 'bad_gateway'
  | 'service_unavailable'
  | 'gateway_timeout';
