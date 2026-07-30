import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../common/constants';
import { TelegramConfig } from '../../config/configuration';
import { buildAyahStartPayload } from './utils/telegram-text.utils';

export interface TelegramLinkBundle {
  botDeepLink: string;
  miniAppDeepLink: string;
  shareUrl: string;
  shareText: string;
  verseKey?: string;
}

@Injectable()
export class TelegramLinksService {
  private readonly config: TelegramConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.getOrThrow<TelegramConfig>(
      CONFIG_KEYS.TELEGRAM,
    );
  }

  getMiniAppLinks(startParam?: string): TelegramLinkBundle {
    const miniAppDeepLink = this.buildMiniAppUrl(startParam);
    const botDeepLink = startParam
      ? `https://t.me/${this.config.botUsername}?start=${encodeURIComponent(startParam)}`
      : `https://t.me/${this.config.botUsername}?start=app`;

    const shareText = "Open Quron Yo'li in Telegram";
    return {
      botDeepLink,
      miniAppDeepLink,
      shareUrl: this.buildShareUrl(miniAppDeepLink, shareText),
      shareText,
    };
  }

  getAyahShareLinks(
    chapterNumber: number,
    verseNumber: number,
  ): TelegramLinkBundle {
    const verseKey = `${chapterNumber}:${verseNumber}`;
    const startParam = buildAyahStartPayload(chapterNumber, verseNumber);
    const miniAppDeepLink = this.buildMiniAppUrl(startParam);
    const botDeepLink = `https://t.me/${this.config.botUsername}?start=${encodeURIComponent(startParam)}`;
    const shareText = `Read Quran ${verseKey} in Quron Yo'li`;

    return {
      botDeepLink,
      miniAppDeepLink,
      shareUrl: this.buildShareUrl(miniAppDeepLink, shareText),
      shareText,
      verseKey,
    };
  }

  buildMiniAppUrl(startParam?: string): string {
    const base = this.config.miniAppUrl.replace(/\/$/, '');
    if (!startParam) {
      return base;
    }

    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}startapp=${encodeURIComponent(startParam)}`;
  }

  private buildShareUrl(url: string, text: string): string {
    return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  }
}
