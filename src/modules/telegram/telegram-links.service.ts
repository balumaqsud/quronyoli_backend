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
    const miniAppDeepLink = this.buildMiniAppDirectLink(startParam);
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
    const miniAppDeepLink = this.buildMiniAppDirectLink(startParam);
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

  /**
   * Telegram Direct Link (`t.me/<bot>/<shortName>`). Use for share / external
   * deep links only — requires BotFather Mini App short name.
   */
  buildMiniAppDirectLink(startParam?: string): string {
    const shortName = this.config.miniAppShortName || 'app';
    const base = `https://t.me/${this.config.botUsername}/${shortName}`;
    if (!startParam) {
      return base;
    }
    return `${base}?startapp=${encodeURIComponent(startParam)}`;
  }

  /** @deprecated Prefer buildMiniAppDirectLink — kept for call-site compatibility. */
  buildMiniAppUrl(startParam?: string): string {
    return this.buildMiniAppDirectLink(startParam);
  }

  /** HTTPS Web App origin (no trailing slash). */
  getWebAppUrl(): string {
    return this.config.webAppUrl.replace(/\/$/, '');
  }

  /**
   * HTTPS URL for inline/menu `web_app` buttons (opens Mini App without
   * relying on BotFather Direct Link short name). Optional startapp query
   * for deep links the frontend can read.
   */
  buildWebAppButtonUrl(startParam?: string): string {
    const base = this.getWebAppUrl();
    if (!startParam) {
      return base;
    }
    return `${base}/?startapp=${encodeURIComponent(startParam)}`;
  }

  /**
   * Main Mini App deep link (`t.me/<bot>?startapp=`). Works when BotFather
   * Main Mini App is configured — no short-name Direct Link required.
   */
  buildMainMiniAppUrl(startParam?: string): string {
    const base = `https://t.me/${this.config.botUsername}`;
    if (!startParam) {
      return `${base}?startapp`;
    }
    return `${base}?startapp=${encodeURIComponent(startParam)}`;
  }

  private buildShareUrl(url: string, text: string): string {
    return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  }
}
