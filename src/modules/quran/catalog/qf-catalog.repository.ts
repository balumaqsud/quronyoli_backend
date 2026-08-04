import { Injectable } from '@nestjs/common';
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
          create: item,
          update: {
            languageCode: item.languageCode,
            name: item.name,
            authorName: item.authorName,
            slug: item.slug,
            isActive: true,
            deletedAt: null,
            metadata: item.metadata,
            // Preserve admin-only fields: isDefault, sortOrder
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
          create: item,
          update: {
            languageCode: item.languageCode,
            name: item.name,
            authorName: item.authorName,
            slug: item.slug,
            isActive: true,
            deletedAt: null,
            metadata: item.metadata,
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
          create: item,
          update: {
            name: item.name,
            arabicName: item.arabicName,
            style: item.style,
            slug: item.slug,
            isActive: true,
            deletedAt: null,
            metadata: item.metadata,
            // Preserve admin-only fields: isPopular, sortOrder
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
