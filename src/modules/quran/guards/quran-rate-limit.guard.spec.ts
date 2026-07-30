import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../../common/constants';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { QuranRateLimitGuard } from './quran-rate-limit.guard';

describe('QuranRateLimitGuard', () => {
  const createGuard = (evalResult: [number, number]) => {
    const redis = {
      buildKey: jest.fn((key: string) => `prefix:${key}`),
      getClient: jest.fn().mockReturnValue({
        eval: jest.fn().mockResolvedValue(evalResult),
      }),
    };

    const config = {
      getOrThrow: (key: string) => {
        if (key === CONFIG_KEYS.QURAN_FOUNDATION) {
          return {
            rateLimitMax: 2,
            rateLimitWindowSeconds: 60,
          };
        }

        throw new Error(`Unexpected key ${key}`);
      },
    };

    return new QuranRateLimitGuard(
      redis as unknown as RedisService,
      config as unknown as ConfigService,
    );
  };

  const createContext = (userId?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { sub: userId, sid: 's', typ: 'access' } : undefined,
        }),
      }),
    }) as unknown as ExecutionContext;

  it('allows requests under the limit', async () => {
    const guard = createGuard([1, 60]);
    await expect(guard.canActivate(createContext('user-1'))).resolves.toBe(
      true,
    );
  });

  it('blocks requests over the limit', async () => {
    const guard = createGuard([3, 45]);
    try {
      await guard.canActivate(createContext('user-1'));
      fail('Expected HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });
});
