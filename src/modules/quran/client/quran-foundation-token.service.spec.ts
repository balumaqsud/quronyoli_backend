import { of } from 'rxjs';
import { CONFIG_KEYS } from '../../../common/constants';
import { QuranFoundationTokenService } from './quran-foundation-token.service';

describe('QuranFoundationTokenService', () => {
  const config = {
    clientId: 'client-id-value',
    clientSecret: 'client-secret-value',
    authBaseUrl: 'https://oauth2.quran.foundation',
    contentScope: 'content',
    searchScope: 'search',
    timeoutMs: 5000,
    tokenSkewSeconds: 30,
  };

  const createService = (overrides?: {
    get?: jest.Mock;
    set?: jest.Mock;
    del?: jest.Mock;
    post?: jest.Mock;
  }) => {
    const redis = {
      get: overrides?.get ?? jest.fn().mockResolvedValue(null),
      set: overrides?.set ?? jest.fn().mockResolvedValue(undefined),
      del: overrides?.del ?? jest.fn().mockResolvedValue(undefined),
    };
    const http = {
      post: overrides?.post ?? jest.fn(),
    };
    const configService = {
      getOrThrow: (key: string) => {
        if (key === CONFIG_KEYS.QURAN_FOUNDATION) {
          return config;
        }

        throw new Error(`Unexpected key ${key}`);
      },
    };
    const logger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    const service = new QuranFoundationTokenService(
      http as never,
      redis as never,
      configService as never,
      logger as never,
    );

    return { service, redis, http, logger };
  };

  it('returns a cached token when still valid', async () => {
    const cached = {
      accessToken: 'cached-token',
      expiresAtMs: Date.now() + 60_000,
      scope: 'content',
    };
    const { service, http } = createService({
      get: jest.fn().mockResolvedValue(JSON.stringify(cached)),
    });

    await expect(service.getAccessToken('content')).resolves.toBe(
      'cached-token',
    );
    expect(http.post).not.toHaveBeenCalled();
  });

  it('evicts malformed cached tokens and fetches a new one', async () => {
    const post = jest.fn().mockReturnValue(
      of({
        data: {
          access_token: 'fresh-token',
          expires_in: 3600,
          scope: 'content',
          token_type: 'Bearer',
        },
      }),
    );
    const del = jest.fn().mockResolvedValue(undefined);
    const set = jest.fn().mockResolvedValue(undefined);
    const { service } = createService({
      get: jest.fn().mockResolvedValue('{not-json'),
      del,
      set,
      post,
    });

    await expect(service.getAccessToken('content')).resolves.toBe(
      'fresh-token',
    );
    expect(del).toHaveBeenCalledWith('qf:token:content');
    expect(set).toHaveBeenCalled();
  });

  it('single-flights concurrent token fetches for the same scope', async () => {
    const { delay, of } = await import('rxjs');
    const post = jest.fn().mockReturnValue(
      of({
        data: {
          access_token: 'shared-token',
          expires_in: 3600,
          scope: 'content',
          token_type: 'Bearer',
        },
      }).pipe(delay(20)),
    );
    const set = jest.fn().mockResolvedValue(undefined);
    const { service } = createService({
      get: jest.fn().mockResolvedValue(null),
      set,
      post,
    });

    const [first, second] = await Promise.all([
      service.getAccessToken('content'),
      service.getAccessToken('content'),
    ]);

    expect(first).toBe('shared-token');
    expect(second).toBe('shared-token');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('invalidates cached tokens', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const { service } = createService({ del });

    await service.invalidateToken('search');
    expect(del).toHaveBeenCalledWith('qf:token:search');
  });
});
