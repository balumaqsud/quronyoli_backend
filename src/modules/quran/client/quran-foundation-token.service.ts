import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CONFIG_KEYS } from '../../../common/constants';
import { QuranFoundationConfig } from '../../../config/configuration';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import {
  CachedAccessToken,
  QuranApiScope,
  QuranFoundationTokenResponse,
} from '../interfaces/quran-foundation.interface';

@Injectable()
export class QuranFoundationTokenService {
  private readonly config: QuranFoundationConfig;
  private readonly inFlight = new Map<QuranApiScope, Promise<string>>();

  constructor(
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @InjectPinoLogger(QuranFoundationTokenService.name)
    private readonly logger: PinoLogger,
  ) {
    this.config = this.configService.getOrThrow<QuranFoundationConfig>(
      CONFIG_KEYS.QURAN_FOUNDATION,
    );
  }

  async getAccessToken(scopeType: QuranApiScope): Promise<string> {
    const cached = await this.readCachedToken(scopeType);
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached.accessToken;
    }

    const existing = this.inFlight.get(scopeType);
    if (existing) {
      return existing;
    }

    const fetchPromise = this.fetchAndCacheToken(scopeType).finally(() => {
      this.inFlight.delete(scopeType);
    });

    this.inFlight.set(scopeType, fetchPromise);
    return fetchPromise;
  }

  async invalidateToken(scopeType: QuranApiScope): Promise<void> {
    await this.redisService.del(this.tokenCacheKey(scopeType));
  }

  private async fetchAndCacheToken(scopeType: QuranApiScope): Promise<string> {
    const scope =
      scopeType === 'content'
        ? this.config.contentScope
        : this.config.searchScope;

    const basicAuth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      scope,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<QuranFoundationTokenResponse>(
          `${this.config.authBaseUrl}/oauth2/token`,
          body.toString(),
          {
            headers: {
              Authorization: `Basic ${basicAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: this.config.timeoutMs,
          },
        ),
      );

      const token = response.data.access_token;
      const expiresIn = response.data.expires_in;
      const ttlSeconds = Math.max(expiresIn - this.config.tokenSkewSeconds, 30);

      const cached: CachedAccessToken = {
        accessToken: token,
        expiresAtMs: Date.now() + ttlSeconds * 1000,
        scope: response.data.scope ?? scope,
      };

      await this.redisService.set(
        this.tokenCacheKey(scopeType),
        JSON.stringify(cached),
        ttlSeconds,
      );

      this.logger.debug(
        { scopeType, ttlSeconds },
        'Fetched Quran.Foundation access token',
      );

      return token;
    } catch (error) {
      this.logger.error(
        { err: error, scopeType },
        'Failed to fetch Quran.Foundation access token',
      );
      throw error;
    }
  }

  private async readCachedToken(
    scopeType: QuranApiScope,
  ): Promise<CachedAccessToken | null> {
    const raw = await this.redisService.get(this.tokenCacheKey(scopeType));
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as CachedAccessToken;
      if (
        typeof parsed.accessToken !== 'string' ||
        typeof parsed.expiresAtMs !== 'number'
      ) {
        await this.invalidateToken(scopeType);
        return null;
      }

      return parsed;
    } catch {
      await this.invalidateToken(scopeType);
      return null;
    }
  }

  private tokenCacheKey(scopeType: QuranApiScope): string {
    return `qf:token:${scopeType}`;
  }
}
