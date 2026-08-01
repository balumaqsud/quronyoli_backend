import { NotFoundException } from '@nestjs/common';
import { UserNotificationType } from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import { InboxService } from './inbox.service';
import { NotificationsRepository } from './notifications.repository';

describe('InboxService', () => {
  let repository: jest.Mocked<
    Pick<
      NotificationsRepository,
      | 'listUserNotifications'
      | 'countUnreadNotifications'
      | 'markNotificationRead'
      | 'markAllNotificationsRead'
    >
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'getActiveByIdOrThrow'>>;
  let service: InboxService;

  beforeEach(() => {
    repository = {
      listUserNotifications: jest.fn(),
      countUnreadNotifications: jest.fn(),
      markNotificationRead: jest.fn(),
      markAllNotificationsRead: jest.fn(),
    };
    usersService = {
      getActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    service = new InboxService(
      repository as unknown as NotificationsRepository,
      usersService as unknown as UsersService,
    );
  });

  it('lists notifications with keyset pagination', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    repository.listUserNotifications.mockResolvedValue([
      {
        id: 'n1',
        userId: 'user-1',
        type: UserNotificationType.DAILY_REMINDER,
        title: 'Kunlik eslatma',
        body: 'Bugungi oyat: 2:255',
        payload: { verseKey: '2:255' },
        dedupeKey: '2026-08-01',
        readAt: null,
        createdAt,
        updatedAt: createdAt,
      },
    ]);

    const page = await service.list('user-1', { limit: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: 'n1',
      title: 'Kunlik eslatma',
      readAt: null,
    });
    expect(page.nextCursor).toBeNull();
  });

  it('returns unread count', async () => {
    repository.countUnreadNotifications.mockResolvedValue(4);
    await expect(service.unreadCount('user-1')).resolves.toEqual({ count: 4 });
  });

  it('marks one notification read', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    const readAt = new Date('2026-08-01T11:00:00.000Z');
    repository.markNotificationRead.mockResolvedValue({
      id: 'n1',
      userId: 'user-1',
      type: UserNotificationType.DAILY_REMINDER,
      title: 'Kunlik eslatma',
      body: 'Bugungi oyat: 2:255',
      payload: null,
      dedupeKey: '2026-08-01',
      readAt,
      createdAt,
      updatedAt: readAt,
    });

    await expect(service.markRead('user-1', 'n1')).resolves.toMatchObject({
      id: 'n1',
      readAt,
    });
  });

  it('throws when notification is missing', async () => {
    repository.markNotificationRead.mockResolvedValue(null);
    await expect(service.markRead('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('marks all notifications read', async () => {
    repository.markAllNotificationsRead.mockResolvedValue(3);
    await expect(service.markAllRead('user-1')).resolves.toEqual({
      updated: 3,
    });
  });
});
