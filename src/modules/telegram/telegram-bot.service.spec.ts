import { ConfigService } from '@nestjs/config';
import { TelegramApi } from './interfaces/telegram-api.interface';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramLinksService } from './telegram-links.service';

describe('TelegramBotService', () => {
  const sendMessage = jest.fn().mockResolvedValue({ message_id: 1 });
  const telegramApi: Pick<TelegramApi, 'sendMessage'> = { sendMessage };

  const linksService = new TelegramLinksService({
    getOrThrow: () => ({
      botUsername: 'QuronYoliBot',
      miniAppUrl: 'https://t.me/QuronYoliBot/app',
    }),
  } as never);

  const configService = {
    getOrThrow: () => ({
      botUsername: 'QuronYoliBot',
      miniAppUrl: 'https://t.me/QuronYoliBot/app',
    }),
  } as unknown as ConfigService;

  const service = new TelegramBotService(
    telegramApi as TelegramApi,
    linksService,
    configService,
  );

  const baseMessage = {
    message_id: 1,
    date: 1,
    chat: { id: 42, type: 'private' as const },
    from: { id: 42, is_bot: false, first_name: 'Test' },
  };

  beforeEach(() => {
    sendMessage.mockClear();
  });

  it('sends a url button (not web_app) for /start', async () => {
    await service.handleStartCommand({ ...baseMessage, text: '/start' });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 42,
        replyMarkup: {
          inline_keyboard: [
            [{ text: 'Open Mini App', url: 'https://t.me/QuronYoliBot/app' }],
          ],
        },
      }),
    );
  });

  it('includes startapp payload for /start ayah_2_255', async () => {
    await service.handleStartCommand({
      ...baseMessage,
      text: '/start ayah_2_255',
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 42,
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: 'Open Mini App',
                url: 'https://t.me/QuronYoliBot/app?startapp=ayah_2_255',
              },
            ],
          ],
        },
      }),
    );
  });
});
