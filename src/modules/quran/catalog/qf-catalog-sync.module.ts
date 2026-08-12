import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { CONFIG_KEYS } from '../../../common/constants';
import { createKeepAliveHttpModule } from '../../../common/http/create-keepalive-http-module';
import configuration, {
  QuranFoundationConfig,
} from '../../../config/configuration';
import { envValidationSchema } from '../../../config/env.validation';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RedisModule } from '../../../infrastructure/cache/redis.module';
import { QuranCacheService } from '../cache/quran-cache.service';
import { QuranFoundationClient } from '../client/quran-foundation.client';
import { QuranFoundationTokenService } from '../client/quran-foundation-token.service';
import { QuranFoundationErrorMapper } from '../errors/quran-foundation.error-mapper';
import { QfCatalogRepository } from './qf-catalog.repository';
import { QfCatalogSyncService } from './qf-catalog-sync.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'SYS:standard',
                },
              },
      },
    }),
    DatabaseModule,
    RedisModule,
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
  providers: [
    QuranFoundationClient,
    QuranFoundationTokenService,
    QuranFoundationErrorMapper,
    QuranCacheService,
    QfCatalogRepository,
    QfCatalogSyncService,
  ],
  exports: [QfCatalogSyncService],
})
export class QfCatalogSyncModule {}
