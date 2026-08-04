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
import { AdminTranslationsService } from './admin-translations.service';
import {
  AdminTranslationsQueryDto,
  ReorderAdminTranslationsDto,
  UpdateAdminTranslationDto,
} from './dto/admin-translations.dto';

@ApiTags('Admin Translations')
@ApiBearerAuth('access-token')
@UseGuards(AdminGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller({
  path: 'admin',
  version: '1',
})
export class AdminTranslationsController {
  constructor(
    private readonly adminTranslationsService: AdminTranslationsService,
  ) {}

  @Get('translations')
  @ApiOperation({ summary: 'List translations' })
  @ApiOkResponse({ description: 'Paginated translations' })
  async list(@Query() query: AdminTranslationsQueryDto) {
    return this.adminTranslationsService.list(query);
  }

  @Get('translations/:id')
  @ApiOperation({ summary: 'Get translation by id' })
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminTranslationsService.getById(id);
  }

  @Patch('translations/reorder')
  @ApiOperation({ summary: 'Reorder translations by id list' })
  async reorder(
    @Body() body: ReorderAdminTranslationsDto,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminTranslationsService.reorder(body, admin, context);
  }

  @Patch('translations/:id')
  @ApiOperation({
    summary:
      'Update admin-controlled translation fields (isActive, isDefault, sortOrder)',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAdminTranslationDto,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminTranslationsService.update(id, body, admin, context);
  }

  @Patch('translations/:id/enable')
  @ApiOperation({ summary: 'Enable translation' })
  async enable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminTranslationsService.enable(id, admin, context);
  }

  @Patch('translations/:id/disable')
  @ApiOperation({ summary: 'Disable translation' })
  async disable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminTranslationsService.disable(id, admin, context);
  }

  @Patch('translations/:id/default')
  @ApiOperation({ summary: 'Set translation as default' })
  async setDefault(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminTranslationsService.setDefault(id, admin, context);
  }

  @Post('sync/translations')
  @ApiOperation({ summary: 'Sync translations from Quran.Foundation' })
  async sync(
    @CurrentAdmin() admin: CurrentAdminContext,
    @AuthContext() context: AuthRequestContext,
  ) {
    return this.adminTranslationsService.sync(admin, context);
  }
}
