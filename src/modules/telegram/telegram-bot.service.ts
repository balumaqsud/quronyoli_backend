import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS, TELEGRAM_API } from '../../common/constants';
import { TelegramConfig } from '../../config/configuration';
import { isValidAyahCoordinate } from '../../common/quran/quran-coordinates';
import {
  TelegramApi,
  TelegramIncomingMessage,
  TelegramInlineKeyboardMarkup,
} from './interfaces/telegram-api.interface';
import { TelegramLinksService } from './telegram-links.service';
import { escapeHtml, parseAyahStartPayload } from './utils/telegram-text.utils';

@Injectable()
export class TelegramBotService {
  private readonly config: TelegramConfig;

  constructor(
    @Inject(TELEGRAM_API) private readonly telegramApi: TelegramApi,
    private readonly linksService: TelegramLinksService,
    private readonly configService: ConfigService,
  ) {
    this.config = this.configService.getOrThrow<TelegramConfig>(
      CONFIG_KEYS.TELEGRAM,
    );
  }

  async handleStartCommand(message: TelegramIncomingMessage): Promise<void> {
    const payload = this.extractCommandPayload(message.text, 'start');
    const ayah = parseAyahStartPayload(payload);

    if (ayah && isValidAyahCoordinate(ayah.chapterNumber, ayah.verseNumber)) {
      await this.sendOpenMiniApp(
        message.chat.id,
        `Open ayah <b>${escapeHtml(ayah.verseKey)}</b> in Quron Yo'li.`,
        ayah.verseKey
          ? `ayah_${ayah.chapterNumber}_${ayah.verseNumber}`
          : undefined,
      );
      return;
    }

    if (payload === 'app' || !payload) {
      await this.sendOpenMiniApp(
        message.chat.id,
        `Assalomu alaykum! Open <b>Quron Yo'li</b> to continue reading.`,
      );
      return;
    }

    await this.sendOpenMiniApp(
      message.chat.id,
      `Welcome to <b>Quron Yo'li</b>. Tap below to open the Mini App.`,
    );
  }

  async handleAppCommand(message: TelegramIncomingMessage): Promise<void> {
    await this.sendOpenMiniApp(
      message.chat.id,
      `Open the <b>Quron Yo'li</b> Mini App to continue.`,
    );
  }

  async sendDailyReminder(input: {
    chatId: number | string;
    localDate: string;
    verseKey: string;
    goalLines: string[];
  }): Promise<{ messageId: number }> {
    const startParam = `ayah_${input.verseKey.replace(':', '_')}`;
    const links = this.linksService.getMiniAppLinks(startParam);
    const goalsBlock =
      input.goalLines.length > 0
        ? `\n\n<b>Goals</b>\n${input.goalLines.map((line) => `• ${escapeHtml(line)}`).join('\n')}`
        : '\n\nNo incomplete goals for today.';

    const text =
      `<b>Daily reminder</b> (${escapeHtml(input.localDate)})\n` +
      `Today's ayah: <b>${escapeHtml(input.verseKey)}</b>` +
      goalsBlock;

    const message = await this.telegramApi.sendMessage({
      chatId: input.chatId,
      text,
      parseMode: 'HTML',
      disableWebPagePreview: true,
      replyMarkup: this.openMiniAppKeyboard(links.miniAppDeepLink),
    });

    return { messageId: message.message_id };
  }

  private async sendOpenMiniApp(
    chatId: number,
    text: string,
    startParam?: string,
  ): Promise<void> {
    const links = this.linksService.getMiniAppLinks(startParam);
    await this.telegramApi.sendMessage({
      chatId,
      text,
      parseMode: 'HTML',
      disableWebPagePreview: true,
      replyMarkup: this.openMiniAppKeyboard(links.miniAppDeepLink),
    });
  }

  private openMiniAppKeyboard(url: string): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          {
            text: 'Open Mini App',
            web_app: { url },
          },
        ],
      ],
    };
  }

  private extractCommandPayload(
    text: string | undefined,
    command: string,
  ): string | undefined {
    if (!text) {
      return undefined;
    }

    const botUsername = this.config.botUsername;
    const patterns = [
      new RegExp(`^/${command}(?:@${botUsername})?(?:\\s+(.+))?$`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text.trim());
      if (match) {
        return match[1]?.trim();
      }
    }

    return undefined;
  }
}
