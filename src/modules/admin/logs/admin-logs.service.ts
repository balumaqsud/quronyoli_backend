import { Injectable } from '@nestjs/common';
import { AdminLog, Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  OffsetPage,
  resolveOffset,
  toOffsetPage,
} from '../../../common/pagination/offset-pagination.dto';

export type CreateAdminLogInput = {
  adminId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AdminLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAdminLogInput): Promise<AdminLog> {
    return this.prisma.adminLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        description: input.description ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  async list(page = 1, limit = 20): Promise<OffsetPage<AdminLog>> {
    const offset = resolveOffset(page, limit);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminLog.findMany({
        skip: offset.skip,
        take: offset.take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          admin: {
            select: {
              id: true,
              role: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  telegramId: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.adminLog.count(),
    ]);

    return toOffsetPage(items, total, offset.page, offset.limit);
  }
}

export type AdminLogWithAdmin = Prisma.AdminLogGetPayload<{
  include: {
    admin: {
      select: {
        id: true;
        role: true;
        userId: true;
        user: {
          select: {
            id: true;
            telegramId: true;
            username: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
  };
}>;
