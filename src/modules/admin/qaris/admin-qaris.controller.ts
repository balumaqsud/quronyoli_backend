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
import { AdminQarisService } from './admin-qaris.service';
import {
  AdminQarisQueryDto,
  ReorderAdminQarisDto,
  SetPopularQariDto,
  UpdateAdminQariDto,
} from './dto/admin-qaris.dto';

@ApiTags('Admin Qaris')
@ApiBearerAuth('access-token')
@UseGuards(AdminGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller({
  path: 'admin',
  version: '1',
})
export class AdminQarisController {
  constructor(private readonly adminQarisService: AdminQarisService) {}

  @Get('qaris')
  @ApiOperation({ summary: 'List qaris (reciters)' })
  @ApiOkResponse({ description: 'Paginated qaris' })
  async list(@Query() query: AdminQarisQueryDto) {
    return this.adminQarisService.list(query);
  }

  @Get('qaris/:id')
  @ApiOperation({ summary: 'Get qari by id' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminQarisService.getById(id);
  }

  @Patch('qaris/reorder')
  @ApiOperation({ summary: 'Reorder qaris by id list' })
  async reorder(
    @Body() body: ReorderAdminQarisDto,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminQarisService.reorder(body, admin, context);
  }

  @Patch('qaris/:id')
  @ApiOperation({
    summary: 'Update admin-controlled qari fields (isActive, isPopular, sortOrder)',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAdminQariDto,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminQarisService.update(id, body, admin, context);
  }

  @Patch('qaris/:id/enable')
  @ApiOperation({ summary: 'Enable qari' })
  async enable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminQarisService.enable(id, admin, context);
  }

  @Patch('qaris/:id/disable')
  @ApiOperation({ summary: 'Disable qari' })
  async disable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminQarisService.disable(id, admin, context);
  }

  @Patch('qaris/:id/popular')
  @ApiOperation({ summary: 'Set qari popular flag' })
  async setPopular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetPopularQariDto,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminQarisService.setPopular(
      id,
      body.isPopular,
      admin,
      context,
    );
  }

  @Post('sync/qaris')
  @ApiOperation({ summary: 'Sync reciters from Quran.Foundation' })
  async sync(
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminQarisService.sync(admin, context);
  }
}
