import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export type AdminDashboardStats = {
  totalUsers: number;
  todayUsers: number;
  activeUsers: number;
  todayActiveUsers: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  totalQaris: number;
  enabledQaris: number;
  totalTranslations: number;
  enabledTranslations: number;
};

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminDashboardStats> {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const thirtyDaysAgo = new Date(startOfToday);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const [
      totalUsers,
      todayUsers,
      activeUsers,
      todayActiveUsers,
      newUsersLast7Days,
      newUsersLast30Days,
      totalQaris,
      enabledQaris,
      totalTranslations,
      enabledTranslations,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: startOfToday } },
      }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          lastLoginAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.user.count({
        where: {
          deletedAt: null,
          lastLoginAt: { gte: startOfToday },
        },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.quranReciter.count({ where: { deletedAt: null } }),
      this.prisma.quranReciter.count({
        where: { deletedAt: null, isActive: true },
      }),
      this.prisma.quranTranslation.count({ where: { deletedAt: null } }),
      this.prisma.quranTranslation.count({
        where: { deletedAt: null, isActive: true },
      }),
    ]);

    return {
      totalUsers,
      todayUsers,
      activeUsers,
      todayActiveUsers,
      newUsersLast7Days,
      newUsersLast30Days,
      totalQaris,
      enabledQaris,
      totalTranslations,
      enabledTranslations,
    };
  }
}
