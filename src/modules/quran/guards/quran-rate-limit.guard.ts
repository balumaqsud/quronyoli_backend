import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { CONFIG_KEYS } from '../../../common/constants';
import { QuranFoundationConfig } from '../../../config/configuration';
import { AuthenticatedUser } from '../../../infrastructure/auth/interfaces/jwt-payload.interface';
import { RedisService } from '../../../infrastructure/cache/redis.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { current, ttl }
`;

@Injectable()
export class QuranRateLimitGuard implements CanActivate {
  private readonly config: QuranFoundationConfig;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.config = this.configService.getOrThrow<QuranFoundationConfig>(
      CONFIG_KEYS.QURAN_FOUNDATION,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    const key = this.redisService.buildKey(`qf:ratelimit:user:${userId}`);
    const result = (await this.redisService
      .getClient()
      .eval(
        RATE_LIMIT_LUA,
        1,
        key,
        String(this.config.rateLimitWindowSeconds),
      )) as [number, number];

    const current = Number(result[0]);
    const ttl = Number(result[1]);

    if (current > this.config.rateLimitMax) {
      const retryAfter = ttl > 0 ? ttl : this.config.rateLimitWindowSeconds;
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Quran API rate limit exceeded',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
