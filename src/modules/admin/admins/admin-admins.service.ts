import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, Prisma } from '../../../generated/prisma';
import {
  OffsetPage,
  resolveOffset,
  toOffsetPage,
} from '../../../common/pagination/offset-pagination.dto';
import { CurrentAdminContext } from '../../../common/decorators/current-admin.decorator';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuthRequestContext } from '../../auth/interfaces/auth-request-context.interface';
import { AdminLogsService } from '../logs/admin-logs.service';
import { CreateAdminDto } from './dto/admin-admins.dto';

export type AdminWithUser = Prisma.AdminGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        telegramId: true;
        username: true;
        firstName: true;
        lastName: true;
        photoUrl: true;
        isBanned: true;
        isActive: true;
      };
    };
  };
}>;

@Injectable()
export class AdminAdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminLogsService: AdminLogsService,
  ) {}

  async list(page = 1, limit = 20): Promise<OffsetPage<AdminWithUser>> {
    const offset = resolveOffset(page, limit);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.admin.findMany({
        skip: offset.skip,
        take: offset.take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              username: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
              isBanned: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.admin.count(),
    ]);

    return toOffsetPage(items, total, offset.page, offset.limit);
  }

  async create(
    dto: CreateAdminDto,
    actor: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<AdminWithUser> {
    const role = dto.role ?? AdminRole.ADMIN;

    if (role === AdminRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'SUPER_ADMIN can only be created via seed bootstrap',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }

    if (user.isBanned) {
      throw new BadRequestException('Cannot promote a banned user');
    }

    const existing = await this.prisma.admin.findUnique({
      where: { userId: dto.userId },
    });

    if (existing) {
      throw new ConflictException('User is already an admin');
    }

    const admin = await this.prisma.admin.create({
      data: {
        userId: dto.userId,
        role,
        createdBy: actor.id,
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            isBanned: true,
            isActive: true,
          },
        },
      },
    });

    await this.adminLogsService.create({
      adminId: actor.id,
      action: 'ADDED',
      entity: 'Admin',
      entityId: admin.id,
      description: 'Added Admin',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return admin;
  }

  async remove(
    id: string,
    actor: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<{ success: true }> {
    const target = await this.prisma.admin.findUnique({
      where: { id },
    });

    if (!target) {
      throw new NotFoundException('Admin not found');
    }

    if (target.id === actor.id) {
      throw new ForbiddenException('Cannot remove your own admin account');
    }

    if (target.role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot remove a SUPER_ADMIN');
    }

    await this.prisma.admin.delete({
      where: { id },
    });

    await this.adminLogsService.create({
      adminId: actor.id,
      action: 'REMOVED',
      entity: 'Admin',
      entityId: id,
      description: 'Removed Admin',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { success: true };
  }
}
