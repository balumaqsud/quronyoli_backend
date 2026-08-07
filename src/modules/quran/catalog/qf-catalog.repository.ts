import { Injectable } from '@nestjs/common';
import {
  QuranReciter,
  QuranReciterKind,
  QuranTafsir,
  QuranTranslation,
} from '../../../generated/prisma';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QURAN_FOUNDATION_PROVIDER } from '../../settings/interfaces/settings.interface';
import {
  CatalogReciterPayload,
  CatalogTafsirPayload,
  CatalogTranslationPayload,
} from './qf-catalog.mapper';
import { isCuratedTranslationExternalId, CURATED_TRANSLATION_EXTERNAL_IDS } from './curated-translations';

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
      orderBy: [
        { isDefault: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async listActiveTafsirs(options?: {
    languageCode?: string;
  }): Promise<QuranTafsir[]> {
    return this.prisma.quranTafsir.findMany({
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
      orderBy: [
        { isPopular: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async syncTranslations(
    items: CatalogTranslationPayload[],
  ): Promise<CatalogSyncStats> {
    const seenIds = items.map((item) => item.externalId);

    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const createActive = isCuratedTranslationExternalId(item.externalId);
        await tx.quranTranslation.upsert({
          where: {
            provider_externalId: {
              provider: item.provider,
              externalId: item.externalId,
            },
          },
          // Curated Mini App defaults (e.g. MSM Yusuf / 55) start active.
          // All other editions stay disabled until an admin enables them.
          // Updates never overwrite admin-controlled isActive / isDefault / sortOrder.
          create: { ...item, isActive: createActive },
          update: {
            languageCode: item.languageCode,
            name: item.name,
            authorName: item.authorName,
            slug: item.slug,
            deletedAt: null,
            metadata: item.metadata,
          },
        });
      }

      // Heal already-synced curated rows that were created inactive before this rule.
      // Product defaults (MSM Yusuf, etc.) stay available on the public catalog.
      await tx.quranTranslation.updateMany({
        where: {
          provider: QURAN_FOUNDATION_PROVIDER,
          externalId: { in: [...CURATED_TRANSLATION_EXTERNAL_IDS] },
          deletedAt: null,
          isActive: false,
        },
        data: { isActive: true },
      });

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
            // Preserve admin-controlled: isActive, sortOrder
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
