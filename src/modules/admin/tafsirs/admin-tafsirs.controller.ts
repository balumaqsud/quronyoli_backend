import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { AdminTafsirsService } from './admin-tafsirs.service';
import {
  AdminTafsirsQueryDto,
  ReorderAdminTafsirsDto,
  UpdateAdminTafsirDto,
} from './dto/admin-tafsirs.dto';

@ApiTags('Admin Tafsirs')
@ApiBearerAuth('access-token')
@UseGuards(AdminGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller({
  path: 'admin',
  version: '1',
})
export class AdminTafsirsController {
  constructor(private readonly adminTafsirsService: AdminTafsirsService) {}

  @Get('tafsirs')
  @ApiOperation({ summary: 'List tafsirs' })
  @ApiOkResponse({ description: 'Paginated tafsirs' })
  async list(@Query() query: AdminTafsirsQueryDto) {
    return this.adminTafsirsService.list(query);
  }

  @Get('tafsirs/:id')
  @ApiOperation({ summary: 'Get tafsir by id' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminTafsirsService.getById(id);
  }

  @Patch('tafsirs/reorder')
  @ApiOperation({ summary: 'Reorder tafsirs by id list' })
  async reorder(
    @Body() body: ReorderAdminTafsirsDto,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminTafsirsService.reorder(body, admin, context);
  }

  @Patch('tafsirs/:id')
  @ApiOperation({
    summary: 'Update admin-controlled tafsir fields (isActive, sortOrder)',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAdminTafsirDto,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminTafsirsService.update(id, body, admin, context);
  }

  @Patch('tafsirs/:id/enable')
  @ApiOperation({ summary: 'Enable tafsir' })
  async enable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminTafsirsService.enable(id, admin, context);
  }

  @Patch('tafsirs/:id/disable')
  @ApiOperation({ summary: 'Disable tafsir' })
  async disable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminTafsirsService.disable(id, admin, context);
  }

  @Post('sync/tafsirs')
  @ApiOperation({ summary: 'Sync tafsirs from Quran.Foundation' })
  async sync(
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminTafsirsService.sync(admin, context);
  }
}
