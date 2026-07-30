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
      webAppUrl: 'https://quronyoli-front.vercel.app',
    }),
  } as never);

  const configService = {
    getOrThrow: () => ({
      botUsername: 'QuronYoliBot',
      miniAppUrl: 'https://t.me/QuronYoliBot/app',
      webAppUrl: 'https://quronyoli-front.vercel.app',
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

  const expectedWelcome = [
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

  beforeEach(() => {
    sendMessage.mockClear();
  });

  it('sends a welcoming Uzbek message and url button for /start', async () => {
    await service.handleStartCommand({ ...baseMessage, text: '/start' });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 42,
        text: expectedWelcome,
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: 'Ilovani ochish',
                web_app: { url: 'https://quronyoli-front.vercel.app' },
              },
            ],
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
                text: 'Ilovani ochish',
                url: 'https://t.me/QuronYoliBot/app?startapp=ayah_2_255',
              },
            ],
          ],
        },
      }),
    );
  });
});
