import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as https from 'https';
import { DynamicModule } from '@nestjs/common';

export interface KeepAliveHttpModuleOptions {
  timeoutMs: number;
  maxSockets: number;
}

/**
 * Shared Axios HttpModule registration with keep-alive agents.
 */
export function createKeepAliveHttpModule(
  resolveOptions: (configService: ConfigService) => KeepAliveHttpModuleOptions,
): DynamicModule {
  return HttpModule.registerAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
      const options = resolveOptions(configService);
      return {
        timeout: options.timeoutMs,
        maxRedirects: 0,
        httpAgent: new http.Agent({
          keepAlive: true,
          maxSockets: options.maxSockets,
        }),
        httpsAgent: new https.Agent({
          keepAlive: true,
          maxSockets: options.maxSockets,
        }),
      };
    },
  });
}
