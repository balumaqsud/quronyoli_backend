import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { HealthCheckResult } from './interfaces/health-check-result.interface';
import { buildHealthPayload } from './healthcheck';

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

    const payload = buildHealthPayload({ databaseHealthy, redisHealthy });

    return {
      status: payload.status,
      info: payload.details,
      details: payload.details,
    };
  }
}
