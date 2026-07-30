export type QuranApiScope = 'content' | 'search';

export interface QuranFoundationTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface CachedAccessToken {
  accessToken: string;
  expiresAtMs: number;
  scope: string;
}

export type QuranQueryValue =
  string | number | boolean | Array<string | number>;

export type QuranQueryParams = Record<string, QuranQueryValue | undefined>;
