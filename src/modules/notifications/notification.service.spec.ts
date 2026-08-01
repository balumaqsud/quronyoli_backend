import {
  NotificationDeliveryStatus,
  DailyGoalMetric,
} from '../../generated/prisma';
import { TelegramBlockedError } from '../telegram/errors/telegram-error.mapper';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { NotificationService } from './notification.service';
import { NotificationsRepository } from './notifications.repository';
import {
  buildDeliveryJobId,
  candidateLocalTimes,
} from './queues/reminder-jobs';

describe('reminder-jobs helpers', () => {
  it('builds stable delivery job ids', () => {
    expect(buildDeliveryJobId('user-1', '2026-07-30')).toBe(
      'daily-reminder:user-1:2026-07-30',
    );
  });

  it('produces candidate local times across offsets', () => {
    const times = candidateLocalTimes(new Date('2026-07-30T12:00:00.000Z'));
    expect(times).toContain('12:00');
    expect(times.length).toBeGreaterThan(10);
  });
});

describe('NotificationService', () => {
  let repository: jest.Mocked<
    Pick<
      NotificationsRepository,
      | 'findUserForDelivery'
      | 'claimDelivery'
      | 'markDeliverySent'
      | 'markDeliveryFailed'
      | 'findActiveGoalsProgress'
      | 'upsertUserNotification'
    >
  >;
  let botService: jest.Mocked<Pick<TelegramBotService, 'sendDailyReminder'>>;
  let service: NotificationService;

  beforeEach(() => {
    repository = {
      findUserForDelivery: jest.fn(),
      claimDelivery: jest.fn(),
      markDeliverySent: jest.fn(),
      markDeliveryFailed: jest.fn(),
      findActiveGoalsProgress: jest.fn(),
      upsertUserNotification: jest.fn().mockResolvedValue({} as never),
    };
    botService = {
      sendDailyReminder: jest.fn(),
    };
    service = new NotificationService(
      repository as unknown as NotificationsRepository,
      botService as unknown as TelegramBotService,
    );
  });

  it('sends a reminder and records success', async () => {
    repository.findUserForDelivery.mockResolvedValue({
      id: 'user-1',
      telegramId: '42',
      allowsWriteToPm: true,
      settings: { timezone: 'Asia/Tashkent' },
    });
    repository.claimDelivery.mockResolvedValue({
      claimed: true,
      delivery: {
        id: 'delivery-1',
        status: NotificationDeliveryStatus.PENDING,
      } as never,
    });
    repository.findActiveGoalsProgress.mockResolvedValue({
      goals: [
        {
          id: 'goal-1',
          metric: DailyGoalMetric.VERSES,
          targetValue: 10,
        } as never,
      ],
      versesRead: 3,
      activeSeconds: 0,
    });
    botService.sendDailyReminder.mockResolvedValue({ messageId: 99 });

    const result = await service.deliverDailyReminder({
      userId: 'user-1',
      localDate: '2026-07-30',
    });

    expect(result).toEqual({ status: 'sent', messageId: '99' });
    expect(repository.upsertUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        dedupeKey: '2026-07-30',
        title: 'Kunlik eslatma',
      }),
    );
    expect(botService.sendDailyReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: '42',
        goalLines: ['VERSES: 3/10'],
      }),
    );
    expect(repository.markDeliverySent).toHaveBeenCalledWith({
      id: 'delivery-1',
      telegramMessageId: '99',
    });
  });

  it('upserts inbox even when write-to-pm is disabled', async () => {
    repository.findUserForDelivery.mockResolvedValue({
      id: 'user-1',
      telegramId: '42',
      allowsWriteToPm: false,
      settings: { timezone: 'Asia/Tashkent' },
    });
    repository.claimDelivery.mockResolvedValue({
      claimed: true,
      delivery: {
        id: 'delivery-1',
        status: NotificationDeliveryStatus.PENDING,
      } as never,
    });
    repository.findActiveGoalsProgress.mockResolvedValue({
      goals: [],
      versesRead: 0,
      activeSeconds: 0,
    });

    await expect(
      service.deliverDailyReminder({
        userId: 'user-1',
        localDate: '2026-07-30',
      }),
    ).resolves.toEqual({ status: 'skipped', reason: 'write_to_pm_disabled' });

    expect(repository.upsertUserNotification).toHaveBeenCalled();
    expect(botService.sendDailyReminder).not.toHaveBeenCalled();
  });

  it('skips blocked Telegram chats without retrying', async () => {
    repository.findUserForDelivery.mockResolvedValue({
      id: 'user-1',
      telegramId: '42',
      allowsWriteToPm: true,
      settings: { timezone: 'Asia/Tashkent' },
    });
    repository.claimDelivery.mockResolvedValue({
      claimed: true,
      delivery: {
        id: 'delivery-1',
        status: NotificationDeliveryStatus.PENDING,
      } as never,
    });
    repository.findActiveGoalsProgress.mockResolvedValue({
      goals: [],
      versesRead: 0,
      activeSeconds: 0,
    });
    botService.sendDailyReminder.mockRejectedValue(
      new TelegramBlockedError('blocked by the user'),
    );

    await expect(
      service.deliverDailyReminder({
        userId: 'user-1',
        localDate: '2026-07-30',
      }),
    ).resolves.toEqual({ status: 'skipped', reason: 'telegram_blocked' });
    expect(repository.upsertUserNotification).toHaveBeenCalled();
  });

  it('is idempotent when delivery already exists', async () => {
    repository.findUserForDelivery.mockResolvedValue({
      id: 'user-1',
      telegramId: '42',
      allowsWriteToPm: true,
      settings: { timezone: 'Asia/Tashkent' },
    });
    repository.claimDelivery.mockResolvedValue({
      claimed: false,
      delivery: {
        id: 'delivery-1',
        status: NotificationDeliveryStatus.SENT,
      } as never,
    });

    await expect(
      service.deliverDailyReminder({
        userId: 'user-1',
        localDate: '2026-07-30',
      }),
    ).resolves.toEqual({ status: 'already_sent' });
    expect(botService.sendDailyReminder).not.toHaveBeenCalled();
  });

  it('treats fresh PENDING conflict as already_sent (in-flight claim)', async () => {
    repository.findUserForDelivery.mockResolvedValue({
      id: 'user-1',
      telegramId: '42',
      allowsWriteToPm: true,
      settings: { timezone: 'Asia/Tashkent' },
    });
    repository.claimDelivery.mockResolvedValue({
      claimed: false,
      delivery: {
        id: 'delivery-1',
        status: NotificationDeliveryStatus.PENDING,
      } as never,
    });

    await expect(
      service.deliverDailyReminder({
        userId: 'user-1',
        localDate: '2026-07-30',
      }),
    ).resolves.toEqual({ status: 'already_sent' });
  });

  it('skips terminal FAILED rows that were not reclaimed', async () => {
    repository.findUserForDelivery.mockResolvedValue({
      id: 'user-1',
      telegramId: '42',
      allowsWriteToPm: true,
      settings: { timezone: 'Asia/Tashkent' },
    });
    repository.claimDelivery.mockResolvedValue({
      claimed: false,
      delivery: {
        id: 'delivery-1',
        status: NotificationDeliveryStatus.FAILED,
      } as never,
    });

    await expect(
      service.deliverDailyReminder({
        userId: 'user-1',
        localDate: '2026-07-30',
      }),
    ).resolves.toEqual({ status: 'skipped', reason: 'existing_failed' });
  });
});
