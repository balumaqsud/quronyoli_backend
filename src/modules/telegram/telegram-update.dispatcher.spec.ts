import { TelegramUpdateDispatcher } from './telegram-update.dispatcher';

describe('TelegramUpdateDispatcher', () => {
  const botService = {
    handleStartCommand: jest.fn(),
    handleIlovaCommand: jest.fn(),
    handleBugunCommand: jest.fn(),
    handleTasodifiyCommand: jest.fn(),
    handleSuralarCommand: jest.fn(),
    handleJuzCommand: jest.fn(),
    handleDavomCommand: jest.fn(),
    handleSaqlanganCommand: jest.fn(),
    handleYordamCommand: jest.fn(),
    handleHaqimizdaCommand: jest.fn(),
    handleCallbackQuery: jest.fn(),
  };
  const logger = { debug: jest.fn() };
  const dispatcher = new TelegramUpdateDispatcher(
    botService as never,
    logger as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes /start to the bot service', async () => {
    await dispatcher.dispatch({
      update_id: 1,
      message: {
        message_id: 10,
        chat: { id: 42, type: 'private' },
        date: 1,
        text: '/start ayah_1_1',
      },
    });

    expect(botService.handleStartCommand).toHaveBeenCalled();
  });

  it('routes /ilova and /app to ilova handler', async () => {
    await dispatcher.dispatch({
      update_id: 2,
      message: {
        message_id: 11,
        chat: { id: 42, type: 'private' },
        date: 1,
        text: '/ilova',
      },
    });
    expect(botService.handleIlovaCommand).toHaveBeenCalled();

    await dispatcher.dispatch({
      update_id: 3,
      message: {
        message_id: 12,
        chat: { id: 42, type: 'private' },
        date: 1,
        text: '/app',
      },
    });
    expect(botService.handleIlovaCommand).toHaveBeenCalledTimes(2);
  });

  it('routes /bugun and /tasodifiy', async () => {
    await dispatcher.dispatch({
      update_id: 4,
      message: {
        message_id: 13,
        chat: { id: 42, type: 'private' },
        date: 1,
        text: '/bugun',
      },
    });
    await dispatcher.dispatch({
      update_id: 5,
      message: {
        message_id: 14,
        chat: { id: 42, type: 'private' },
        date: 1,
        text: '/tasodifiy@QuronYoliBot',
      },
    });
    expect(botService.handleBugunCommand).toHaveBeenCalled();
    expect(botService.handleTasodifiyCommand).toHaveBeenCalled();
  });

  it('routes callback queries', async () => {
    await dispatcher.dispatch({
      update_id: 6,
      callback_query: {
        id: 'cq-1',
        from: { id: 42, is_bot: false, first_name: 'Test' },
        chat_instance: '1',
        data: 'BUGUN',
      },
    });
    expect(botService.handleCallbackQuery).toHaveBeenCalled();
  });

  it('ignores unsupported updates', async () => {
    await dispatcher.dispatch({ update_id: 7 });
    expect(botService.handleStartCommand).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });
});
