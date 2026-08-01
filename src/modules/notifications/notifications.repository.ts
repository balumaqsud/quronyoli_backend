import { Injectable } from '@nestjs/common';
import {
  NotificationDelivery,
  NotificationDeliveryStatus,
  NotificationDeliveryType,
  Prisma,
  TelegramReminderPreference,
  UserNotification,
  UserNotificationType,
} from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DEFAULT_READING_TIMEZONE } from '../reading/constants/quran-coordinates';
import { toDateOnly } from '../reading/utils/reading-date.utils';

export interface DueReminderRow {
  userId: string;
  telegramId: string;
  allowsWriteToPm: boolean;
  localTime: string;
  timezone: string;
}

export interface UserNotificationListQuery {
  userId: string;
  limit: number;
  cursorAt?: Date;
  cursorId?: string;
  unreadOnly?: boolean;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findReminderPreference(
    userId: string,
  ): Promise<TelegramReminderPreference | null> {
    return await this.prisma.telegramReminderPreference.findUnique({
      where: { userId },
    });
  }

  async upsertReminderPreference(input: {
    userId: string;
    enabled: boolean;
    localTime: string;
  }): Promise<TelegramReminderPreference> {
    return await this.prisma.telegramReminderPreference.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        enabled: input.enabled,
        localTime: input.localTime,
      },
      update: {
        enabled: input.enabled,
        localTime: input.localTime,
      },
    });
  }

  async deleteReminderPreference(userId: string): Promise<boolean> {
    const result = await this.prisma.telegramReminderPreference.deleteMany({
      where: { userId },
    });
    return result.count > 0;
  }

  async getTimezone(userId: string): Promise<string> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return settings?.timezone ?? DEFAULT_READING_TIMEZONE;
  }

  async findDueReminders(localTime: string): Promise<DueReminderRow[]> {
    const rows = await this.prisma.telegramReminderPreference.findMany({
      where: {
        enabled: true,
        localTime,
        user: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        userId: true,
        localTime: true,
        user: {
          select: {
            telegramId: true,
            allowsWriteToPm: true,
            settings: {
              select: { timezone: true },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      userId: row.userId,
      telegramId: row.user.telegramId,
      allowsWriteToPm: row.user.allowsWriteToPm,
      localTime: row.localTime,
      timezone: row.user.settings?.timezone ?? DEFAULT_READING_TIMEZONE,
    }));
  }

  async claimDelivery(input: {
    userId: string;
    localDate: string;
    /** Reclaim PENDING rows older than this many minutes (default 15). */
    stalePendingMinutes?: number;
  }): Promise<{ claimed: boolean; delivery: NotificationDelivery }> {
    const localDate = toDateOnly(input.localDate);
    const staleMinutes = input.stalePendingMinutes ?? 15;

    try {
      const delivery = await this.prisma.notificationDelivery.create({
        data: {
          userId: input.userId,
          type: NotificationDeliveryType.DAILY_REMINDER,
          localDate,
          status: NotificationDeliveryStatus.PENDING,
        },
      });
      return { claimed: true, delivery };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.notificationDelivery.findUnique({
          where: {
            userId_type_localDate: {
              userId: input.userId,
              type: NotificationDeliveryType.DAILY_REMINDER,
              localDate,
            },
          },
        });
        if (!existing) {
          throw error;
        }

        const terminal =
          existing.status === NotificationDeliveryStatus.SENT ||
          existing.status === NotificationDeliveryStatus.SKIPPED;
        if (terminal) {
          return { claimed: false, delivery: existing };
        }

        const staleCutoff = new Date(Date.now() - staleMinutes * 60_000);
        const canReclaim =
          existing.status === NotificationDeliveryStatus.FAILED ||
          (existing.status === NotificationDeliveryStatus.PENDING &&
            existing.updatedAt <= staleCutoff);

        if (!canReclaim) {
          return { claimed: false, delivery: existing };
        }

        const reclaimed = await this.prisma.notificationDelivery.updateMany({
          where: {
            id: existing.id,
            status: {
              in: [
                NotificationDeliveryStatus.FAILED,
                NotificationDeliveryStatus.PENDING,
              ],
            },
          },
          data: {
            status: NotificationDeliveryStatus.PENDING,
            errorMessage: null,
            telegramMessageId: null,
            sentAt: null,
          },
        });

        if (reclaimed.count === 0) {
          const latest = await this.prisma.notificationDelivery.findUnique({
            where: { id: existing.id },
          });
          return { claimed: false, delivery: latest ?? existing };
        }

        const delivery =
          await this.prisma.notificationDelivery.findUniqueOrThrow({
            where: { id: existing.id },
          });
        return { claimed: true, delivery };
      }
      throw error;
    }
  }

  async markDeliverySent(input: {
    id: string;
    telegramMessageId: string;
  }): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id: input.id },
      data: {
        status: NotificationDeliveryStatus.SENT,
        telegramMessageId: input.telegramMessageId,
        sentAt: new Date(),
        errorMessage: null,
      },
    });
  }

  async markDeliveryFailed(input: {
    id: string;
    errorMessage: string;
    status?: NotificationDeliveryStatus;
  }): Promise<void> {
    await this.prisma.notificationDelivery.update({
      where: { id: input.id },
      data: {
        status: input.status ?? NotificationDeliveryStatus.FAILED,
        errorMessage: input.errorMessage.slice(0, 512),
      },
    });
  }

  async findActiveGoalsProgress(userId: string, localDate: Date) {
    const [goals, readingDay] = await Promise.all([
      this.prisma.dailyGoal.findMany({
        where: {
          userId,
          isEnabled: true,
          deletedAt: null,
          effectiveFrom: { lte: localDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: localDate } }],
        },
      }),
      this.prisma.readingDay.findUnique({
        where: {
          userId_localDate: {
            userId,
            localDate,
          },
        },
      }),
    ]);

    return {
      goals,
      versesRead: readingDay?.versesRead ?? 0,
      activeSeconds: readingDay?.activeSeconds ?? 0,
    };
  }

  async findUserForDelivery(userId: string) {
    return await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        telegramId: true,
        allowsWriteToPm: true,
        settings: {
          select: { timezone: true },
        },
      },
    });
  }

  async upsertUserNotification(input: {
    userId: string;
    type: UserNotificationType;
    title: string;
    body: string;
    payload?: Prisma.InputJsonValue;
    dedupeKey: string;
  }): Promise<UserNotification> {
    return await this.prisma.userNotification.upsert({
      where: {
        userId_type_dedupeKey: {
          userId: input.userId,
          type: input.type,
          dedupeKey: input.dedupeKey,
        },
      },
      create: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload,
        dedupeKey: input.dedupeKey,
      },
      update: {
        title: input.title,
        body: input.body,
        payload: input.payload,
      },
    });
  }

  async listUserNotifications(
    query: UserNotificationListQuery,
  ): Promise<UserNotification[]> {
    const where: Prisma.UserNotificationWhereInput = {
      userId: query.userId,
    };

    if (query.unreadOnly === true) {
      where.readAt = null;
    }

    if (query.cursorAt && query.cursorId) {
      where.AND = [
        {
          OR: [
            { createdAt: { lt: query.cursorAt } },
            {
              AND: [
                { createdAt: query.cursorAt },
                { id: { lt: query.cursorId } },
              ],
            },
          ],
        },
      ];
    }

    return await this.prisma.userNotification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
    });
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    return await this.prisma.userNotification.count({
      where: {
        userId,
        readAt: null,
      },
    });
  }

  async markNotificationRead(
    id: string,
    userId: string,
  ): Promise<UserNotification | null> {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.userNotification.findFirst({
        where: { id, userId },
      });
      if (!existing) {
        return null;
      }
      if (existing.readAt) {
        return existing;
      }
      return await tx.userNotification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    });
  }

  async markAllNotificationsRead(userId: string): Promise<number> {
    const result = await this.prisma.userNotification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
    return result.count;
  }
}
