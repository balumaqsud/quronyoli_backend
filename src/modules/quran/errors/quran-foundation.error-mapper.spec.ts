import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { QuranFoundationErrorMapper } from './quran-foundation.error-mapper';

const createAxiosError = (
  status?: number,
  data?: Record<string, unknown>,
  code?: string,
): AxiosError => {
  const error = new Error('request failed') as AxiosError;
  error.isAxiosError = true;
  error.code = code;
  error.response = status
    ? ({
        status,
        data,
        headers: {},
        statusText: 'Error',
        config: {} as never,
      } as AxiosError['response'])
    : undefined;
  return error;
};

describe('QuranFoundationErrorMapper', () => {
  const mapper = new QuranFoundationErrorMapper();

  it('maps 400 to BadRequestException', () => {
    expect(() =>
      mapper.map(createAxiosError(400, { message: 'bad input' })),
    ).toThrow(BadRequestException);
  });

  it('maps 404 to NotFoundException', () => {
    expect(() =>
      mapper.map(createAxiosError(404, { message: 'missing' })),
    ).toThrow(NotFoundException);
  });

  it('maps 401/403 to BadGatewayException', () => {
    expect(() => mapper.map(createAxiosError(401))).toThrow(
      BadGatewayException,
    );
    expect(() => mapper.map(createAxiosError(403))).toThrow(
      BadGatewayException,
    );
  });

  it('maps 429 to HTTP 429', () => {
    try {
      mapper.map(createAxiosError(429));
      fail('Expected HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });

  it('maps timeouts to GatewayTimeoutException', () => {
    expect(() =>
      mapper.map(createAxiosError(undefined, undefined, 'ECONNABORTED')),
    ).toThrow(GatewayTimeoutException);
  });

  it('treats 429 and 5xx as retryable', () => {
    expect(mapper.isRetryable(createAxiosError(429))).toBe(true);
    expect(mapper.isRetryable(createAxiosError(503))).toBe(true);
    expect(mapper.isRetryable(createAxiosError(400))).toBe(false);
  });
});
