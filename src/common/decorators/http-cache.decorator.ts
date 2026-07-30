import { SetMetadata } from '@nestjs/common';

export const HTTP_CACHE_KEY = 'httpCacheControl';

export type HttpCachePolicy = 'no-store' | 'private-short';

export const HttpCache = (policy: HttpCachePolicy = 'no-store') =>
  SetMetadata(HTTP_CACHE_KEY, policy);
