import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { TelegramWebhookGuard } from './telegram-webhook.guard';

describe('TelegramWebhookGuard', () => {
  const createGuard = (secret: string) =>
    new TelegramWebhookGuard({
      getOrThrow: () => ({ webhookSecret: secret }),
    } as unknown as ConfigService);

  const createContext = (header?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: header ? { 'x-telegram-bot-api-secret-token': header } : {},
        }),
      }),
    }) as unknown as ExecutionContext;

  it('accepts a matching secret', () => {
    const guard = createGuard('super-secret-token');
    expect(guard.canActivate(createContext('super-secret-token'))).toBe(true);
  });

  it('rejects a mismatched secret', () => {
    const guard = createGuard('super-secret-token');
    expect(() => guard.canActivate(createContext('wrong'))).toThrow(
      UnauthorizedException,
    );
  });
});
