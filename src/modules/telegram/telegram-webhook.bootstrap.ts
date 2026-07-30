import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CONFIG_KEYS, TELEGRAM_API } from '../../common/constants';
import { TelegramConfig } from '../../config/configuration';
import { TelegramApi } from './interfaces/telegram-api.interface';

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

    if (!config.webhookAutoRegister || !config.webhookUrl) {
      return;
    }

    try {
      await this.telegramApi.setWebhook(
        config.webhookUrl,
        config.webhookSecret,
      );
      this.logger.info('Telegram webhook registered');
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : 'unknown' },
        'Failed to register Telegram webhook',
      );
    }
  }
}
