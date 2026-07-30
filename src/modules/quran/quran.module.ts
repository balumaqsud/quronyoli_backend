import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../common/constants';
import { QuranFoundationConfig } from '../../config/configuration';
import { QuranCacheService } from './cache/quran-cache.service';
import { QuranFoundationClient } from './client/quran-foundation.client';
import { QuranFoundationTokenService } from './client/quran-foundation-token.service';
import { QuranFoundationErrorMapper } from './errors/quran-foundation.error-mapper';
import { QuranRateLimitGuard } from './guards/quran-rate-limit.guard';
import { QuranController } from './quran.controller';
import { QuranService } from './quran.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<QuranFoundationConfig>(
          CONFIG_KEYS.QURAN_FOUNDATION,
        );

        return {
          timeout: config.timeoutMs,
          maxRedirects: 0,
        };
      },
    }),
  ],
  controllers: [QuranController],
  providers: [
    QuranService,
    QuranFoundationClient,
    QuranFoundationTokenService,
    QuranCacheService,
    QuranFoundationErrorMapper,
    QuranRateLimitGuard,
  ],
  exports: [QuranService],
})
export class QuranModule {}
