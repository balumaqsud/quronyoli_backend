import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { CONFIG_KEYS } from '../../../common/constants';
import { QuranFoundationErrorMapper } from '../errors/quran-foundation.error-mapper';
import { QuranFoundationClient } from './quran-foundation.client';

describe('QuranFoundationClient', () => {
  const config = {
    clientId: 'client-id-value',
    apiBaseUrl: 'https://apis.quran.foundation',
    contentPathPrefix: '/content/api/v4',
    searchPathPrefix: '/search/v1',
    timeoutMs: 1000,
    maxRetries: 2,
    retryBaseDelayMs: 10,
  };

  const createAxiosError = (
    status?: number,
    headers?: Record<string, string>,
    code?: string,
  ): AxiosError => {
    const error = new AxiosError('upstream error');
    error.isAxiosError = true;
    error.code = code;
    if (status !== undefined) {
      error.response = {
        status,
        statusText: 'Error',
        headers: headers ?? {},
        config: {} as never,
        data: { message: 'upstream' },
      };
    }
    return error;
  };

  const createClient = (overrides?: {
    request?: jest.Mock;
    getAccessToken?: jest.Mock;
    invalidateToken?: jest.Mock;
  }) => {
    const http = {
      request: overrides?.request ?? jest.fn(),
    };
    const tokenService = {
      getAccessToken:
        overrides?.getAccessToken ??
        jest.fn().mockResolvedValue('access-token'),
      invalidateToken:
        overrides?.invalidateToken ?? jest.fn().mockResolvedValue(undefined),
    };
    const errorMapper = new QuranFoundationErrorMapper();
    const configService = {
      getOrThrow: (key: string) => {
        if (key === CONFIG_KEYS.QURAN_FOUNDATION) {
          return config;
        }

        throw new Error(`Unexpected key ${key}`);
      },
    };
    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const client = new QuranFoundationClient(
      http as never,
      tokenService as never,
      errorMapper,
      configService as never,
      logger as never,
    );

    return { client, http, tokenService, logger };
  };

  it('sends auth headers and returns content payload', async () => {
    const request = jest.fn().mockReturnValue(
      of({
        data: { chapters: [{ id: 1 }] },
      }),
    );
    const { client, http } = createClient({ request });

    await expect(client.getContent('/chapters')).resolves.toEqual({
      chapters: [{ id: 1 }],
    });

    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://apis.quran.foundation/content/api/v4/chapters',
        headers: {
          'x-auth-token': 'access-token',
          'x-client-id': 'client-id-value',
          Accept: 'application/json',
        },
      }) as Record<string, unknown>,
    );
  });

  it('normalizes array query params to comma-separated values', async () => {
    const request = jest.fn().mockReturnValue(of({ data: { ok: true } }));
    const { client } = createClient({ request });

    await client.getContent('/verses', {
      translations: [20, 131],
      fields: 'text_uthmani',
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          translations: '20,131',
          fields: 'text_uthmani',
        },
      }),
    );
  });

  it('invalidates token and retries once on 401', async () => {
    const request = jest
      .fn()
      .mockReturnValueOnce(throwError(() => createAxiosError(401)))
      .mockReturnValueOnce(of({ data: { ok: true } }));
    const invalidateToken = jest.fn().mockResolvedValue(undefined);
    const getAccessToken = jest
      .fn()
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token');

    const { client } = createClient({
      request,
      invalidateToken,
      getAccessToken,
    });

    await expect(client.getContent('/chapters')).resolves.toEqual({
      ok: true,
    });
    expect(invalidateToken).toHaveBeenCalledWith('content');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('retries retryable 5xx responses with backoff', async () => {
    jest.useFakeTimers();
    const request = jest
      .fn()
      .mockReturnValueOnce(throwError(() => createAxiosError(503)))
      .mockReturnValueOnce(of({ data: { recovered: true } }));
    const { client } = createClient({ request });

    const promise = client.getContent('/chapters');
    await jest.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ recovered: true });
    expect(request).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('honors Retry-After for 429 responses', async () => {
    jest.useFakeTimers();
    const request = jest
      .fn()
      .mockReturnValueOnce(
        throwError(() => createAxiosError(429, { 'retry-after': '1' })),
      )
      .mockReturnValueOnce(of({ data: { ok: true } }));
    const { client } = createClient({ request });

    const promise = client.getContent('/chapters');
    await jest.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toEqual({ ok: true });
    jest.useRealTimers();
  });

  it('maps non-retryable 404 without retrying', async () => {
    const request = jest
      .fn()
      .mockReturnValue(throwError(() => createAxiosError(404)));
    const { client } = createClient({ request });

    await expect(client.getContent('/missing')).rejects.toMatchObject({
      status: 404,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
