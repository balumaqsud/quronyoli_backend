import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { QURAN_FOUNDATION_PROVIDER } from '../../settings/interfaces/settings.interface';
import { MushafPagePayload } from './qf-pages.mapper';

export type MushafPageSyncStats = {
  upserted: number;
  deactivated: number;
  seen: number;
};

@Injectable()
export class QfPagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertPage(item: MushafPagePayload): Promise<void> {
    await this.prisma.mushafPage.upsert({
      where: {
        provider_mushafId_pageNumber: {
          provider: item.provider,
          mushafId: item.mushafId,
          pageNumber: item.pageNumber,
        },
      },
      create: item,
      update: {
        firstVerseKey: item.firstVerseKey,
        lastVerseKey: item.lastVerseKey,
        verseKeys: item.verseKeys,
        surahIds: item.surahIds,
        juzNumber: item.juzNumber,
        hizbNumber: item.hizbNumber,
        rubElHizbNumber: item.rubElHizbNumber,
        juzNumbers: item.juzNumbers,
        hizbNumbers: item.hizbNumbers,
        rubElHizbNumbers: item.rubElHizbNumbers,
        verseCount: item.verseCount,
        imageUrl: item.imageUrl,
        imageWidth: item.imageWidth,
        isActive: true,
        syncedAt: item.syncedAt,
      },
    });
  }

  async deactivateMissing(
    mushafId: number,
    seenPageNumbers: number[],
  ): Promise<number> {
    const result = await this.prisma.mushafPage.updateMany({
      where: {
        provider: QURAN_FOUNDATION_PROVIDER,
        mushafId,
        isActive: true,
        ...(seenPageNumbers.length > 0
          ? { pageNumber: { notIn: seenPageNumbers } }
          : {}),
      },
      data: { isActive: false },
    });
    return result.count;
  }

  async findActiveByMushaf(mushafId: number) {
    return this.prisma.mushafPage.findMany({
      where: {
        provider: QURAN_FOUNDATION_PROVIDER,
        mushafId,
        isActive: true,
      },
      orderBy: { pageNumber: 'asc' },
    });
  }

  async findActivePage(mushafId: number, pageNumber: number) {
    return this.prisma.mushafPage.findFirst({
      where: {
        provider: QURAN_FOUNDATION_PROVIDER,
        mushafId,
        pageNumber,
        isActive: true,
      },
    });
  }

  async countActive(mushafId: number): Promise<number> {
    return this.prisma.mushafPage.count({
      where: {
        provider: QURAN_FOUNDATION_PROVIDER,
        mushafId,
        isActive: true,
      },
    });
  }
}
