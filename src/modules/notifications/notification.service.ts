import { Injectable } from '@nestjs/common';
import {
  DailyGoalMetric,
  NotificationDeliveryStatus,
} from '../../generated/prisma';
import { resolveDailyAyahForDate } from '../../common/quran/daily-ayah';
import {
  formatLocalDate,
  toDateOnly,
} from '../reading/utils/reading-date.utils';
import { TelegramBlockedError } from '../telegram/errors/telegram-error.mapper';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { NotificationsRepository } from './notifications.repository';

export interface DeliverDailyReminderResult {
  status: 'sent' | 'skipped' | 'already_sent' | 'failed';
  messageId?: string;
  reason?: string;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async deliverDailyReminder(input: {
    userId: string;
    localDate: string;
  }): Promise<DeliverDailyReminderResult> {
    const user = await this.notificationsRepository.findUserForDelivery(
      input.userId,
    );
    if (!user) {
      return { status: 'skipped', reason: 'user_inactive' };
    }

    const claim = await this.notificationsRepository.claimDelivery({
      userId: input.userId,
      localDate: input.localDate,
    });

    if (!claim.claimed) {
      if (claim.delivery.status === NotificationDeliveryStatus.SENT) {
        return { status: 'already_sent' };
      }
      if (claim.delivery.status === NotificationDeliveryStatus.PENDING) {
        return { status: 'already_sent' };
      }
      return {
        status: 'skipped',
        reason: `existing_${claim.delivery.status.toLowerCase()}`,
      };
    }

    if (!user.allowsWriteToPm) {
      await this.notificationsRepository.markDeliveryFailed({
        id: claim.delivery.id,
        errorMessage: 'User does not allow write to PM',
        status: NotificationDeliveryStatus.SKIPPED,
      });
      return { status: 'skipped', reason: 'write_to_pm_disabled' };
    }

    try {
      const ayah = resolveDailyAyahForDate(input.localDate);
      const progress =
        await this.notificationsRepository.findActiveGoalsProgress(
          input.userId,
          toDateOnly(input.localDate),
        );

      const goalLines = progress.goals
        .map((goal) => {
          const actual =
            goal.metric === DailyGoalMetric.MINUTES
              ? Math.floor(progress.activeSeconds / 60)
              : progress.versesRead;
          if (actual >= goal.targetValue) {
            return null;
          }
          return `${goal.metric}: ${actual}/${goal.targetValue}`;
        })
        .filter((line): line is string => line !== null);

      const sent = await this.telegramBotService.sendDailyReminder({
        chatId: user.telegramId,
        localDate: input.localDate,
        verseKey: ayah.verseKey,
        goalLines,
      });

      await this.notificationsRepository.markDeliverySent({
        id: claim.delivery.id,
        telegramMessageId: String(sent.messageId),
      });

      return { status: 'sent', messageId: String(sent.messageId) };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown delivery failure';
      const isBlocked = error instanceof TelegramBlockedError;

      await this.notificationsRepository.markDeliveryFailed({
        id: claim.delivery.id,
        errorMessage: message,
        status: isBlocked
          ? NotificationDeliveryStatus.SKIPPED
          : NotificationDeliveryStatus.FAILED,
      });

      if (isBlocked) {
        return { status: 'skipped', reason: 'telegram_blocked' };
      }

      throw error;
    }
  }

  formatLocalMinute(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  formatLocalDate(date: Date, timeZone: string): string {
    return formatLocalDate(date, timeZone);
  }
}
