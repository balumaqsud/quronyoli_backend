import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ANALYTICS_JOBS, ANALYTICS_QUEUES } from '../../../common/constants';
import { AnalyticsTrackingService } from '../analytics-tracking.service';

@Processor(ANALYTICS_QUEUES.FLUSH)
export class AnalyticsFlushProcessor extends WorkerHost {
  constructor(
    private readonly trackingService: AnalyticsTrackingService,
    @InjectPinoLogger(AnalyticsFlushProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== ANALYTICS_JOBS.FLUSH_BUFFER) {
      this.logger.warn({ jobName: job.name }, 'Unknown analytics job ignored');
      return null;
    }

    const bufferKey =
      (job.data as { bufferKey?: string } | undefined)?.bufferKey ??
      'analytics:buffer';
    const accepted = await this.trackingService.flushBuffer(bufferKey);
    this.logger.debug({ accepted }, 'Flushed analytics buffer');
    return { accepted };
  }
}
