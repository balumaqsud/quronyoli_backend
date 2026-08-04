import {
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
import { AuthRequestContext } from '../../auth/interfaces/auth-request-context.interface';
import { AdminLogsService } from '../logs/admin-logs.service';
import {
  AdminTranslationsQueryDto,
  ReorderAdminTranslationsDto,
  UpdateAdminTranslationDto,
} from './dto/admin-translations.dto';

@Injectable()
export class AdminTranslationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminLogsService: AdminLogsService,
    private readonly catalogSyncService: QfCatalogSyncService,
  ) {}

  async list(
    query: AdminTranslationsQueryDto,
  ): Promise<OffsetPage<QuranTranslation>> {
    const offset = resolveOffset(query.page, query.limit);
    const where = {
      deletedAt: null as null,
      ...(query.languageCode ? { languageCode: query.languageCode } : {}),
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

    return toOffsetPage(items, total, offset.page, offset.limit);
  }

  async getById(id: string): Promise<QuranTranslation> {
    const translation = await this.prisma.quranTranslation.findFirst({
      where: { id, deletedAt: null },
    });

    if (!translation) {
      throw new NotFoundException('Translation not found');
    }

    return translation;
  }

  async update(
    id: string,
    dto: UpdateAdminTranslationDto,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<QuranTranslation> {
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

    return translation;
  }

  async enable(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<QuranTranslation> {
    return this.setActive(id, true, admin, context, 'Enabled Translation');
  }

  async disable(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<QuranTranslation> {
    return this.setActive(id, false, admin, context, 'Disabled Translation');
  }

  async setDefault(
    id: string,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<QuranTranslation> {
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

    return translation;
  }

  async reorder(
    dto: ReorderAdminTranslationsDto,
    admin: CurrentAdminContext,
    context: AuthRequestContext,
  ): Promise<{ updated: number }> {
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
  ): Promise<QuranTranslation> {
    await this.getById(id);

    const translation = await this.prisma.quranTranslation.update({
      where: { id },
      data: { isActive },
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

    return translation;
  }
}
