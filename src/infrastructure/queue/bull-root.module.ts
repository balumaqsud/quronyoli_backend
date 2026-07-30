import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../common/constants';
import { RedisConfig } from '../../config/configuration';

const isTestEnv = process.env.NODE_ENV === 'test';

@Module({
  imports: isTestEnv
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
      ],
  exports: isTestEnv ? [] : [BullModule],
})
export class BullRootModule {}
