import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS, QURAN_FOUNDATION_CLIENT } from '../../common/constants';
import { createKeepAliveHttpModule } from '../../common/http/create-keepalive-http-module';
import { QuranFoundationConfig } from '../../config/configuration';
import { ReadingModule } from '../reading/reading.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { QuranCacheService } from './cache/quran-cache.service';
import { QuranFoundationClient } from './client/quran-foundation.client';
import { QuranFoundationTokenService } from './client/quran-foundation-token.service';
import { QuranFoundationErrorMapper } from './errors/quran-foundation.error-mapper';
import { QuranRateLimitGuard } from './guards/quran-rate-limit.guard';
import { QfPagesRepository } from './pages/qf-pages.repository';
import { QuranController } from './quran.controller';
import { QuranService } from './quran.service';

@Module({
  imports: [
    ReadingModule,
    AnalyticsModule,
    createKeepAliveHttpModule((configService: ConfigService) => {
      const config = configService.getOrThrow<QuranFoundationConfig>(
        CONFIG_KEYS.QURAN_FOUNDATION,
      );
      return {
        timeoutMs: config.timeoutMs,
        maxSockets: config.httpMaxSockets,
      };
    }),
  ],
  controllers: [QuranController],
  providers: [
    QuranService,
    QuranFoundationClient,
    {
      provide: QURAN_FOUNDATION_CLIENT,
      useExisting: QuranFoundationClient,
    },
    QuranFoundationTokenService,
    QuranCacheService,
    QuranFoundationErrorMapper,
    QuranRateLimitGuard,
    QfPagesRepository,
  ],
  exports: [QuranService, QURAN_FOUNDATION_CLIENT],
})
export class QuranModule {}
