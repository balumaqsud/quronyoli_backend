import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TelegramUpdate } from './interfaces/telegram-api.interface';
import { TelegramBotService } from './telegram-bot.service';

@Injectable()
export class TelegramUpdateDispatcher {
  constructor(
    private readonly botService: TelegramBotService,
    @InjectPinoLogger(TelegramUpdateDispatcher.name)
    private readonly logger: PinoLogger,
  ) {}

  async dispatch(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.text) {
      this.logger.debug(
        { updateId: update.update_id },
        'Ignoring unsupported Telegram update',
      );
      return;
    }

    const text = message.text.trim();
    if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
      await this.botService.handleStartCommand(message);
      return;
    }

    if (/^\/app(?:@\w+)?(?:\s|$)/i.test(text)) {
      await this.botService.handleAppCommand(message);
      return;
    }

    this.logger.debug(
      { updateId: update.update_id, type: 'message' },
      'Ignoring unhandled Telegram message',
    );
  }
}
