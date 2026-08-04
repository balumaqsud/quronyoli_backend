import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '../../../generated/prisma';
import {
  CurrentAdmin,
  CurrentAdminContext,
} from '../../../common/decorators/current-admin.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AuthContext } from '../../auth/decorators/auth-context.decorator';
import { AuthRequestContext } from '../../auth/interfaces/auth-request-context.interface';
import { AdminUsersService } from './admin-users.service';
import {
  AdminUsersQueryDto,
  UpdateAdminUserDto,
} from './dto/admin-users.dto';

@ApiTags('Admin Users')
@ApiBearerAuth('access-token')
@UseGuards(AdminGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller({
  path: 'admin/users',
  version: '1',
})
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with search and filters' })
  @ApiOkResponse({ description: 'Paginated users' })
  async list(@Query() query: AdminUsersQueryDto) {
    return this.adminUsersService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsersService.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile fields' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAdminUserDto,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminUsersService.update(id, body, admin, context);
  }

  @Patch(':id/ban')
  @ApiOperation({ summary: 'Ban a user' })
  async ban(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminUsersService.ban(id, admin, context);
  }

  @Patch(':id/unban')
  @ApiOperation({ summary: 'Unban a user' })
  async unban(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminUsersService.unban(id, admin, context);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Soft-deactivate a user' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminUsersService.deactivate(id, admin, context);
  }
}
