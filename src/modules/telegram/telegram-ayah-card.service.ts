import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { parseVerseKey } from '../../common/quran/ayah-coordinate';
import { QuranService } from '../quran/quran.service';
import { SettingsService } from '../settings/settings.service';
import {
  DEFAULT_BOT_RECITER_EXTERNAL_ID,
  TELEGRAM_HTML_LIMIT,
} from './telegram-bot.commands';
import {
  TelegramInlineKeyboardButton,
  TelegramInlineKeyboardMarkup,
} from './interfaces/telegram-api.interface';
import { TelegramLinksService } from './telegram-links.service';
import { encodeVerseKey } from './utils/telegram-callbacks';
import {
  buildAyahStartPayload,
  escapeHtml,
} from './utils/telegram-text.utils';

export type AyahCardContent = {
  verseKey: string;
  chapterNumber: number;
  verseNumber: number;
  text: string;
  keyboard: TelegramInlineKeyboardMarkup;
};

type VersePayload = {
  verse?: {
    verse_key?: string;
    chapter_id?: number;
    verse_number?: number;
    text_uthmani?: string;
    translations?: Array<{ text?: string }>;
  };
  verses?: Array<{
    verse_key?: string;
    chapter_id?: number;
    verse_number?: number;
    text_uthmani?: string;
    translations?: Array<{ text?: string }>;
  }>;
};

type TafsirPayload = {
  tafsir?: { text?: string };
};

type AudioPayload = {
  audio_files?: Array<{ url?: string }>;
  audio_file?: { url?: string };
};

@Injectable()
export class TelegramAyahCardService {
  constructor(
    private readonly quranService: QuranService,
    private readonly settingsService: SettingsService,
    private readonly linksService: TelegramLinksService,
    @InjectPinoLogger(TelegramAyahCardService.name)
    private readonly logger: PinoLogger,
  ) {}

  async buildCard(
    userId: string,
    verseKey: string,
    title: string,
  ): Promise<AyahCardContent> {
    const coordinate = parseVerseKey(verseKey);
    const prefs = await this.settingsService.getBotContentPrefs(userId);
    const query: {
      fields: string;
      translations?: string;
    } = {
      fields: 'text_uthmani,verse_key,chapter_id,verse_number',
    };
    if (prefs.translationExternalId) {
      query.translations = prefs.translationExternalId;
    }

    const payload = (await this.quranService.getAyahByKey(
      coordinate.verseKey,
      query,
    )) as VersePayload;

    const verse = payload.verse ?? payload.verses?.[0];
    const arabic = verse?.text_uthmani?.trim() ?? '';
    const translation = stripHtml(verse?.translations?.[0]?.text ?? '').trim();

    const lines = [
      `<b>${escapeHtml(title)}</b>`,
      '',
      arabic ? escapeHtml(arabic) : '',
      translation ? `\n${escapeHtml(translation)}` : '',
      '',
      `<b>${escapeHtml(coordinate.verseKey)}</b>`,
    ].filter((line, index, arr) => !(line === '' && arr[index - 1] === ''));

    let text = lines.join('\n').trim();
    if (text.length > TELEGRAM_HTML_LIMIT) {
      text = `${text.slice(0, TELEGRAM_HTML_LIMIT - 1)}…`;
    }

    return {
      verseKey: coordinate.verseKey,
      chapterNumber: coordinate.chapterNumber,
      verseNumber: coordinate.verseNumber,
      text,
      keyboard: this.ayahActionKeyboard(coordinate.verseKey),
    };
  }

  ayahActionKeyboard(verseKey: string): TelegramInlineKeyboardMarkup {
    const encoded = encodeVerseKey(verseKey);
    const share = this.linksService.getAyahShareLinks(
      Number(verseKey.split(':')[0]),
      Number(verseKey.split(':')[1]),
    );

    const startParam = buildAyahStartPayload(
      Number(verseKey.split(':')[0]),
      Number(verseKey.split(':')[1]),
    );

    const rows: TelegramInlineKeyboardButton[][] = [
      [
        { text: '🎧 Tinglash', callback_data: `PLAY_AUDIO:${encoded}` },
        { text: '📚 Tafsir', callback_data: `SHOW_TAFSIR:${encoded}` },
      ],
      [
        { text: '❤️ Saqlash', callback_data: `SAVE_BOOKMARK:${encoded}` },
        { text: '📤 Ulashish', url: share.shareUrl },
      ],
      [
        {
          text: '📖 Ilovani ochish',
          web_app: {
            url: this.linksService.buildWebAppButtonUrl(startParam),
          },
        },
      ],
      [
        {
          text: "🌐 Quron Yo'li",
          url: this.linksService.buildMainMiniAppUrl(startParam),
        },
      ],
    ];

    return { inline_keyboard: rows };
  }

  async resolveAudioUrl(
    userId: string,
    verseKey: string,
  ): Promise<string | null> {
    const prefs = await this.settingsService.getBotContentPrefs(userId);
    const reciterId = Number.parseInt(
      prefs.reciterExternalId ?? DEFAULT_BOT_RECITER_EXTERNAL_ID,
      10,
    );
    if (!Number.isFinite(reciterId)) {
      return null;
    }

    try {
      const payload = (await this.quranService.getAyahAudioByKey(
        reciterId,
        verseKey,
      )) as AudioPayload;
      const url =
        payload.audio_files?.[0]?.url ?? payload.audio_file?.url ?? null;
      return typeof url === 'string' && url.length > 0 ? url : null;
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : 'unknown', verseKey },
        'Failed to resolve ayah audio for Telegram',
      );
      return null;
    }
  }

  async resolveTafsirText(
    userId: string,
    verseKey: string,
  ): Promise<string | null> {
    const prefs = await this.settingsService.getBotContentPrefs(userId);
    if (!prefs.tafsirExternalId) {
      return null;
    }
    const resourceId = Number.parseInt(prefs.tafsirExternalId, 10);
    if (!Number.isFinite(resourceId)) {
      return null;
    }

    try {
      const payload = (await this.quranService.getTafsirByAyah(
        resourceId,
        verseKey,
      )) as TafsirPayload;
      const raw = stripHtml(payload.tafsir?.text ?? '').trim();
      if (!raw) {
        return null;
      }
      if (raw.length > TELEGRAM_HTML_LIMIT) {
        return `${raw.slice(0, TELEGRAM_HTML_LIMIT - 1)}…`;
      }
      return raw;
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error.message : 'unknown', verseKey },
        'Failed to resolve tafsir for Telegram',
      );
      return null;
    }
  }
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}
