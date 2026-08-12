import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  CONFIG_KEYS,
  NOTIFICATION_JOBS,
  NOTIFICATION_QUEUES,
} from '../../../common/constants';
import { NotificationsConfig } from '../../../config/configuration';
import { formatLocalDate } from '../../reading/utils/reading-date.utils';
import { NotificationsRepository } from '../notifications.repository';
import {
  buildDeliveryJobId,
  candidateLocalTimes,
  DeliverDailyReminderJobData,
} from './reminder-jobs';

@Injectable()
export class ReminderScanService implements OnModuleInit {
  private readonly notificationsConfig: NotificationsConfig;

  constructor(
    @InjectQueue(NOTIFICATION_QUEUES.DAILY_REMINDERS)
    private readonly queue: Queue,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly configService: ConfigService,
    @InjectPinoLogger(ReminderScanService.name)
    private readonly logger: PinoLogger,
  ) {
    this.notificationsConfig =
      this.configService.getOrThrow<NotificationsConfig>(
        CONFIG_KEYS.NOTIFICATIONS,
      );
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      NOTIFICATION_JOBS.SCAN_DUE_REMINDERS,
      {},
      {
        repeat: {
          pattern: this.notificationsConfig.reminderScanCron,
        },
        jobId: 'repeatable-scan-due-reminders',
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  }

  async scanAndEnqueue(now: Date = new Date()): Promise<number> {
    const candidates = candidateLocalTimes(now);
    let enqueued = 0;

    for (const localTime of candidates) {
      const due = await this.notificationsRepository.findDueReminders(
        localTime,
        now,
      );

      for (const row of due) {
        const userLocalMinute = this.formatLocalMinute(now, row.timezone);
        if (userLocalMinute !== row.localTime) {
          continue;
        }

        const localDate = formatLocalDate(now, row.timezone);
        const jobId = buildDeliveryJobId(row.userId, localDate);
        const payload: DeliverDailyReminderJobData = {
          userId: row.userId,
          localDate,
          telegramId: row.telegramId,
          timezone: row.timezone,
        };

        await this.queue.add(
          NOTIFICATION_JOBS.DELIVER_DAILY_REMINDER,
          payload,
          {
            jobId,
            attempts: this.notificationsConfig.maxAttempts,
            backoff: {
              type: 'exponential',
              delay: this.notificationsConfig.backoffDelayMs,
            },
            removeOnComplete: true,
            removeOnFail: 100,
          },
        );
        enqueued += 1;
      }
    }

    if (enqueued > 0) {
      this.logger.info({ enqueued }, 'Enqueued daily reminder deliveries');
    }

    return enqueued;
  }

  private formatLocalMinute(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
}
