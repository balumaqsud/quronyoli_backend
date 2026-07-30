import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CONFIG_KEYS } from '../../../common/constants';
import { QuranFoundationConfig } from '../../../config/configuration';
import { QuranFoundationErrorMapper } from '../errors/quran-foundation.error-mapper';
import {
  QuranApiScope,
  QuranQueryParams,
} from '../interfaces/quran-foundation.interface';
import { QuranFoundationTokenService } from './quran-foundation-token.service';

@Injectable()
export class QuranFoundationClient {
  private readonly config: QuranFoundationConfig;

  constructor(
    private readonly httpService: HttpService,
    private readonly tokenService: QuranFoundationTokenService,
    private readonly errorMapper: QuranFoundationErrorMapper,
    private readonly configService: ConfigService,
    @InjectPinoLogger(QuranFoundationClient.name)
    private readonly logger: PinoLogger,
  ) {
    this.config = this.configService.getOrThrow<QuranFoundationConfig>(
      CONFIG_KEYS.QURAN_FOUNDATION,
    );
  }

  async getContent<T>(path: string, query?: QuranQueryParams): Promise<T> {
    return this.request<T>('content', path, query);
  }

  async getSearch<T>(path: string, query?: QuranQueryParams): Promise<T> {
    return this.request<T>('search', path, query);
  }

  private async request<T>(
    scopeType: QuranApiScope,
    path: string,
    query?: QuranQueryParams,
  ): Promise<T> {
    let attempt = 0;
    let unauthorizedRetried = false;

    while (true) {
      try {
        const token = await this.tokenService.getAccessToken(scopeType);
        const response = await this.execute<T>(scopeType, path, query, token);
        return response.data;
      } catch (error) {
        if (
          this.isAxiosError(error) &&
          error.response?.status === 401 &&
          !unauthorizedRetried
        ) {
          unauthorizedRetried = true;
          await this.tokenService.invalidateToken(scopeType);
          continue;
        }

        const canRetry =
          attempt < this.config.maxRetries &&
          this.errorMapper.isRetryable(error);

        if (!canRetry) {
          this.errorMapper.map(error);
        }

        const delayMs = this.resolveDelayMs(error, attempt);
        this.logger.warn(
          {
            scopeType,
            path,
            attempt: attempt + 1,
            delayMs,
            status: this.isAxiosError(error)
              ? error.response?.status
              : undefined,
          },
          'Retrying Quran.Foundation request',
        );

        await this.sleep(delayMs);
        attempt += 1;
      }
    }
  }

  private async execute<T>(
    scopeType: QuranApiScope,
    path: string,
    query: QuranQueryParams | undefined,
    token: string,
  ): Promise<AxiosResponse<T>> {
    const prefix =
      scopeType === 'content'
        ? this.config.contentPathPrefix
        : this.config.searchPathPrefix;
    const url = `${this.config.apiBaseUrl}${prefix}${path.startsWith('/') ? path : `/${path}`}`;

    const config: AxiosRequestConfig = {
      method: 'GET',
      url,
      params: this.normalizeQuery(query),
      timeout: this.config.timeoutMs,
      headers: {
        'x-auth-token': token,
        'x-client-id': this.config.clientId,
        Accept: 'application/json',
      },
    };

    return firstValueFrom(this.httpService.request<T>(config));
  }

  private normalizeQuery(
    query?: QuranQueryParams,
  ): Record<string, string | number | boolean> | undefined {
    if (!query) {
      return undefined;
    }

    const result: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        if (value.length === 0) {
          continue;
        }

        result[key] = value.map(String).join(',');
        continue;
      }

      result[key] = value;
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  private resolveDelayMs(error: unknown, attempt: number): number {
    const retryAfter = this.errorMapper.getRetryAfterSeconds(error);
    if (retryAfter !== undefined) {
      return retryAfter * 1000;
    }

    const exponential = this.config.retryBaseDelayMs * 2 ** attempt;
    const jitter = Math.floor(Math.random() * this.config.retryBaseDelayMs);
    return Math.min(exponential + jitter, 10_000);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'isAxiosError' in error &&
      (error as AxiosError).isAxiosError === true
    );
  }
}
