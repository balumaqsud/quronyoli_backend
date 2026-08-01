import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../infrastructure/auth/interfaces/jwt-payload.interface';
import {
  ListNotificationsQueryDto,
  PaginatedNotificationsResponseDto,
  ReadAllNotificationsResponseDto,
  UnreadCountResponseDto,
  UserNotificationResponseDto,
} from './dto/inbox.dto';
import { InboxService } from './inbox.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@Controller({
  path: 'notifications',
  version: '1',
})
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  @ApiOperation({ summary: 'List in-app notifications' })
  @ApiOkResponse({ type: PaginatedNotificationsResponseDto })
  list(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponseDto> {
    return this.inboxService.list(currentUser.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count for bell badge' })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  unreadCount(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<UnreadCountResponseDto> {
    return this.inboxService.unreadCount(currentUser.sub);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({ type: ReadAllNotificationsResponseDto })
  markAllRead(
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ReadAllNotificationsResponseDto> {
    return this.inboxService.markAllRead(currentUser.sub);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiOkResponse({ type: UserNotificationResponseDto })
  @ApiNotFoundResponse({ description: 'Notification not found' })
  markRead(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserNotificationResponseDto> {
    return this.inboxService.markRead(currentUser.sub, id);
  }
}
