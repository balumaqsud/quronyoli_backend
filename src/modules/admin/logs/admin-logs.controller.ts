import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '../../../generated/prisma';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { OffsetPaginationQueryDto } from '../../../common/pagination/offset-pagination.dto';
import { AdminLogsService } from './admin-logs.service';

@ApiTags('Admin Logs')
@ApiBearerAuth('access-token')
@UseGuards(AdminGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller({
  path: 'admin/logs',
  version: '1',
})
export class AdminLogsController {
  constructor(private readonly adminLogsService: AdminLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List admin action logs' })
  @ApiOkResponse({ description: 'Paginated admin logs' })
  async list(@Query() query: OffsetPaginationQueryDto) {
    return this.adminLogsService.list(query.page, query.limit);
  }
}
