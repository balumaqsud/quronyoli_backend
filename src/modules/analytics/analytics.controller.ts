import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../infrastructure/auth/interfaces/jwt-payload.interface';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsBatchDto,
  AnalyticsEventDto,
  AnalyticsIngestResponseDto,
  AnalyticsStatisticsQueryDto,
  AnalyticsStatisticsResponseDto,
} from './dto/analytics.dto';

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller({
  path: 'analytics',
  version: '1',
})
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @ApiOperation({ summary: 'Ingest a single analytics event' })
  @ApiOkResponse({ type: AnalyticsIngestResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid event payload' })
  ingestOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: AnalyticsEventDto,
  ): Promise<AnalyticsIngestResponseDto> {
    return this.analyticsService.ingestOne(currentUser.sub, dto);
  }

  @Post('events/batch')
  @ApiOperation({ summary: 'Ingest a batch of analytics events' })
  @ApiOkResponse({ type: AnalyticsIngestResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid batch payload' })
  ingestBatch(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: AnalyticsBatchDto,
  ): Promise<AnalyticsIngestResponseDto> {
    return this.analyticsService.ingestBatch(currentUser.sub, dto.events);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Per-user analytics statistics' })
  @ApiOkResponse({ type: AnalyticsStatisticsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid date range or timezone' })
  getStatistics(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: AnalyticsStatisticsQueryDto,
  ): Promise<AnalyticsStatisticsResponseDto> {
    return this.analyticsService.getStatistics(currentUser.sub, query);
  }
}
