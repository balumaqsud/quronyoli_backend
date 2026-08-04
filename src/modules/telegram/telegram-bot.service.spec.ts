import { ConfigService } from '@nestjs/config';
import {
  TelegramApi,
  TelegramSendMessageRequest,
} from './interfaces/telegram-api.interface';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramLinksService } from './telegram-links.service';

describe('TelegramBotService', () => {
  const sendMessage = jest.fn<
    Promise<{ message_id: number }>,
    [TelegramSendMessageRequest]
  >();
  sendMessage.mockResolvedValue({ message_id: 1 });

  const telegramApi = {
    sendMessage,
    sendAudio: jest.fn().mockResolvedValue({ message_id: 2 }),
    answerCallbackQuery: jest.fn().mockResolvedValue(true),
    editMessageText: jest.fn().mockResolvedValue(true),
    setMyCommands: jest.fn().mockResolvedValue(true),
    setChatMenuButton: jest.fn().mockResolvedValue(true),
  };

  const linksService = new TelegramLinksService({
    getOrThrow: () => ({
      botUsername: 'QuronYoliBot',
      miniAppUrl: 'https://t.me/QuronYoliBot/app',
      webAppUrl: 'https://quronyoli-front.vercel.app',
      miniAppShortName: 'app',
    }),
  } as never);

  const configService = {
    getOrThrow: () => ({
      botUsername: 'QuronYoliBot',
      miniAppUrl: 'https://t.me/QuronYoliBot/app',
      webAppUrl: 'https://quronyoli-front.vercel.app',
      miniAppShortName: 'app',
    }),
  } as unknown as ConfigService;

  const user = {
    id: 'user-1',
    telegramId: '42',
    username: 'test',
    firstName: 'Test',
    lastName: null,
    languageCode: 'uz',
    photoUrl: null,
    isPremium: false,
    allowsWriteToPm: true,
    isActive: true,
    deletedAt: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const usersService = {
    upsertFromTelegram: jest.fn().mockResolvedValue(user),
    findByTelegramId: jest.fn().mockResolvedValue(user),
  };

  const analyticsTracking = {
    track: jest.fn().mockResolvedValue(undefined),
  };

  const logger = { warn: jest.fn(), info: jest.fn(), debug: jest.fn() };

  const service = new TelegramBotService(
    telegramApi as unknown as TelegramApi,
    linksService,
    configService,
    usersService as never,
    analyticsTracking as never,
    logger as never,
  );

  const baseMessage = {
    message_id: 1,
    date: 1,
    chat: { id: 42, type: 'private' as const },
    from: { id: 42, is_bot: false, first_name: 'Test' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sendMessage.mockResolvedValue({ message_id: 1 });
    usersService.upsertFromTelegram.mockResolvedValue(user);
  });

  it('sends welcome with web_app and Main Mini App fallback for /start', async () => {
    await service.handleStartCommand({ ...baseMessage, text: '/start' });

    expect(usersService.upsertFromTelegram).toHaveBeenCalled();
    const payload = sendMessage.mock.calls[0]?.[0];
    expect(payload?.text).toContain("Quron Yo'liga xush kelibsiz");
    const markup = payload?.replyMarkup as {
      inline_keyboard: Array<
        Array<{ text?: string; web_app?: { url?: string }; url?: string }>
      >;
    };
    expect(markup.inline_keyboard).toHaveLength(2);
    expect(markup.inline_keyboard[0]).toHaveLength(1);
    expect(markup.inline_keyboard[0]?.[0]).toEqual({
      text: '📖 Ilovani ochish',
      web_app: { url: 'https://quronyoli-front.vercel.app' },
    });
    expect(markup.inline_keyboard[1]?.[0]).toEqual({
      text: "🌐 Quron Yo'li",
      url: 'https://t.me/QuronYoliBot?startapp',
    });
  });

  it('opens Mini App for /ilova', async () => {
    await service.handleIlovaCommand({ ...baseMessage, text: '/ilova' });
    const payload = sendMessage.mock.calls[0]?.[0];
    expect(payload?.text).toContain('Ilovani ochish');
    const markup = payload?.replyMarkup as {
      inline_keyboard: Array<Array<{ web_app?: { url?: string } }>>;
    };
    expect(markup.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
      'https://quronyoli-front.vercel.app',
    );
  });

  it('redirects /bugun to Mini App without ayah card', async () => {
    await service.handleBugunCommand({ ...baseMessage, text: '/bugun' });
    const payload = sendMessage.mock.calls[0]?.[0];
    expect(payload?.text).toContain('Ilovada');
    const markup = payload?.replyMarkup as {
      inline_keyboard: Array<Array<{ web_app?: { url?: string } }>>;
    };
    expect(markup.inline_keyboard[0]?.[0]?.web_app?.url).toBe(
      'https://quronyoli-front.vercel.app',
    );
  });

  it('redirects /saqlangan to Mini App', async () => {
    await service.handleSaqlanganCommand({
      ...baseMessage,
      text: '/saqlangan',
    });
    expect(sendMessage.mock.calls[0]?.[0]?.text).toContain('Saqlangan');
  });

  it('sends daily reminder text in Uzbek with open button', async () => {
    await service.sendDailyReminder({
      chatId: 42,
      localDate: '2026-08-01',
      verseKey: '2:255',
      goalLines: ['VERSES: 3/10'],
    });

    expect(sendMessage.mock.calls[0]?.[0]?.text).toContain(
      '<b>Kunlik eslatma</b>',
    );
    const markup = sendMessage.mock.calls[0]?.[0]?.replyMarkup as {
      inline_keyboard: Array<
        Array<{ web_app?: { url?: string }; url?: string }>
      >;
    };
    expect(markup.inline_keyboard).toHaveLength(2);
    expect(markup.inline_keyboard[0]?.[0]?.web_app?.url).toContain(
      'startapp=ayah_2_255',
    );
    expect(markup.inline_keyboard[1]?.[0]?.url).toContain(
      'startapp=ayah_2_255',
    );
  });
});
