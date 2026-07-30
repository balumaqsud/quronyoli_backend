import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AxiosError } from 'axios';

interface UpstreamErrorBody {
  message?: string | string[];
  type?: string;
  error?: string;
  status?: number;
}

@Injectable()
export class QuranFoundationErrorMapper {
  map(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }

    if (this.isAxiosError(error)) {
      const status = error.response?.status;
      const body = this.extractBody(error);
      const message = this.extractMessage(body, error.message);

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new GatewayTimeoutException('Quran.Foundation request timed out');
      }

      if (!status) {
        throw new BadGatewayException(
          'Unable to reach Quran.Foundation upstream service',
        );
      }

      switch (status) {
        case 400:
          throw new BadRequestException(message);
        case 404:
          throw new NotFoundException(message);
        case 422:
          throw new UnprocessableEntityException(message);
        case 401:
        case 403:
          throw new BadGatewayException(
            'Quran.Foundation authentication or authorization failed',
          );
        case 429:
          throw new HttpException(
            message || 'Quran.Foundation rate limit exceeded',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        case 500:
        case 502:
        case 504:
          throw new BadGatewayException(
            'Quran.Foundation upstream service error',
          );
        case 503:
          throw new ServiceUnavailableException(
            'Quran.Foundation upstream service unavailable',
          );
        default:
          if (status >= 500) {
            throw new BadGatewayException(
              'Quran.Foundation upstream service error',
            );
          }

          throw new BadGatewayException(message);
      }
    }

    throw new BadGatewayException('Unexpected Quran.Foundation client error');
  }

  isRetryable(error: unknown): boolean {
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

  getRetryAfterSeconds(error: unknown): number | undefined {
    if (!this.isAxiosError(error)) {
      return undefined;
    }

    const header = error.response?.headers?.['retry-after'] as
      string | number | undefined;
    if (header === undefined || header === null) {
      return undefined;
    }

    const asNumber = Number.parseInt(String(header), 10);
    return Number.isFinite(asNumber) ? asNumber : undefined;
  }

  private isAxiosError(error: unknown): error is AxiosError<UpstreamErrorBody> {
    return (
      typeof error === 'object' &&
      error !== null &&
      'isAxiosError' in error &&
      (error as AxiosError).isAxiosError === true
    );
  }

  private extractBody(
    error: AxiosError<UpstreamErrorBody>,
  ): UpstreamErrorBody | undefined {
    return error.response?.data;
  }

  private extractMessage(
    body: UpstreamErrorBody | undefined,
    fallback: string,
  ): string {
    if (!body) {
      return fallback;
    }

    if (typeof body.message === 'string') {
      return body.message;
    }

    if (Array.isArray(body.message) && body.message.length > 0) {
      return body.message.join(', ');
    }

    if (typeof body.error === 'string') {
      return body.error;
    }

    return fallback;
  }
}
