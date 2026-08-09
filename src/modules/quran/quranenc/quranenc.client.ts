import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CONFIG_KEYS } from '../../../common/constants';
import { QuranEncConfig } from '../../../config/configuration';
import {
  isQuranEncTranslationKey,
  QuranEncTranslationKey,
} from './quranenc.constants';
import {
  assertValidAyahNumber,
  assertValidSurahNumber,
  parseEncAyahRow,
  QuranEncAyahRow,
} from './quranenc.mapper';

@Injectable()
export class QuranEncClient {
  private readonly config: QuranEncConfig;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectPinoLogger(QuranEncClient.name)
    private readonly logger: PinoLogger,
  ) {
    this.config = this.configService.getOrThrow<QuranEncConfig>(
      CONFIG_KEYS.QURANENC,
    );
  }

  async getSurahTranslation(
    key: QuranEncTranslationKey,
    surahNumber: number,
  ): Promise<QuranEncAyahRow[]> {
    this.assertAllowedKey(key);
    try {
      assertValidSurahNumber(surahNumber);
    } catch {
      throw new BadRequestException(`Invalid surah number: ${surahNumber}`);
    }

    const payload = await this.getJson<unknown>(
      `/translation/sura/${key}/${surahNumber}`,
    );
    const rows = this.extractResultArray(payload);
    const parsed = rows
      .map((row) => parseEncAyahRow(row))
      .filter((row): row is QuranEncAyahRow => row !== null);

    if (parsed.length === 0) {
      throw new NotFoundException(
        `QuranEnc translation not found for ${key} surah ${surahNumber}`,
      );
    }

    return parsed;
  }

  async getAyahTranslation(
    key: QuranEncTranslationKey,
    surahNumber: number,
    ayahNumber: number,
  ): Promise<QuranEncAyahRow> {
    this.assertAllowedKey(key);
    try {
      assertValidSurahNumber(surahNumber);
      assertValidAyahNumber(ayahNumber);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid surah/ayah',
      );
    }

    const payload = await this.getJson<unknown>(
      `/translation/aya/${key}/${surahNumber}/${ayahNumber}`,
    );
    const result =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as { result?: unknown }).result
        : undefined;
    const parsed = parseEncAyahRow(result);
    if (!parsed) {
      throw new NotFoundException(
        `QuranEnc translation not found for ${key} ${surahNumber}:${ayahNumber}`,
      );
    }
    return parsed;
  }

  private assertAllowedKey(key: string): asserts key is QuranEncTranslationKey {
    if (!isQuranEncTranslationKey(key)) {
      throw new BadRequestException(
        `Unsupported QuranEnc translation key: ${key}`,
      );
    }
  }

  private extractResultArray(payload: unknown): unknown[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }
    const result = (payload as { result?: unknown }).result;
    return Array.isArray(result) ? result : [];
  }

  private async getJson<T>(path: string): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        const response = await this.execute<T>(path);
        return response.data;
      } catch (error) {
        const canRetry =
          attempt < this.config.maxRetries && this.isRetryable(error);

        if (!canRetry) {
          this.mapError(error);
        }

        const delayMs = this.config.retryBaseDelayMs * Math.pow(2, attempt);
        this.logger.warn(
          {
            path,
            attempt: attempt + 1,
            delayMs,
            status: this.isAxiosError(error)
              ? error.response?.status
              : undefined,
          },
          'Retrying QuranEnc request',
        );
        await this.sleep(delayMs);
        attempt += 1;
      }
    }
  }

  private async execute<T>(path: string): Promise<AxiosResponse<T>> {
    const base = this.config.apiBaseUrl.replace(/\/$/, '');
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    return firstValueFrom(
      this.httpService.request<T>({
        method: 'GET',
        url,
        timeout: this.config.timeoutMs,
        headers: { Accept: 'application/json' },
        validateStatus: (status) => status >= 200 && status < 300,
      }),
    );
  }

  private mapError(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }

    if (this.isAxiosError(error)) {
      const status = error.response?.status;

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new GatewayTimeoutException('QuranEnc request timed out');
      }

      if (!status) {
        throw new BadGatewayException('Unable to reach QuranEnc upstream');
      }

      switch (status) {
        case 400:
          throw new BadRequestException('Invalid QuranEnc request');
        case 404:
          throw new NotFoundException('QuranEnc translation not found');
        case 429:
          throw new HttpException(
            'QuranEnc rate limit exceeded',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        case 503:
          throw new ServiceUnavailableException(
            'QuranEnc upstream service unavailable',
          );
        default:
          if (status >= 500) {
            throw new BadGatewayException('QuranEnc upstream service error');
          }
          throw new BadGatewayException('QuranEnc request failed');
      }
    }

    throw new BadGatewayException('Unexpected QuranEnc client error');
  }

  private isRetryable(error: unknown): boolean {
    if (!this.isAxiosError(error)) {
      return false;
    }
    if (
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND' ||
      !error.response
    ) {
      return true;
    }
    const status = error.response.status;
    return status === 429 || status >= 500;
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as AxiosError).isAxiosError === true
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
