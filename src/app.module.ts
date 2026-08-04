import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import pino from 'pino';
import configuration, { AppConfig } from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { createProductionTransport } from './config/logger.streams';
import { CONFIG_KEYS, REQUEST_ID_HEADER } from './common/constants';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { HttpCacheInterceptor } from './common/interceptors/http-cache.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { AuthInfrastructureModule } from './infrastructure/auth/auth.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/cache/redis.module';
import { QueueShutdownService } from './infrastructure/queue/queue-shutdown.service';
import { AppThrottlerGuard } from './infrastructure/throttle/app-throttler.guard';
import { ThrottlerConfigService } from './infrastructure/throttle/throttler-config.service';
import { GoalsModule } from './modules/goals/goals.module';
import { HealthModule } from './modules/health/health.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QuranModule } from './modules/quran/quran.module';
import { ReadingModule } from './modules/reading/reading.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { UsersModule } from './modules/users/users.module';
import { BookmarksModule } from './modules/bookmarks/bookmarks.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';

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
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const appConfig = configService.getOrThrow<AppConfig>(CONFIG_KEYS.APP);
        const isProduction = appConfig.nodeEnv === 'production';

        const pinoHttpBase = {
          level: appConfig.logLevel,
          genReqId: (req: IncomingMessage, res: ServerResponse): string => {
            const existingHeader = req.headers[REQUEST_ID_HEADER];
            const existingId = Array.isArray(existingHeader)
              ? existingHeader[0]
              : existingHeader;
            const requestId = existingId ?? randomUUID();
            res.setHeader(REQUEST_ID_HEADER, requestId);
            return requestId;
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-api-key"]',
            ],
            remove: true,
          },
          customProps: () => ({
            context: 'HTTP',
          }),
          serializers: {
            req: (req: IncomingMessage & { id?: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
          },
        };

        if (isProduction) {
          const transport = pino.transport(
            createProductionTransport(appConfig.logDir),
          );
          return {
            pinoHttp: {
              ...pinoHttpBase,
              logger: pino({ level: appConfig.logLevel }, transport),
            },
          };
        }

        return {
          pinoHttp: {
            ...pinoHttpBase,
            transport: {
              target: 'pino-pretty',
              options: {
                singleLine: true,
                colorize: true,
                translateTime: 'SYS:standard',
              },
            },
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useClass: ThrottlerConfigService,
    }),
    DatabaseModule,
    RedisModule,
    AuthInfrastructureModule,
    HealthModule,
    UsersModule,
    AuthModule,
    AdminModule,
    ReadingModule,
    QuranModule,
    SettingsModule,
    FavoritesModule,
    BookmarksModule,
    GoalsModule,
    TelegramModule,
    NotificationsModule,
    AnalyticsModule,
  ],
  providers: [
    QueueShutdownService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
