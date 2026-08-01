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
    if (update.callback_query) {
      await this.botService.handleCallbackQuery(update.callback_query);
      return;
    }

    const message = update.message;
    if (!message?.text) {
      this.logger.debug(
        { updateId: update.update_id },
        'Ignoring unsupported Telegram update',
      );
      return;
    }

    const text = message.text.trim();
    const command = this.matchCommand(text);
    if (!command) {
      this.logger.debug(
        { updateId: update.update_id, type: 'message' },
        'Ignoring unhandled Telegram message',
      );
      return;
    }

    switch (command) {
      case 'start':
        await this.botService.handleStartCommand(message);
        return;
      case 'ilova':
      case 'app':
        await this.botService.handleIlovaCommand(message);
        return;
      case 'bugun':
        await this.botService.handleBugunCommand(message);
        return;
      case 'tasodifiy':
        await this.botService.handleTasodifiyCommand(message);
        return;
      case 'suralar':
        await this.botService.handleSuralarCommand(message);
        return;
      case 'juz':
        await this.botService.handleJuzCommand(message);
        return;
      case 'davom':
        await this.botService.handleDavomCommand(message);
        return;
      case 'saqlangan':
        await this.botService.handleSaqlanganCommand(message);
        return;
      case 'yordam':
        await this.botService.handleYordamCommand(message);
        return;
      case 'haqimizda':
        await this.botService.handleHaqimizdaCommand(message);
        return;
      default:
        this.logger.debug(
          { updateId: update.update_id, command },
          'Ignoring unhandled Telegram command',
        );
    }
  }

  private matchCommand(text: string): string | null {
    const match = /^\/([a-zA-Z]+)(?:@\w+)?(?:\s|$)/.exec(text);
    return match?.[1]?.toLowerCase() ?? null;
  }
}
