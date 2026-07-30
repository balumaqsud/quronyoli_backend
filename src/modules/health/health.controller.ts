import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@SkipThrottle()
@Controller({
  path: 'health',
  version: '1',
})
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthService: HealthService,
  ) {}

  @Public()
  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe (process up)' })
  @ApiOkResponse({ description: 'Process is alive' })
  live() {
    return this.health.check([]);
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (database + Redis)' })
  @ApiOkResponse({ description: 'Dependencies are ready' })
  ready() {
    return this.health.check([() => this.dependencies()]);
  }

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Application health check (alias of ready)' })
  @ApiOkResponse({ description: 'Service dependencies are healthy' })
  check() {
    return this.ready();
  }

  private async dependencies(): Promise<HealthIndicatorResult> {
    const result = await this.healthService.check();
    const indicator = {
      database: result.details.database,
      redis: result.details.redis,
      application: result.details.application,
    } as HealthIndicatorResult;

    if (result.status !== 'ok') {
      throw new HealthCheckError('Service dependencies unhealthy', indicator);
    }

    return indicator;
  }
}
