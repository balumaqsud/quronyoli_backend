import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
import { AdminAdminsService } from './admin-admins.service';
import {
  AdminAdminsQueryDto,
  CreateAdminDto,
} from './dto/admin-admins.dto';

@ApiTags('Admin Admins')
@ApiBearerAuth('access-token')
@UseGuards(AdminGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN)
@Controller({
  path: 'admin/admins',
  version: '1',
})
export class AdminAdminsController {
  constructor(private readonly adminAdminsService: AdminAdminsService) {}

  @Get()
  @ApiOperation({ summary: 'List admins (SUPER_ADMIN only)' })
  @ApiOkResponse({ description: 'Paginated admins' })
  async list(@Query() query: AdminAdminsQueryDto) {
    return this.adminAdminsService.list(query.page, query.limit);
  }

  @Post()
  @ApiOperation({ summary: 'Create an admin (SUPER_ADMIN only)' })
  async create(
    @Body() body: CreateAdminDto,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminAdminsService.create(body, admin, context);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove an admin (SUPER_ADMIN only)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminAdminsService.remove(id, admin, context);
  }
}
