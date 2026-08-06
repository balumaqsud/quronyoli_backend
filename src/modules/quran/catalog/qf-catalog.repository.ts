import { Injectable } from '@nestjs/common';
import {
  QuranReciter,
  QuranReciterKind,
  QuranTranslation,
} from '../../../generated/prisma';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QURAN_FOUNDATION_PROVIDER } from '../../settings/interfaces/settings.interface';
import {
  CatalogReciterPayload,
  CatalogTafsirPayload,
  CatalogTranslationPayload,
} from './qf-catalog.mapper';

export type CatalogSyncStats = {
  upserted: number;
  deactivated: number;
  seen: number;
};

@Injectable()
export class QfCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveTranslations(options?: {
    languageCode?: string;
  }): Promise<QuranTranslation[]> {
    return this.prisma.quranTranslation.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(options?.languageCode
          ? { languageCode: options.languageCode }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listActiveReciters(options: {
    kind: QuranReciterKind;
  }): Promise<QuranReciter[]> {
    return this.prisma.quranReciter.findMany({
      where: {
        kind: options.kind,
        isActive: true,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async syncTranslations(
    items: CatalogTranslationPayload[],
  ): Promise<CatalogSyncStats> {
    const seenIds = items.map((item) => item.externalId);

    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.quranTranslation.upsert({
          where: {
            provider_externalId: {
              provider: item.provider,
              externalId: item.externalId,
            },
          },
          // New rows start disabled until an admin enables them for the Mini App.
          create: { ...item, isActive: false },
          update: {
            languageCode: item.languageCode,
            name: item.name,
            authorName: item.authorName,
            slug: item.slug,
            deletedAt: null,
            metadata: item.metadata,
            // Preserve admin-controlled: isActive, isDefault, sortOrder
          },
        });
      }

      const deactivated =
        seenIds.length === 0
          ? (
              await tx.quranTranslation.updateMany({
                where: {
                  provider: QURAN_FOUNDATION_PROVIDER,
                  isActive: true,
                },
                data: { isActive: false },
              })
            ).count
          : (
              await tx.quranTranslation.updateMany({
                where: {
                  provider: QURAN_FOUNDATION_PROVIDER,
                  isActive: true,
                  externalId: { notIn: seenIds },
                },
                data: { isActive: false },
              })
            ).count;

      return {
        upserted: items.length,
        deactivated,
        seen: seenIds.length,
      };
    });
  }

  async syncTafsirs(items: CatalogTafsirPayload[]): Promise<CatalogSyncStats> {
    const seenIds = items.map((item) => item.externalId);

    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.quranTafsir.upsert({
          where: {
            provider_externalId: {
              provider: item.provider,
              externalId: item.externalId,
            },
          },
          create: { ...item, isActive: false },
          update: {
            languageCode: item.languageCode,
            name: item.name,
            authorName: item.authorName,
            slug: item.slug,
            deletedAt: null,
            metadata: item.metadata,
            // Preserve admin-controlled: isActive
          },
        });
      }

      const deactivated =
        seenIds.length === 0
          ? (
              await tx.quranTafsir.updateMany({
                where: {
                  provider: QURAN_FOUNDATION_PROVIDER,
                  isActive: true,
                },
                data: { isActive: false },
              })
            ).count
          : (
              await tx.quranTafsir.updateMany({
                where: {
                  provider: QURAN_FOUNDATION_PROVIDER,
                  isActive: true,
                  externalId: { notIn: seenIds },
                },
                data: { isActive: false },
              })
            ).count;

      return {
        upserted: items.length,
        deactivated,
        seen: seenIds.length,
      };
    });
  }

  async syncReciters(
    items: CatalogReciterPayload[],
    kind: 'AYAH' | 'CHAPTER',
  ): Promise<CatalogSyncStats> {
    const seenIds = items.map((item) => item.externalId);

    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.quranReciter.upsert({
          where: {
            provider_externalId_kind: {
              provider: item.provider,
              externalId: item.externalId,
              kind: item.kind,
            },
          },
          // Qaris auto-enable for Mini App so profile lists match admin catalog.
          // Translations/tafsirs remain inactive-on-create (admin-gated).
          create: { ...item, isActive: true },
          update: {
            name: item.name,
            arabicName: item.arabicName,
            style: item.style,
            slug: item.slug,
            deletedAt: null,
            metadata: item.metadata,
            // Preserve admin-controlled: isActive, isPopular, sortOrder
          },
        });
      }

      const deactivated =
        seenIds.length === 0
          ? (
              await tx.quranReciter.updateMany({
                where: {
                  provider: QURAN_FOUNDATION_PROVIDER,
                  kind,
                  isActive: true,
                },
                data: { isActive: false },
              })
            ).count
          : (
              await tx.quranReciter.updateMany({
                where: {
                  provider: QURAN_FOUNDATION_PROVIDER,
                  kind,
                  isActive: true,
                  externalId: { notIn: seenIds },
                },
                data: { isActive: false },
              })
            ).count;

      return {
        upserted: items.length,
        deactivated,
        seen: seenIds.length,
      };
    });
  }
}
