import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { AdminRole } from '../../../generated/prisma';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import {
  AdminDashboardService,
  AdminDashboardStats,
} from './admin-dashboard.service';

class AdminDashboardResponseDto implements AdminDashboardStats {
  @ApiProperty()
  totalUsers!: number;

  @ApiProperty()
  todayUsers!: number;

  @ApiProperty()
  activeUsers!: number;

  @ApiProperty()
  todayActiveUsers!: number;

  @ApiProperty()
  newUsersLast7Days!: number;

  @ApiProperty()
  newUsersLast30Days!: number;

  @ApiProperty()
  totalQaris!: number;

  @ApiProperty()
  enabledQaris!: number;

  @ApiProperty()
  totalTranslations!: number;

  @ApiProperty()
  enabledTranslations!: number;
}

@ApiTags('Admin Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(AdminGuard, RolesGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Controller({
  path: 'admin/dashboard',
  version: '1',
})
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Admin dashboard aggregate stats' })
  @ApiOkResponse({ type: AdminDashboardResponseDto })
  async getDashboard(): Promise<AdminDashboardStats> {
    return this.dashboardService.getStats();
  }
}
