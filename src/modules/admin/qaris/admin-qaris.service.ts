import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuranReciter } from '../../../generated/prisma';
import {
  OffsetPage,
  resolveOffset,
  toOffsetPage,
} from '../../../common/pagination/offset-pagination.dto';
import { CurrentAdminContext } from '../../../common/decorators/current-admin.decorator';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QfCatalogSyncService } from '../../quran/catalog/qf-catalog-sync.service';
import { AuthRequestContext } from '../../auth/interfaces/auth-request-context.interface';
import { AdminLogsService } from '../logs/admin-logs.service';
import {
  AdminQarisQueryDto,
  ReorderAdminQarisDto,
  UpdateAdminQariDto,
} from './dto/admin-qaris.dto';

@Injectable()
export class AdminQarisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminLogsService: AdminLogsService,
    private readonly catalogSyncService: QfCatalogSyncService,
  ) {}

  async list(query: AdminQarisQueryDto): Promise<OffsetPage<QuranReciter>> {
    const offset = resolveOffset(query.page, query.limit);
    const where = {
      deletedAt: null,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.isPopular !== undefined ? { isPopular: query.isPopular } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.quranReciter.findMany({
        where,
        skip: offset.skip,
        take: offset.take,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.quranReciter.count({ where }),
    ]);

    return toOffsetPage(items, total, offset.page, offset.limit);
  }

  async getById(id: string): Promise<QuranReciter> {
    const qari = await this.prisma.quranReciter.findFirst({
      where: { id, deletedAt: null },
    });

    if (!qari) {
      throw new NotFoundException('Qari not found');
    }

    return qari;
  }

  async update(
    id: string,
    dto: UpdateAdminQariDto,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<QuranReciter> {
    await this.getById(id);

    const qari = await this.prisma.quranReciter.update({
      where: { id },
      data: {
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.isPopular !== undefined ? { isPopular: dto.isPopular } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'UPDATED',
      entity: 'Qari',
      entityId: id,
      description: 'Updated Qari',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return qari;
  }

  async enable(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<QuranReciter> {
    return this.setActive(id, true, admin, context, 'Enabled Qari');
  }

  async disable(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<QuranReciter> {
    return this.setActive(id, false, admin, context, 'Disabled Qari');
  }

  async setPopular(
    id: string,
    isPopular: boolean,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<QuranReciter> {
    await this.getById(id);

    const qari = await this.prisma.quranReciter.update({
      where: { id },
      data: { isPopular },
    });

    await this.adminLogsService.create({
      adminId: admin.id,
      action: isPopular ? 'MARKED_POPULAR' : 'UNMARKED_POPULAR',
      entity: 'Qari',
      entityId: id,
      description: isPopular ? 'Marked Qari popular' : 'Unmarked Qari popular',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return qari;
  }

  async reorder(
    dto: ReorderAdminQarisDto,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<{ updated: number }> {
    await this.assertAllIdsExist(dto.ids);

    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.quranReciter.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'REORDERED',
      entity: 'Qari',
      description: `Reordered ${dto.ids.length} qaris`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { updated: dto.ids.length };
  }

  async sync(
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<unknown> {
    const result = await this.catalogSyncService.syncRecitersOnly();

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'SYNCED',
      entity: 'Qari',
      description: 'Synced Qaris from Quran.Foundation',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return result;
  }

  private async setActive(
    id: string,
    isActive: boolean,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
    description: string,
  ): Promise<QuranReciter> {
    await this.getById(id);

    const qari = await this.prisma.quranReciter.update({
      where: { id },
      data: { isActive },
    });

    await this.adminLogsService.create({
      adminId: admin.id,
      action: isActive ? 'ENABLED' : 'DISABLED',
      entity: 'Qari',
      entityId: id,
      description,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return qari;
  }

  private async assertAllIdsExist(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    const count = await this.prisma.quranReciter.count({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
      },
    });

    if (count !== uniqueIds.length) {
      throw new BadRequestException('One or more qari IDs were not found');
    }
  }
}
