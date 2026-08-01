import { Injectable, NotFoundException } from '@nestjs/common';
import { UserNotification } from '../../generated/prisma';
import {
  parseKeysetCursor,
  toKeysetPage,
} from '../../common/pagination/paginate-keyset';
import { UsersService } from '../users/users.service';
import {
  ListNotificationsQueryDto,
  PaginatedNotificationsResponseDto,
  ReadAllNotificationsResponseDto,
  UnreadCountResponseDto,
  UserNotificationResponseDto,
} from './dto/inbox.dto';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class InboxService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly usersService: UsersService,
  ) {}

  async list(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const limit = query.limit ?? 20;
    const { cursorAt, cursorId } = parseKeysetCursor(query.cursor);
    const rows = await this.notificationsRepository.listUserNotifications({
      userId,
      limit: limit + 1,
      cursorAt,
      cursorId,
      unreadOnly: query.unreadOnly,
    });

    return toKeysetPage(rows, {
      limit,
      getCursorAt: (row) => row.createdAt,
      getCursorId: (row) => row.id,
      mapItem: (row) => this.toResponse(row),
    });
  }

  async unreadCount(userId: string): Promise<UnreadCountResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const count =
      await this.notificationsRepository.countUnreadNotifications(userId);
    return { count };
  }

  async markRead(
    userId: string,
    id: string,
  ): Promise<UserNotificationResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const updated = await this.notificationsRepository.markNotificationRead(
      id,
      userId,
    );
    if (!updated) {
      throw new NotFoundException('Notification not found');
    }
    return this.toResponse(updated);
  }

  async markAllRead(userId: string): Promise<ReadAllNotificationsResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const updated =
      await this.notificationsRepository.markAllNotificationsRead(userId);
    return { updated };
  }

  private toResponse(row: UserNotification): UserNotificationResponseDto {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      payload:
        row.payload === null || row.payload === undefined
          ? null
          : (row.payload as Record<string, unknown>),
      readAt: row.readAt,
      createdAt: row.createdAt,
    };
  }
}
