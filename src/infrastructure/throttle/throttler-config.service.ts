import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ThrottlerModuleOptions,
  ThrottlerOptionsFactory,
} from '@nestjs/throttler';
import { CONFIG_KEYS } from '../../common/constants';
import { ThrottleConfig } from '../../config/configuration';

@Injectable()
export class ThrottlerConfigService implements ThrottlerOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createThrottlerOptions(): ThrottlerModuleOptions {
    const throttle = this.configService.getOrThrow<ThrottleConfig>(
      CONFIG_KEYS.THROTTLE,
    );

    return [
      {
        name: 'default',
        ttl: throttle.ttlMs,
        limit: throttle.limit,
      },
    ];
  }
}
