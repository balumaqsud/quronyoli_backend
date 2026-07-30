import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../infrastructure/auth/interfaces/jwt-payload.interface';
import {
  DailyReminderResponseDto,
  UpsertDailyReminderDto,
} from './dto/reminder.dto';
import { RemindersService } from './reminders.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller({
  path: 'notifications/reminders',
  version: '1',
})
export class NotificationsController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('daily')
  @ApiOperation({ summary: 'Get daily reminder preference' })
  @ApiOkResponse({ type: DailyReminderResponseDto })
  getDaily(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<DailyReminderResponseDto> {
    return this.remindersService.getDailyReminder(currentUser.sub);
  }

  @Put('daily')
  @ApiOperation({ summary: 'Create or update daily reminder preference' })
  @ApiOkResponse({ type: DailyReminderResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid time or timezone' })
  upsertDaily(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpsertDailyReminderDto,
  ): Promise<DailyReminderResponseDto> {
    return this.remindersService.upsertDailyReminder(currentUser.sub, dto);
  }

  @Delete('daily')
  @ApiOperation({ summary: 'Delete daily reminder preference' })
  @ApiOkResponse({ description: 'Preference deleted' })
  @ApiNotFoundResponse({ description: 'Preference not found' })
  deleteDaily(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<{ deleted: true }> {
    return this.remindersService.deleteDailyReminder(currentUser.sub);
  }
}
