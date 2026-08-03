import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CONFIG_KEYS, TELEGRAM_API } from '../../common/constants';
import { isValidAyahCoordinate } from '../../common/quran/quran-coordinates';
import { TelegramConfig } from '../../config/configuration';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
import { buildDailyReminderTelegramText } from '../notifications/notification-copy';
import { User } from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import {
  TelegramApi,
  TelegramCallbackQuery,
  TelegramIncomingMessage,
  TelegramInlineKeyboardMarkup,
  TelegramUser,
} from './interfaces/telegram-api.interface';
import { TelegramLinksService } from './telegram-links.service';
import { parseCallbackData } from './utils/telegram-callbacks';
import { escapeHtml, parseAyahStartPayload } from './utils/telegram-text.utils';

/**
 * Mini App–first bot: chat is an entry door with a single Ilovani ochish button.
 * Legacy commands soft-redirect into the Mini App (no in-chat product UX).
 */
@Injectable()
export class TelegramBotService {
  private readonly config: TelegramConfig;
  private readonly appVersion: string;

  constructor(
    @Inject(TELEGRAM_API) private readonly telegramApi: TelegramApi,
    private readonly linksService: TelegramLinksService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly analyticsTracking: AnalyticsTrackingService,
    @InjectPinoLogger(TelegramBotService.name)
    private readonly logger: PinoLogger,
  ) {
    this.config = this.configService.getOrThrow<TelegramConfig>(
      CONFIG_KEYS.TELEGRAM,
    );
    this.appVersion = this.readPackageVersion();
  }

  async resolveUserFromTelegram(from?: TelegramUser): Promise<User | null> {
    if (!from || from.is_bot) {
      return null;
    }

    return this.usersService.upsertFromTelegram({
      telegramId: String(from.id),
      username: from.username,
      firstName: from.first_name || 'User',
      lastName: from.last_name,
      languageCode: from.language_code ?? 'uz',
      isPremium: Boolean(from.is_premium),
      allowsWriteToPm: true,
    });
  }

  async handleStartCommand(message: TelegramIncomingMessage): Promise<void> {
    const user = await this.resolveUserFromTelegram(message.from);
    await this.trackCommand(user?.id, 'start');

    const payload = this.extractCommandPayload(message.text, 'start');
    const ayah = parseAyahStartPayload(payload);

    if (ayah && isValidAyahCoordinate(ayah.chapterNumber, ayah.verseNumber)) {
      await this.sendOpenMiniApp(
        message.chat.id,
        `Oyat <b>${escapeHtml(ayah.verseKey)}</b> ni Quron Yo'lida oching.`,
        `ayah_${ayah.chapterNumber}_${ayah.verseNumber}`,
      );
      return;
    }

    await this.sendOpenMiniApp(message.chat.id, this.welcomeMessage());
  }

  async handleIlovaCommand(message: TelegramIncomingMessage): Promise<void> {
    const user = await this.resolveUserFromTelegram(message.from);
    await this.trackCommand(user?.id, 'ilova');
    await this.sendOpenMiniApp(
      message.chat.id,
      'Ilovani ochish uchun tugmani bosing.',
    );
  }

  async handleAppCommand(message: TelegramIncomingMessage): Promise<void> {
    await this.handleIlovaCommand(message);
  }

  async handleBugunCommand(message: TelegramIncomingMessage): Promise<void> {
    await this.redirectToMiniApp(
      message,
      'bugun',
      'Bugungi oyat Ilovada ochiladi.',
    );
  }

  async handleTasodifiyCommand(
    message: TelegramIncomingMessage,
  ): Promise<void> {
    await this.redirectToMiniApp(
      message,
      'tasodifiy',
      'Tasodifiy oyat Ilovada ochiladi.',
    );
  }

  async handleYordamCommand(message: TelegramIncomingMessage): Promise<void> {
    await this.redirectToMiniApp(message, 'yordam', this.helpMessage());
  }

  async handleHaqimizdaCommand(
    message: TelegramIncomingMessage,
  ): Promise<void> {
    await this.redirectToMiniApp(message, 'haqimizda', this.aboutMessage());
  }

  async handleSuralarCommand(message: TelegramIncomingMessage): Promise<void> {
    await this.redirectToMiniApp(
      message,
      'suralar',
      'Surahlar ro‘yxati Ilovada ochiladi.',
    );
  }

  async handleJuzCommand(message: TelegramIncomingMessage): Promise<void> {
    await this.redirectToMiniApp(message, 'juz', 'Juzlar Ilovada ochiladi.');
  }

  async handleDavomCommand(message: TelegramIncomingMessage): Promise<void> {
    await this.redirectToMiniApp(
      message,
      'davom',
      'O‘qishni davom ettirish Ilovada ochiladi.',
    );
  }

  async handleSaqlanganCommand(
    message: TelegramIncomingMessage,
  ): Promise<void> {
    await this.redirectToMiniApp(
      message,
      'saqlangan',
      'Saqlangan oyatlar Ilovada ochiladi.',
    );
  }

  async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const parsed = parseCallbackData(query.data ?? '');
    const chatId = query.message?.chat.id;

    if (!parsed || chatId === undefined) {
      await this.telegramApi.answerCallbackQuery({
        callbackQueryId: query.id,
        text: 'Noma’lum amal',
      });
      return;
    }

    try {
      await this.telegramApi.answerCallbackQuery({
        callbackQueryId: query.id,
      });

      let startParam: string | undefined;
      let text = 'Ilovani ochish uchun tugmani bosing.';

      switch (parsed.type) {
        case 'OPEN_AYAH':
          startParam = `ayah_${parsed.verseKey.replace(':', '_')}`;
          text = `Oyat <b>${escapeHtml(parsed.verseKey)}</b> ni Ilovada oching.`;
          break;
        case 'OPEN_SURAH':
          startParam = `surah_${parsed.chapterNumber}`;
          text = `Sura ${parsed.chapterNumber} ni Ilovada oching.`;
          break;
        case 'OPEN_JUZ':
          startParam = `juz_${parsed.juzNumber}`;
          text = `Juz ${parsed.juzNumber} ni Ilovada oching.`;
          break;
        case 'OPEN_PAGE':
          startParam = `page_${parsed.pageNumber}`;
          text = `Sahifa ${parsed.pageNumber} ni Ilovada oching.`;
          break;
        case 'BUGUN':
        case 'TASODIFIY':
        case 'YORDAM':
        case 'OPEN_APP':
        case 'PLAY_AUDIO':
        case 'SHOW_TAFSIR':
        case 'SAVE_BOOKMARK':
        case 'NEXT_PAGE':
        case 'PREV_PAGE':
        default:
          break;
      }

      await this.sendOpenMiniApp(chatId, text, startParam);
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : 'unknown' },
        'Telegram callback failed',
      );
      await this.telegramApi.answerCallbackQuery({
        callbackQueryId: query.id,
        text: 'Xatolik yuz berdi',
        showAlert: true,
      });
    }
  }

  async sendDailyReminder(input: {
    chatId: number | string;
    localDate: string;
    verseKey: string;
    goalLines: string[];
  }): Promise<{ messageId: number }> {
    const startParam = `ayah_${input.verseKey.replace(':', '_')}`;
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
      replyMarkup: this.openMiniAppKeyboard(startParam),
    });

    return { messageId: message.message_id };
  }

  private async redirectToMiniApp(
    message: TelegramIncomingMessage,
    command: string,
    text: string,
    startParam?: string,
  ): Promise<void> {
    const user = await this.resolveUserFromTelegram(message.from);
    await this.trackCommand(user?.id, command);
    await this.sendOpenMiniApp(message.chat.id, text, startParam);
  }

  private async sendOpenMiniApp(
    chatId: number,
    text: string,
    startParam?: string,
  ): Promise<void> {
    await this.telegramApi.sendMessage({
      chatId,
      text,
      parseMode: 'HTML',
      disableWebPagePreview: true,
      replyMarkup: this.openMiniAppKeyboard(startParam),
    });
  }

  private welcomeMessage(): string {
    return [
      '🌿 Assalomu alaykum!',
      '',
      "Quron Yo'liga xush kelibsiz.",
      '',
      "Qur'onni o'qing, tinglang va anglang — barchasi Ilovada.",
      '',
      'Davom etish uchun tugmani bosing.',
    ].join('\n');
  }

  private helpMessage(): string {
    return [
      '<b>Yordam</b>',
      '',
      'Barcha funksiyalar Mini App ichida:',
      'bugungi oyat, tilovat, tafsir, saqlanganlar, sozlamalar.',
      '',
      'Ilovani ochish uchun tugmani bosing.',
    ].join('\n');
  }

  private aboutMessage(): string {
    return [
      "<b>Quron Yo'li</b>",
      `Versiya: <b>${escapeHtml(this.appVersion)}</b>`,
      '',
      "Maqsad: Qur'oni Karimni o‘qish, tinglash va anglashni osonlashtirish.",
      '',
      'Davom etish uchun Ilovani oching.',
    ].join('\n');
  }

  private ilovaniOchishButton(startParam?: string): {
    text: string;
    web_app: { url: string };
  } {
    return {
      text: '📖 Ilovani ochish',
      web_app: { url: this.linksService.buildWebAppButtonUrl(startParam) },
    };
  }

  private openMiniAppKeyboard(
    startParam?: string,
  ): TelegramInlineKeyboardMarkup {
    return {
      inline_keyboard: [[this.ilovaniOchishButton(startParam)]],
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
    const pattern = new RegExp(
      `^/${command}(?:@${botUsername})?(?:\\s+(.+))?$`,
      'i',
    );
    const match = pattern.exec(text.trim());
    return match?.[1]?.trim();
  }

  private async trackCommand(
    userId: string | undefined,
    command: string,
  ): Promise<void> {
    if (!userId) {
      return;
    }
    await this.analyticsTracking.track({
      userId,
      eventName: 'APP_OPEN',
      properties: {
        source: 'telegram-bot',
        command,
      },
    });
  }

  private readPackageVersion(): string {
    try {
      const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
      const parsed = JSON.parse(raw) as { version?: string };
      return parsed.version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
}
