import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
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

/**
 * Unversioned alias: GET /api/health
 * Versioned probes remain at /api/v1/health*
 */
@ApiTags('Health')
@SkipThrottle()
@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthAliasController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly healthService: HealthService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Application health check (unversioned alias)',
  })
  @ApiOkResponse({ description: 'Service dependencies are healthy' })
  check() {
    return this.health.check([() => this.dependencies()]);
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
