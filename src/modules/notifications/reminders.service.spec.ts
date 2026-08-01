import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { NotificationsRepository } from './notifications.repository';
import { RemindersService } from './reminders.service';

describe('RemindersService', () => {
  let repository: jest.Mocked<
    Pick<
      NotificationsRepository,
      | 'getTimezone'
      | 'findReminderPreference'
      | 'upsertReminderPreference'
      | 'deleteReminderPreference'
    >
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'getActiveByIdOrThrow'>>;
  let service: RemindersService;

  beforeEach(() => {
    repository = {
      getTimezone: jest.fn().mockResolvedValue('Asia/Tashkent'),
      findReminderPreference: jest.fn(),
      upsertReminderPreference: jest.fn(),
      deleteReminderPreference: jest.fn(),
    };
    usersService = {
      getActiveByIdOrThrow: jest.fn().mockResolvedValue({
        id: 'user-1',
        allowsWriteToPm: true,
      }),
    };
    service = new RemindersService(
      repository as unknown as NotificationsRepository,
      usersService as unknown as UsersService,
    );
  });

  it('upserts a daily reminder preference', async () => {
    repository.upsertReminderPreference.mockResolvedValue({
      id: 'pref-1',
      userId: 'user-1',
      enabled: true,
      localTime: '07:30',
      createdAt: new Date(),
      updatedAt: new Date('2026-07-30T00:00:00.000Z'),
    });

    await expect(
      service.upsertDailyReminder('user-1', {
        enabled: true,
        localTime: '07:30',
      }),
    ).resolves.toMatchObject({
      enabled: true,
      localTime: '07:30',
      timezone: 'Asia/Tashkent',
      allowsWriteToPm: true,
    });
  });

  it('rejects invalid timezones', async () => {
    repository.getTimezone.mockResolvedValue('Not/AZone');
    await expect(
      service.upsertDailyReminder('user-1', {
        enabled: true,
        localTime: '07:30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
