import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as https from 'https';
import { LoggerModule } from 'nestjs-pino';
import { CONFIG_KEYS, TELEGRAM_API } from '../../common/constants';
import { TelegramConfig } from '../../config/configuration';
import { TelegramHttpApi } from './client/telegram-http.api';
import { TelegramErrorMapper } from './errors/telegram-error.mapper';
import { TelegramWebhookGuard } from './guards/telegram-webhook.guard';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramController } from './telegram.controller';
import { TelegramLinksService } from './telegram-links.service';
import { TelegramUpdateDispatcher } from './telegram-update.dispatcher';
import { TelegramWebhookBootstrapService } from './telegram-webhook.bootstrap';

@Module({
  imports: [
    LoggerModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<TelegramConfig>(
          CONFIG_KEYS.TELEGRAM,
        );
        return {
          timeout: config.timeoutMs,
          maxRedirects: 0,
          httpAgent: new http.Agent({
            keepAlive: true,
            maxSockets: config.httpMaxSockets,
          }),
          httpsAgent: new https.Agent({
            keepAlive: true,
            maxSockets: config.httpMaxSockets,
          }),
        };
      },
    }),
  ],
  controllers: [TelegramController],
  providers: [
    TelegramErrorMapper,
    TelegramLinksService,
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
