import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuranTafsir } from '../../../generated/prisma';
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
  AdminTafsirsQueryDto,
  ReorderAdminTafsirsDto,
  UpdateAdminTafsirDto,
} from './dto/admin-tafsirs.dto';

@Injectable()
export class AdminTafsirsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminLogsService: AdminLogsService,
    private readonly catalogSyncService: QfCatalogSyncService,
  ) {}

  async list(query: AdminTafsirsQueryDto): Promise<OffsetPage<QuranTafsir>> {
    const offset = resolveOffset(query.page, query.limit);
    const where = {
      deletedAt: null,
      ...(query.languageCode ? { languageCode: query.languageCode } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.quranTafsir.findMany({
        where,
        skip: offset.skip,
        take: offset.take,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.quranTafsir.count({ where }),
    ]);

    return toOffsetPage(items, total, offset.page, offset.limit);
  }

  async getById(id: string): Promise<QuranTafsir> {
    const tafsir = await this.prisma.quranTafsir.findFirst({
      where: { id, deletedAt: null },
    });

    if (!tafsir) {
      throw new NotFoundException('Tafsir not found');
    }

    return tafsir;
  }

  async update(
    id: string,
    dto: UpdateAdminTafsirDto,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<QuranTafsir> {
    await this.getById(id);

    const tafsir = await this.prisma.quranTafsir.update({
      where: { id },
      data: {
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'UPDATED',
      entity: 'Tafsir',
      entityId: id,
      description: 'Updated Tafsir',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return tafsir;
  }

  async enable(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<QuranTafsir> {
    return this.setActive(id, true, admin, context, 'Enabled Tafsir');
  }

  async disable(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<QuranTafsir> {
    return this.setActive(id, false, admin, context, 'Disabled Tafsir');
  }

  async reorder(
    dto: ReorderAdminTafsirsDto,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<{ updated: number }> {
    await this.assertAllIdsExist(dto.ids);

    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.quranTafsir.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'REORDERED',
      entity: 'Tafsir',
      description: `Reordered ${dto.ids.length} tafsirs`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { updated: dto.ids.length };
  }

  async sync(
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<unknown> {
    const result = await this.catalogSyncService.syncTafsirsOnly();

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'SYNCED',
      entity: 'Tafsir',
      description: 'Synced Tafsirs from Quran.Foundation',
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
  ): Promise<QuranTafsir> {
    await this.getById(id);

    const tafsir = await this.prisma.quranTafsir.update({
      where: { id },
      data: { isActive },
    });

    await this.adminLogsService.create({
      adminId: admin.id,
      action: isActive ? 'ENABLED' : 'DISABLED',
      entity: 'Tafsir',
      entityId: id,
      description,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return tafsir;
  }

  private async assertAllIdsExist(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    const count = await this.prisma.quranTafsir.count({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
      },
    });

    if (count !== uniqueIds.length) {
      throw new BadRequestException('One or more tafsir IDs were not found');
    }
  }
}
