import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../infrastructure/auth/interfaces/jwt-payload.interface';
import {
  ReadingDailyQueryDto,
  ReadingHistoryQueryDto,
  ReadingPaginationQueryDto,
} from './dto/reading-query.dto';
import {
  ContinueReadingResponseDto,
  DailyReadingItemDto,
  DailyReadingResponseDto,
  PaginatedHistoryResponseDto,
  PaginatedRecentResponseDto,
  ReadingProgressResponseDto,
  ReadingStatisticsResponseDto,
  ReadingStreakResponseDto,
} from './dto/reading-response.dto';
import { ReadingService } from './reading.service';

@ApiTags('Reading')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller({
  path: 'reading',
  version: '1',
})
export class ReadingController {
  constructor(private readonly readingService: ReadingService) {}

  @Get('continue')
  @ApiOperation({
    summary: 'Continue reading cursor',
    description: 'Latest ayah opened by the authenticated user.',
  })
  @ApiOkResponse({ type: ContinueReadingResponseDto })
  getContinue(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ContinueReadingResponseDto | null> {
    return this.readingService.getContinue(currentUser.sub);
  }

  @Get('recent')
  @ApiOperation({
    summary: 'Recently read ayahs',
    description: 'Distinct ayahs ordered by last open time.',
  })
  @ApiOkResponse({ type: PaginatedRecentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid pagination cursor' })
  getRecent(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ReadingPaginationQueryDto,
  ): Promise<PaginatedRecentResponseDto> {
    return this.readingService.getRecent(
      currentUser.sub,
      query.limit ?? 20,
      query.cursor,
    );
  }

  @Get('history')
  @ApiOperation({
    summary: 'Reading history',
    description: 'Every ayah open event, newest first.',
  })
  @ApiOkResponse({ type: PaginatedHistoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  getHistory(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ReadingHistoryQueryDto,
  ): Promise<PaginatedHistoryResponseDto> {
    return this.readingService.getHistory(currentUser.sub, {
      limit: query.limit ?? 20,
      cursor: query.cursor,
      from: query.from,
      to: query.to,
    });
  }

  @Get('progress')
  @ApiOperation({
    summary: 'Reading progress',
    description:
      'Unique ayah coverage, completion percentage, and latest cursor.',
  })
  @ApiOkResponse({ type: ReadingProgressResponseDto })
  getProgress(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ReadingProgressResponseDto> {
    return this.readingService.getProgress(currentUser.sub);
  }

  @Get('daily')
  @ApiOperation({
    summary: 'Reading days (range)',
    description:
      'Timezone-aware daily ReadingDay rollups for a bounded date range.',
  })
  @ApiOkResponse({ type: DailyReadingResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid date range' })
  getDaily(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ReadingDailyQueryDto,
  ): Promise<DailyReadingResponseDto> {
    return this.readingService.getDaily(currentUser.sub, query.from, query.to);
  }

  @Get('days/today')
  @ApiOperation({
    summary: 'Today reading day',
    description: 'Returns today’s ReadingDay rollup, or zeros if none.',
  })
  @ApiOkResponse({ type: DailyReadingItemDto })
  getTodayDay(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<DailyReadingItemDto> {
    return this.readingService.getTodayDay(currentUser.sub);
  }

  @Get('streak')
  @ApiOperation({
    summary: 'Reading streak',
    description: 'Current and longest streaks based on active ReadingDay rows.',
  })
  @ApiOkResponse({ type: ReadingStreakResponseDto })
  getStreak(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ReadingStreakResponseDto> {
    return this.readingService.getStreak(currentUser.sub);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Reading statistics',
    description: 'Totals, streaks, and recent period activity.',
  })
  @ApiOkResponse({ type: ReadingStatisticsResponseDto })
  getStatistics(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ReadingStatisticsResponseDto> {
    return this.readingService.getStatistics(currentUser.sub);
  }
}
