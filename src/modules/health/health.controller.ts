import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller({
  path: 'health',
  version: '1',
})
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Application health check' })
  @ApiOkResponse({ description: 'Service dependencies are healthy' })
  async check(@Res() response: Response): Promise<void> {
    const result = await this.healthService.check();
    const statusCode =
      result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    response.status(statusCode).json({
      success: result.status === 'ok',
      data: result,
      timestamp: new Date().toISOString(),
      path: response.req.url ?? '/api/v1/health',
    });
  }
}
