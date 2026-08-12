import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CONFIG_KEYS } from '../../../common/constants';
import { QuranFoundationConfig } from '../../../config/configuration';
import { QuranCacheService } from '../cache/quran-cache.service';
import { QuranFoundationClient } from '../client/quran-foundation.client';
import {
  DEFAULT_MUSHAF_ID,
  MADANI_MUSHAF_PAGE_COUNT,
  MADANI_MUSHAF_VERSE_COUNT,
  MUSHAF_PAGE_SYNC_FIELDS,
} from './qf-pages.constants';
import {
  mapVersesToMushafPage,
  applyPageImageMeta,
  QfPageVerseSnippet,
  toMushafPageDetail,
  toMushafPageListItem,
} from './qf-pages.mapper';
import { MushafPageSyncStats, QfPagesRepository } from './qf-pages.repository';
import { mushafNeedsOwnLayoutSync } from './qf-page-images';

export type QfPagesSyncResult = {
  mushafId: number;
  pages: MushafPageSyncStats;
  pageCountExpected: number;
  verseCountExpected: number;
  verseCountSynced: number;
};

type VersesByPageResponse = {
  verses?: QfPageVerseSnippet[];
  pagination?: {
    current_page?: number;
    next_page?: number | null;
    total_pages?: number;
  };
};

@Injectable()
export class QfPagesSyncService {
  private readonly config: QuranFoundationConfig;

  constructor(
    private readonly client: QuranFoundationClient,
    private readonly repository: QfPagesRepository,
    private readonly cache: QuranCacheService,
    private readonly configService: ConfigService,
    @InjectPinoLogger(QfPagesSyncService.name)
    private readonly logger: PinoLogger,
  ) {
    this.config = this.configService.getOrThrow<QuranFoundationConfig>(
      CONFIG_KEYS.QURAN_FOUNDATION,
    );
  }

  async syncMadaniPages(
    mushafId: number = DEFAULT_MUSHAF_ID,
  ): Promise<QfPagesSyncResult> {
    const seenPageNumbers: number[] = [];
    const allVerseKeys = new Set<string>();
    let upserted = 0;

    for (
      let pageNumber = 1;
      pageNumber <= MADANI_MUSHAF_PAGE_COUNT;
      pageNumber += 1
    ) {
      const verses = await this.fetchAllVersesForPage(pageNumber, mushafId);
      const payload = applyPageImageMeta(
        mapVersesToMushafPage(pageNumber, mushafId, verses),
        this.pageImageConfig(),
      );

      for (const key of payload.verseKeys) {
        if (allVerseKeys.has(key)) {
          throw new Error(
            `Duplicate verse_key "${key}" on page ${pageNumber}; every verse must belong to exactly one page`,
          );
        }
        allVerseKeys.add(key);
      }

      await this.repository.upsertPage(payload);
      seenPageNumbers.push(pageNumber);
      upserted += 1;

      await this.cache.setJson(
        this.cache.pageMetadataKey(pageNumber, mushafId),
        toMushafPageDetail(payload, this.pageImageConfig()),
        this.config.cacheTtl.chaptersSeconds,
      );

      if (pageNumber % 50 === 0 || pageNumber === MADANI_MUSHAF_PAGE_COUNT) {
        this.logger.info(
          { pageNumber, upserted, mushafId },
          'Mushaf page metadata sync progress',
        );
      }
    }

    const deactivated = await this.repository.deactivateMissing(
      mushafId,
      seenPageNumbers,
    );

    const pages = await this.repository.findActiveByMushaf(mushafId);
    if (pages.length !== MADANI_MUSHAF_PAGE_COUNT) {
      throw new Error(
        `Expected ${MADANI_MUSHAF_PAGE_COUNT} active mushaf pages, got ${pages.length}`,
      );
    }

    if (allVerseKeys.size !== MADANI_MUSHAF_VERSE_COUNT) {
      throw new Error(
        `Expected ${MADANI_MUSHAF_VERSE_COUNT} unique verse keys across pages, got ${allVerseKeys.size}`,
      );
    }

    const firstPage = pages[0];
    const lastPage = pages[pages.length - 1];
    this.logger.info(
      {
        mushafId,
        pageCount: pages.length,
        verseCount: allVerseKeys.size,
        firstPageKeys: {
          first: firstPage?.firstVerseKey,
          last: firstPage?.lastVerseKey,
        },
        lastPageKeys: {
          first: lastPage?.firstVerseKey,
          last: lastPage?.lastVerseKey,
        },
      },
      'Mushaf page sync integrity checks passed',
    );

    const list = pages.map((row) => toMushafPageListItem(row));
    await this.cache.setJson(
      this.cache.pagesListKey(mushafId),
      {
        pages: list,
        total: list.length,
        totalPages: list.length,
      },
      this.config.cacheTtl.chaptersSeconds,
    );

    await this.cache.invalidateAfterPagesSync(mushafId);

    return {
      mushafId,
      pageCountExpected: MADANI_MUSHAF_PAGE_COUNT,
      verseCountExpected: MADANI_MUSHAF_VERSE_COUNT,
      verseCountSynced: allVerseKeys.size,
      pages: {
        upserted,
        deactivated,
        seen: seenPageNumbers.length,
      },
    };
  }

  /**
   * Clone Madani page coordinates from a synced source mushaf to another id.
   * Safe for editions that share the standard 604-page Madani layout (1, 4, 5, 19, …).
   * Avoids a full QF crawl when page boundaries are identical.
   */
  async cloneMadaniPagesFrom(
    sourceMushafId: number,
    targetMushafId: number,
  ): Promise<QfPagesSyncResult> {
    if (sourceMushafId === targetMushafId) {
      throw new Error('source and target mushaf ids must differ');
    }

    if (mushafNeedsOwnLayoutSync(targetMushafId)) {
      throw new Error(
        `Cannot clone onto image mushaf=${targetMushafId}; run a full QF sync (npm run qf:sync-pages -- --mushaf=${targetMushafId}) so page breaks match the printed edition.`,
      );
    }

    const sourcePages =
      await this.repository.findActiveByMushaf(sourceMushafId);
    if (sourcePages.length !== MADANI_MUSHAF_PAGE_COUNT) {
      throw new Error(
        `Source mushaf=${sourceMushafId} has ${sourcePages.length} pages; expected ${MADANI_MUSHAF_PAGE_COUNT}. Run qf:sync-pages first.`,
      );
    }

    const seenPageNumbers: number[] = [];
    const allVerseKeys = new Set<string>();
    let upserted = 0;

    for (const row of sourcePages) {
      const payload = applyPageImageMeta(
        {
          provider: row.provider,
          mushafId: targetMushafId,
          pageNumber: row.pageNumber,
          firstVerseKey: row.firstVerseKey,
          lastVerseKey: row.lastVerseKey,
          verseKeys: row.verseKeys,
          surahIds: row.surahIds,
          juzNumber: row.juzNumber,
          hizbNumber: row.hizbNumber,
          rubElHizbNumber: row.rubElHizbNumber,
          juzNumbers: row.juzNumbers,
          hizbNumbers: row.hizbNumbers,
          rubElHizbNumbers: row.rubElHizbNumbers,
          verseCount: row.verseCount,
          imageUrl: null,
          imageWidth: null,
          isActive: true,
          syncedAt: new Date(),
        },
        this.pageImageConfig(),
      );

      for (const key of payload.verseKeys) {
        allVerseKeys.add(key);
      }

      await this.repository.upsertPage(payload);
      seenPageNumbers.push(row.pageNumber);
      upserted += 1;

      await this.cache.setJson(
        this.cache.pageMetadataKey(row.pageNumber, targetMushafId),
        toMushafPageDetail(payload, this.pageImageConfig()),
        this.config.cacheTtl.chaptersSeconds,
      );
    }

    const deactivated = await this.repository.deactivateMissing(
      targetMushafId,
      seenPageNumbers,
    );

    const pages = await this.repository.findActiveByMushaf(targetMushafId);
    if (pages.length !== MADANI_MUSHAF_PAGE_COUNT) {
      throw new Error(
        `Expected ${MADANI_MUSHAF_PAGE_COUNT} active pages after clone to mushaf=${targetMushafId}, got ${pages.length}`,
      );
    }

    const list = pages.map((row) => toMushafPageListItem(row));
    await this.cache.setJson(
      this.cache.pagesListKey(targetMushafId),
      {
        pages: list,
        total: list.length,
        totalPages: list.length,
      },
      this.config.cacheTtl.chaptersSeconds,
    );

    await this.cache.invalidateAfterPagesSync(targetMushafId);

    this.logger.info(
      {
        sourceMushafId,
        targetMushafId,
        pageCount: pages.length,
        verseCount: allVerseKeys.size,
      },
      'Cloned Madani mushaf page metadata',
    );

    return {
      mushafId: targetMushafId,
      pageCountExpected: MADANI_MUSHAF_PAGE_COUNT,
      verseCountExpected: MADANI_MUSHAF_VERSE_COUNT,
      verseCountSynced: allVerseKeys.size,
      pages: {
        upserted,
        deactivated,
        seen: seenPageNumbers.length,
      },
    };
  }

  private async fetchAllVersesForPage(
    pageNumber: number,
    mushafId: number,
  ): Promise<QfPageVerseSnippet[]> {
    const verses: QfPageVerseSnippet[] = [];
    let page = 1;

    for (;;) {
      const payload = await this.client.getContent<VersesByPageResponse>(
        `/verses/by_page/${pageNumber}`,
        {
          mushaf: mushafId,
          per_page: 50,
          page,
          fields: MUSHAF_PAGE_SYNC_FIELDS,
        },
      );

      const batch = payload.verses ?? [];
      verses.push(...batch);

      const totalPages = payload.pagination?.total_pages ?? 1;
      if (page >= totalPages) {
        break;
      }
      page += 1;
    }

    return verses;
  }

  private pageImageConfig() {
    const bases: Record<number, { baseUrl: string; extension: string }> = {
      10: {
        baseUrl: this.config.tajweedPageImageBase,
        extension: this.config.tajweedPageImageExt,
      },
    };
    if (this.config.madina1405PageImageBase) {
      bases[1405] = {
        baseUrl: this.config.madina1405PageImageBase,
        extension: this.config.madina1405PageImageExt,
      };
    }
    return { bases };
  }
}
