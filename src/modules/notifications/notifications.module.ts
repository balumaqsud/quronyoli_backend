import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { NOTIFICATION_QUEUES } from '../../common/constants';
import { BullRootModule } from '../../infrastructure/queue/bull-root.module';
import { UsersModule } from '../users/users.module';
import { TelegramModule } from '../telegram/telegram.module';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { ReminderProcessor } from './queues/reminder.processor';
import { ReminderScanService } from './queues/reminder-scan.service';
import { RemindersService } from './reminders.service';

const isTestEnv = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    LoggerModule,
    UsersModule,
    TelegramModule,
    ...(isTestEnv
      ? []
      : [
          BullRootModule,
          BullModule.registerQueue({
            name: NOTIFICATION_QUEUES.DAILY_REMINDERS,
          }),
        ]),
  ],
  controllers: [InboxController, NotificationsController],
  providers: [
    NotificationsRepository,
    RemindersService,
    InboxService,
    NotificationService,
    ...(isTestEnv ? [] : [ReminderScanService, ReminderProcessor]),
  ],
  exports: [NotificationService, RemindersService, InboxService],
})
export class NotificationsModule {}
