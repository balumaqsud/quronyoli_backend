import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CONFIG_KEYS, TELEGRAM_API } from '../../common/constants';
import { TelegramConfig } from '../../config/configuration';
import { TelegramApi } from './interfaces/telegram-api.interface';
import { TELEGRAM_BOT_COMMANDS } from './telegram-bot.commands';

@Injectable()
export class TelegramWebhookBootstrapService implements OnModuleInit {
  constructor(
    @Inject(TELEGRAM_API) private readonly telegramApi: TelegramApi,
    private readonly configService: ConfigService,
    @InjectPinoLogger(TelegramWebhookBootstrapService.name)
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = this.configService.getOrThrow<TelegramConfig>(
      CONFIG_KEYS.TELEGRAM,
    );

    try {
      await this.telegramApi.setMyCommands(TELEGRAM_BOT_COMMANDS);
      this.logger.info(
        { count: TELEGRAM_BOT_COMMANDS.length },
        'Telegram bot commands registered',
      );
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : 'unknown' },
        'Failed to register Telegram bot commands',
      );
    }

    try {
      await this.telegramApi.setChatMenuButton({
        type: 'web_app',
        text: "Quron Yo'li",
        web_app: { url: config.webAppUrl.replace(/\/$/, '') },
      });
      this.logger.info('Telegram chat menu button registered');
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : 'unknown' },
        'Failed to register Telegram chat menu button',
      );
    }

    if (!config.webhookAutoRegister || !config.webhookUrl) {
      return;
    }

    try {
      await this.telegramApi.setWebhook(
        config.webhookUrl,
        config.webhookSecret,
        config.webhookDropPendingUpdates,
      );
      this.logger.info(
        { dropPendingUpdates: config.webhookDropPendingUpdates },
        'Telegram webhook registered',
      );
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : 'unknown' },
        'Failed to register Telegram webhook',
      );
    }
  }
}
