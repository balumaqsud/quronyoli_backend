import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { CONFIG_KEYS, NOTIFICATION_QUEUES } from '../../common/constants';
import { RedisConfig } from '../../config/configuration';
import { UsersModule } from '../users/users.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { ReminderProcessor } from './queues/reminder.processor';
import { ReminderScanService } from './queues/reminder-scan.service';
import { RemindersService } from './reminders.service';

const isTestEnv = process.env.NODE_ENV === 'test';

const bullImports: DynamicModule[] = isTestEnv
  ? []
  : [
      BullModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const redis = configService.getOrThrow<RedisConfig>(
            CONFIG_KEYS.REDIS,
          );
          return {
            connection: {
              host: redis.host,
              port: redis.port,
              password: redis.password || undefined,
              db: redis.db,
            },
            prefix: `${redis.keyPrefix}bull`,
          };
        },
      }),
      BullModule.registerQueue({
        name: NOTIFICATION_QUEUES.DAILY_REMINDERS,
      }),
    ];

@Module({
  imports: [LoggerModule, UsersModule, TelegramModule, ...bullImports],
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    RemindersService,
    NotificationService,
    ...(isTestEnv ? [] : [ReminderScanService, ReminderProcessor]),
  ],
  exports: [NotificationService, RemindersService],
})
export class NotificationsModule {}
