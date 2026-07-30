import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../infrastructure/auth/interfaces/jwt-payload.interface';
import {
  CreateGoalDto,
  ListGoalsQueryDto,
  UpdateGoalDto,
} from './dto/goal.dto';
import {
  GoalResponseDto,
  GoalsListResponseDto,
  GoalsProgressResponseDto,
} from './dto/goal-response.dto';
import { GoalsService } from './goals.service';

@ApiTags('Goals')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller({
  path: 'goals',
  version: '1',
})
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'List daily goals' })
  @ApiOkResponse({ type: GoalsListResponseDto })
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListGoalsQueryDto,
  ): Promise<GoalsListResponseDto> {
    return this.goalsService.list(currentUser.sub, query);
  }

  @Get('progress')
  @ApiOperation({
    summary: 'Today progress for active goals',
    description:
      'Derives VERSES from ReadingDay.versesRead and MINUTES from activeSeconds.',
  })
  @ApiOkResponse({ type: GoalsProgressResponseDto })
  getProgress(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<GoalsProgressResponseDto> {
    return this.goalsService.getProgress(currentUser.sub);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a daily goal',
    description:
      'Closes any open-ended active goal of the same metric before creating.',
  })
  @ApiOkResponse({ type: GoalResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Open-ended goal conflict' })
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateGoalDto,
  ): Promise<GoalResponseDto> {
    return this.goalsService.create(currentUser.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a daily goal' })
  @ApiOkResponse({ type: GoalResponseDto })
  @ApiNotFoundResponse({ description: 'Goal not found' })
  @ApiConflictResponse({ description: 'Open-ended goal conflict' })
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalDto,
  ): Promise<GoalResponseDto> {
    return this.goalsService.update(currentUser.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a daily goal' })
  @ApiOkResponse({ description: 'Goal deleted' })
  @ApiNotFoundResponse({ description: 'Goal not found' })
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: true }> {
    return this.goalsService.remove(currentUser.sub, id);
  }
}
