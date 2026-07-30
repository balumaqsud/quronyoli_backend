import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  NOTIFICATION_JOBS,
  NOTIFICATION_QUEUES,
} from '../../../common/constants';
import { NotificationService } from '../notification.service';
import { DeliverDailyReminderJobData } from './reminder-jobs';
import { ReminderScanService } from './reminder-scan.service';

@Processor(NOTIFICATION_QUEUES.DAILY_REMINDERS)
export class ReminderProcessor extends WorkerHost {
  constructor(
    private readonly reminderScanService: ReminderScanService,
    private readonly notificationService: NotificationService,
    @InjectPinoLogger(ReminderProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === NOTIFICATION_JOBS.SCAN_DUE_REMINDERS) {
      return this.reminderScanService.scanAndEnqueue();
    }

    if (job.name === NOTIFICATION_JOBS.DELIVER_DAILY_REMINDER) {
      const data = job.data as DeliverDailyReminderJobData;
      const result = await this.notificationService.deliverDailyReminder({
        userId: data.userId,
        localDate: data.localDate,
      });
      this.logger.debug(
        { userId: data.userId, localDate: data.localDate, result },
        'Daily reminder delivery finished',
      );
      return result;
    }

    this.logger.warn({ jobName: job.name }, 'Unknown reminder job ignored');
    return null;
  }
}
