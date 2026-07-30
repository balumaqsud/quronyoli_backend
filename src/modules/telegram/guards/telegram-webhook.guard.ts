import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import {
  CONFIG_KEYS,
  TELEGRAM_WEBHOOK_SECRET_HEADER,
} from '../../../common/constants';
import { TelegramConfig } from '../../../config/configuration';

@Injectable()
export class TelegramWebhookGuard implements CanActivate {
  private readonly expectedSecret: string;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.getOrThrow<TelegramConfig>(
      CONFIG_KEYS.TELEGRAM,
    );
    this.expectedSecret = config.webhookSecret;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const headerValue = request.headers[TELEGRAM_WEBHOOK_SECRET_HEADER];
    const provided = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!provided || !this.secretsEqual(provided, this.expectedSecret)) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    return true;
  }

  private secretsEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  }
}
