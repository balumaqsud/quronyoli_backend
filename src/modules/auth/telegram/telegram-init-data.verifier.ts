import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { CONFIG_KEYS } from '../../../common/constants';
import { TelegramConfig } from '../../../config/configuration';
import {
  TelegramWebAppUser,
  VerifiedTelegramInitData,
} from './interfaces/telegram-init-data.interface';

@Injectable()
export class TelegramInitDataVerifier {
  private readonly telegramConfig: TelegramConfig;

  constructor(private readonly configService: ConfigService) {
    this.telegramConfig = this.configService.getOrThrow<TelegramConfig>(
      CONFIG_KEYS.TELEGRAM,
    );
  }

  verify(initData: string): VerifiedTelegramInitData {
    if (!initData || initData.trim().length === 0) {
      throw new UnauthorizedException('Telegram initData is required');
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      throw new UnauthorizedException('Telegram initData hash is missing');
    }

    const dataCheckString = [...params.entries()]
      .filter(([key]) => key !== 'hash' && key !== 'signature')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData')
      .update(this.telegramConfig.botToken)
      .digest();

    const computedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const providedBuffer = Buffer.from(hash, 'hex');
    const computedBuffer = Buffer.from(computedHash, 'hex');

    if (
      providedBuffer.length !== computedBuffer.length ||
      !timingSafeEqual(providedBuffer, computedBuffer)
    ) {
      throw new UnauthorizedException('Invalid Telegram initData signature');
    }

    const authDateRaw = params.get('auth_date');

    if (!authDateRaw) {
      throw new UnauthorizedException('Telegram auth_date is missing');
    }

    const authDateSeconds = Number.parseInt(authDateRaw, 10);

    if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
      throw new UnauthorizedException('Telegram auth_date is invalid');
    }

    const authDate = new Date(authDateSeconds * 1000);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ageSeconds = nowSeconds - authDateSeconds;

    if (ageSeconds < -60) {
      throw new UnauthorizedException('Telegram auth_date is in the future');
    }

    if (ageSeconds > this.telegramConfig.initDataMaxAgeSeconds) {
      throw new UnauthorizedException('Telegram initData has expired');
    }

    const userRaw = params.get('user');

    if (!userRaw) {
      throw new UnauthorizedException('Telegram user payload is missing');
    }

    const user = this.parseUser(userRaw);

    return {
      user,
      authDate,
      queryId: params.get('query_id') ?? undefined,
      chatInstance: params.get('chat_instance') ?? undefined,
      chatType: params.get('chat_type') ?? undefined,
      startParam: params.get('start_param') ?? undefined,
    };
  }

  private parseUser(userRaw: string): TelegramWebAppUser {
    let parsed: unknown;

    try {
      parsed = JSON.parse(userRaw) as unknown;
    } catch {
      throw new UnauthorizedException('Telegram user payload is invalid JSON');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new UnauthorizedException('Telegram user payload is invalid');
    }

    const candidate = parsed as Record<string, unknown>;

    if (typeof candidate.id !== 'number' || !Number.isInteger(candidate.id)) {
      throw new UnauthorizedException('Telegram user id is invalid');
    }

    if (
      typeof candidate.first_name !== 'string' ||
      candidate.first_name.trim().length === 0
    ) {
      throw new UnauthorizedException('Telegram user first_name is invalid');
    }

    return {
      id: candidate.id,
      first_name: candidate.first_name,
      last_name:
        typeof candidate.last_name === 'string'
          ? candidate.last_name
          : undefined,
      username:
        typeof candidate.username === 'string' ? candidate.username : undefined,
      language_code:
        typeof candidate.language_code === 'string'
          ? candidate.language_code
          : undefined,
      is_premium:
        typeof candidate.is_premium === 'boolean'
          ? candidate.is_premium
          : undefined,
      allows_write_to_pm:
        typeof candidate.allows_write_to_pm === 'boolean'
          ? candidate.allows_write_to_pm
          : undefined,
      photo_url:
        typeof candidate.photo_url === 'string'
          ? candidate.photo_url
          : undefined,
    };
  }
}
