import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { CONFIG_KEYS, TELEGRAM_API } from '../../common/constants';
import { createKeepAliveHttpModule } from '../../common/http/create-keepalive-http-module';
import { TelegramConfig } from '../../config/configuration';
import { AnalyticsModule } from '../analytics/analytics.module';
import { UsersModule } from '../users/users.module';
import { TelegramHttpApi } from './client/telegram-http.api';
import { TelegramErrorMapper } from './errors/telegram-error.mapper';
import { TelegramWebhookGuard } from './guards/telegram-webhook.guard';
import { TelegramAyahCardService } from './telegram-ayah-card.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramController } from './telegram.controller';
import { TelegramLinksService } from './telegram-links.service';
import { TelegramUpdateDispatcher } from './telegram-update.dispatcher';
import { TelegramWebhookBootstrapService } from './telegram-webhook.bootstrap';
import { BookmarksModule } from '../bookmarks/bookmarks.module';
import { QuranModule } from '../quran/quran.module';
import { ReadingModule } from '../reading/reading.module';
import { SettingsModule } from '../settings/settings.module';

/**
 * Bot chat UX is Mini App–first. Quran/Settings/Reading/Bookmarks remain
 * imported so TelegramAyahCardService (reminders / future use) still resolves.
 */
@Module({
  imports: [
    LoggerModule,
    UsersModule,
    SettingsModule,
    QuranModule,
    ReadingModule,
    BookmarksModule,
    AnalyticsModule,
    createKeepAliveHttpModule((configService: ConfigService) => {
      const config = configService.getOrThrow<TelegramConfig>(
        CONFIG_KEYS.TELEGRAM,
      );
      return {
        timeoutMs: config.timeoutMs,
        maxSockets: config.httpMaxSockets,
      };
    }),
  ],
  controllers: [TelegramController],
  providers: [
    TelegramErrorMapper,
    TelegramLinksService,
    TelegramAyahCardService,
    TelegramBotService,
    TelegramUpdateDispatcher,
    TelegramWebhookGuard,
    TelegramWebhookBootstrapService,
    {
      provide: TELEGRAM_API,
      useClass: TelegramHttpApi,
    },
  ],
  exports: [TELEGRAM_API, TelegramBotService, TelegramLinksService],
})
export class TelegramModule {}
