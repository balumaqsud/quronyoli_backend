import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { HealthCheckResult } from './interfaces/health-check-result.interface';

@Injectable()
export class HealthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [databaseHealthy, redisHealthy] = await Promise.all([
      this.prismaService.isHealthy(),
      this.redisService.isHealthy(),
    ]);

    const application = { status: 'up' as const };
    const database = {
      status: databaseHealthy ? ('up' as const) : ('down' as const),
    };
    const redis = {
      status: redisHealthy ? ('up' as const) : ('down' as const),
    };
    const isHealthy = databaseHealthy && redisHealthy;

    const details = {
      application,
      database,
      redis,
    };

    return {
      status: isHealthy ? 'ok' : 'error',
      info: details,
      details,
    };
  }
}
