import { TelegramUpdateDispatcher } from './telegram-update.dispatcher';

describe('TelegramUpdateDispatcher', () => {
  const botService = {
    handleStartCommand: jest.fn(),
    handleAppCommand: jest.fn(),
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

  it('routes /app to the bot service', async () => {
    await dispatcher.dispatch({
      update_id: 2,
      message: {
        message_id: 11,
        chat: { id: 42, type: 'private' },
        date: 1,
        text: '/app',
      },
    });

    expect(botService.handleAppCommand).toHaveBeenCalled();
  });

  it('ignores unsupported updates', async () => {
    await dispatcher.dispatch({ update_id: 3 });
    expect(botService.handleStartCommand).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });
});
