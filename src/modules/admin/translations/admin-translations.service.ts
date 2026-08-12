import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuranTranslation } from '../../../generated/prisma';
import {
  OffsetPage,
  resolveOffset,
  toOffsetPage,
} from '../../../common/pagination/offset-pagination.dto';
import { CurrentAdminContext } from '../../../common/decorators/current-admin.decorator';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QfCatalogSyncService } from '../../quran/catalog/qf-catalog-sync.service';
import { resolveCatalogLanguageFilter } from '../../quran/catalog/qf-catalog.mapper';
import { AuthRequestContext } from '../../auth/interfaces/auth-request-context.interface';
import { AdminLogsService } from '../logs/admin-logs.service';
import {
  AdminTranslationsQueryDto,
  ReorderAdminTranslationsDto,
  UpdateAdminTranslationDto,
} from './dto/admin-translations.dto';

/** Admin list/detail payload: Prisma row + QF resource id alias for the Mini App UI. */
export type AdminTranslationView = QuranTranslation & {
  resourceId: string;
};

@Injectable()
export class AdminTranslationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminLogsService: AdminLogsService,
    private readonly catalogSyncService: QfCatalogSyncService,
  ) {}

  async list(
    query: AdminTranslationsQueryDto,
  ): Promise<OffsetPage<AdminTranslationView>> {
    const offset = resolveOffset(query.page, query.limit);
    const languageCode = resolveCatalogLanguageFilter(query.languageCode);
    const where = {
      deletedAt: null,
      ...(languageCode ? { languageCode } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.isDefault !== undefined ? { isDefault: query.isDefault } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.quranTranslation.findMany({
        where,
        skip: offset.skip,
        take: offset.take,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.quranTranslation.count({ where }),
    ]);

    return toOffsetPage(
      items.map((item) => this.toAdminTranslation(item)),
      total,
      offset.page,
      offset.limit,
    );
  }

  async getById(id: string): Promise<AdminTranslationView> {
    const translation = await this.prisma.quranTranslation.findFirst({
      where: { id, deletedAt: null },
    });

    if (!translation) {
      throw new NotFoundException('Translation not found');
    }

    return this.toAdminTranslation(translation);
  }

  async update(
    id: string,
    dto: UpdateAdminTranslationDto,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<AdminTranslationView> {
    await this.getById(id);

    const translation = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.quranTranslation.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.quranTranslation.update({
        where: { id },
        data: {
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          ...(dto.isActive === false ? { isDefault: false } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
    });

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'UPDATED',
      entity: 'Translation',
      entityId: id,
      description: 'Updated Translation',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return this.toAdminTranslation(translation);
  }

  async enable(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<AdminTranslationView> {
    return this.setActive(id, true, admin, context, 'Enabled Translation');
  }

  async disable(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<AdminTranslationView> {
    return this.setActive(id, false, admin, context, 'Disabled Translation');
  }

  async setDefault(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<AdminTranslationView> {
    await this.getById(id);

    const translation = await this.prisma.$transaction(async (tx) => {
      await tx.quranTranslation.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });

      return tx.quranTranslation.update({
        where: { id },
        data: { isDefault: true, isActive: true },
      });
    });

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'SET_DEFAULT',
      entity: 'Translation',
      entityId: id,
      description: 'Set Default Translation',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return this.toAdminTranslation(translation);
  }

  async reorder(
    dto: ReorderAdminTranslationsDto,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<{ updated: number }> {
    await this.assertAllIdsExist(dto.ids);

    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.quranTranslation.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'REORDERED',
      entity: 'Translation',
      description: `Reordered ${dto.ids.length} translations`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { updated: dto.ids.length };
  }

  async sync(
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<unknown> {
    const result = await this.catalogSyncService.syncTranslationsOnly();

    await this.adminLogsService.create({
      adminId: admin.id,
      action: 'SYNCED',
      entity: 'Translation',
      description: 'Synced Translations from Quran.Foundation',
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
  ): Promise<AdminTranslationView> {
    await this.getById(id);

    const translation = await this.prisma.quranTranslation.update({
      where: { id },
      data: {
        isActive,
        ...(isActive ? {} : { isDefault: false }),
      },
    });

    await this.adminLogsService.create({
      adminId: admin.id,
      action: isActive ? 'ENABLED' : 'DISABLED',
      entity: 'Translation',
      entityId: id,
      description,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return this.toAdminTranslation(translation);
  }

  private toAdminTranslation(row: QuranTranslation): AdminTranslationView {
    return {
      ...row,
      resourceId: row.externalId,
    };
  }

  private async assertAllIdsExist(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    const count = await this.prisma.quranTranslation.count({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
      },
    });

    if (count !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more translation IDs were not found',
      );
    }
  }
}
