import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ANALYTICS_QUEUES } from '../../common/constants';
import { BullRootModule } from '../../infrastructure/queue/bull-root.module';
import { UsersModule } from '../users/users.module';
import { AnalyticsTrackingService } from './analytics-tracking.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFlushProcessor } from './queues/analytics-flush.processor';

const isTestEnv = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    LoggerModule,
    UsersModule,
    ...(isTestEnv
      ? []
      : [
          BullRootModule,
          BullModule.registerQueue({
            name: ANALYTICS_QUEUES.FLUSH,
          }),
        ]),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsRepository,
    AnalyticsService,
    AnalyticsTrackingService,
    ...(isTestEnv ? [] : [AnalyticsFlushProcessor]),
  ],
  exports: [AnalyticsService, AnalyticsTrackingService],
})
export class AnalyticsModule {}
