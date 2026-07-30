import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ANALYTICS_QUEUES, CONFIG_KEYS } from '../../common/constants';
import { RedisConfig } from '../../config/configuration';
import { UsersModule } from '../users/users.module';
import { AnalyticsTrackingService } from './analytics-tracking.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFlushProcessor } from './queues/analytics-flush.processor';

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
        name: ANALYTICS_QUEUES.FLUSH,
      }),
    ];

@Module({
  imports: [LoggerModule, UsersModule, ...bullImports],
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
