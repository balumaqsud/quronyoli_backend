import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS, TELEGRAM_API } from '../../common/constants';
import { TelegramConfig } from '../../config/configuration';
import { isValidAyahCoordinate } from '../../common/quran/quran-coordinates';
import { buildDailyReminderTelegramText } from '../notifications/notification-copy';
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
      await this.sendOpenMiniApp(message.chat.id, this.welcomeMessage());
      return;
    }

    await this.sendOpenMiniApp(message.chat.id, this.welcomeMessage());
  }

  async handleAppCommand(message: TelegramIncomingMessage): Promise<void> {
    await this.sendOpenMiniApp(message.chat.id, this.welcomeMessage());
  }

  async sendDailyReminder(input: {
    chatId: number | string;
    localDate: string;
    verseKey: string;
    goalLines: string[];
  }): Promise<{ messageId: number }> {
    const startParam = `ayah_${input.verseKey.replace(':', '_')}`;
    const links = this.linksService.getMiniAppLinks(startParam);
    const text = buildDailyReminderTelegramText({
      localDate: input.localDate,
      verseKey: input.verseKey,
      goalLines: input.goalLines,
      escapeHtml,
    });

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
      replyMarkup: this.openMiniAppKeyboard(
        links.miniAppDeepLink,
        startParam === undefined,
      ),
    });
  }

  private welcomeMessage(): string {
    return [
      'Assalomu alaykum va rahmatullohi va barokatuh!',
      '',
      `<b>Quron Yo'li</b> ilovasiga xush kelibsiz!`,
      '',
      `Qur'oni Karim bilan har kuni yaqinroq bo'ling: tilovat qiling, ma'nolarini o'rganing, qiroatlarni tinglang va o'qish davomiyligingizni kuzatib boring.`,
      '',
      `Alloh taolo ilmimizni ziyoda, qalbimizni Qur'on nuri bilan munavvar qilsin.`,
      '',
      'Boshlash uchun quyidagi tugmani bosing.',
    ].join('\n');
  }

  private openMiniAppKeyboard(
    url: string,
    openDirectly = false,
  ): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          openDirectly
            ? {
                text: 'Ilovani ochish',
                web_app: { url: this.config.webAppUrl },
              }
            : { text: 'Ilovani ochish', url },
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
