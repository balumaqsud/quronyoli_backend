import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '../../../generated/prisma';
import {
  OffsetPage,
  resolveOffset,
  toOffsetPage,
} from '../../../common/pagination/offset-pagination.dto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuthRequestContext } from '../../auth/interfaces/auth-request-context.interface';
import { SessionsRepository } from '../../auth/sessions.repository';
import { CurrentAdminContext } from '../../../common/decorators/current-admin.decorator';
import { AdminLogsService } from '../logs/admin-logs.service';
import {
  AdminUsersQueryDto,
  UpdateAdminUserDto,
} from './dto/admin-users.dto';

export type AdminUserListItem = User & {
  admin: { id: string; role: string } | null;
};

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminLogsService: AdminLogsService,
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  async list(query: AdminUsersQueryDto): Promise<OffsetPage<AdminUserListItem>> {
    const offset = resolveOffset(query.page, query.limit);
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: offset.skip,
        take: offset.take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          admin: {
            select: { id: true, role: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return toOffsetPage(items, total, offset.page, offset.limit);
  }

  async getById(id: string): Promise<AdminUserListItem> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        admin: {
          select: { id: true, role: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(
    id: string,
    dto: UpdateAdminUserDto,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<AdminUserListItem> {
    await this.getById(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.languageCode !== undefined
          ? { languageCode: dto.languageCode }
          : {}),
      },
      include: {
        admin: {
          select: { id: true, role: true },
        },
      },
    });

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'UPDATED',
      entity: 'User',
      entityId: id,
      description: 'Updated User',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return user;
  }

  async ban(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<AdminUserListItem> {
    await this.getById(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isBanned: true },
      include: {
        admin: {
          select: { id: true, role: true },
        },
      },
    });

    await this.sessionsRepository.revokeAllForUser(id);

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'BANNED',
      entity: 'User',
      entityId: id,
      description: 'Banned User',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return user;
  }

  async unban(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<AdminUserListItem> {
    await this.getById(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isBanned: false },
      include: {
        admin: {
          select: { id: true, role: true },
        },
      },
    });

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'UNBANNED',
      entity: 'User',
      entityId: id,
      description: 'Unbanned User',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return user;
  }

  async deactivate(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<AdminUserListItem> {
    await this.getById(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
      include: {
        admin: {
          select: { id: true, role: true },
        },
      },
    });

    await this.sessionsRepository.revokeAllForUser(id);

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'DEACTIVATED',
      entity: 'User',
      entityId: id,
      description: 'Deactivated User',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return user;
  }

  private buildWhere(query: AdminUsersQueryDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (query.includeDeleted !== true) {
      where.deletedAt = null;
    }

    if (query.languageCode) {
      where.languageCode = query.languageCode;
    }

    if (query.isBanned !== undefined) {
      where.isBanned = query.isBanned;
    }

    if (query.isAdmin === true) {
      where.admin = { isNot: null };
    } else if (query.isAdmin === false) {
      where.admin = { is: null };
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { telegramId: { contains: search } },
      ];
    }

    return where;
  }
}
