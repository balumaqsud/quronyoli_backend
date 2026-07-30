import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError } from 'axios';

export class TelegramBlockedError extends Error {
  constructor(message = 'Telegram chat is blocked or deactivated') {
    super(message);
    this.name = 'TelegramBlockedError';
  }
}

@Injectable()
export class TelegramErrorMapper {
  map(error: unknown): never {
    if (
      error instanceof HttpException ||
      error instanceof TelegramBlockedError
    ) {
      throw error;
    }

    if (this.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new GatewayTimeoutException('Telegram Bot API request timed out');
      }

      const status = error.response?.status;
      const description = this.extractDescription(error);
      const errorCode = this.extractErrorCode(error);

      if (
        errorCode === 403 ||
        /blocked by the user|user is deactivated|chat not found/i.test(
          description,
        )
      ) {
        throw new TelegramBlockedError(description);
      }

      if (!status) {
        throw new BadGatewayException('Unable to reach Telegram Bot API');
      }

      if (status === 429) {
        throw new HttpException(
          description || 'Telegram Bot API rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (status >= 500) {
        throw new ServiceUnavailableException(
          'Telegram Bot API upstream unavailable',
        );
      }

      throw new BadGatewayException(description || 'Telegram Bot API error');
    }

    throw error instanceof Error
      ? error
      : new BadGatewayException('Unknown Telegram Bot API error');
  }

  isRetryable(error: unknown): boolean {
    if (error instanceof TelegramBlockedError) {
      return false;
    }

    if (this.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return true;
      }

      const status = error.response?.status;
      return status === 429 || (status !== undefined && status >= 500);
    }

    return false;
  }

  private extractDescription(error: AxiosError): string {
    const data = error.response?.data as
      { description?: string; error_code?: number } | undefined;
    return data?.description ?? error.message;
  }

  private extractErrorCode(error: AxiosError): number | undefined {
    const data = error.response?.data as { error_code?: number } | undefined;
    return data?.error_code ?? error.response?.status;
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return (error as AxiosError)?.isAxiosError === true;
  }
}
