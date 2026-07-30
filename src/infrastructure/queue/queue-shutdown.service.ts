import {
  Injectable,
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  ANALYTICS_QUEUES,
  CONFIG_KEYS,
  NOTIFICATION_QUEUES,
} from '../../common/constants';
import { AppConfig } from '../../config/configuration';

@Injectable()
export class QueueShutdownService
  implements OnModuleDestroy, OnApplicationShutdown
{
  private closed = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef,
    @InjectPinoLogger(QueueShutdownService.name)
    private readonly logger: PinoLogger,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.drain();
  }

  async onModuleDestroy(): Promise<void> {
    await this.drain();
  }

  private async drain(): Promise<void> {
    if (this.closed || process.env.NODE_ENV === 'test') {
      return;
    }
    this.closed = true;

    const drainMs = this.configService.getOrThrow<AppConfig>(
      CONFIG_KEYS.APP,
    ).shutdownDrainMs;

    this.logger.info({ drainMs }, 'Closing BullMQ queues');

    const close = async (token: string): Promise<void> => {
      try {
        const queue = this.moduleRef.get<Queue>(token, { strict: false });
        await queue?.close();
      } catch {
        // Queue may be unregistered in some environments.
      }
    };

    await Promise.race([
      Promise.all([
        close(getQueueToken(NOTIFICATION_QUEUES.DAILY_REMINDERS)),
        close(getQueueToken(ANALYTICS_QUEUES.FLUSH)),
      ]),
      new Promise((resolve) => setTimeout(resolve, drainMs)),
    ]);
  }
}
