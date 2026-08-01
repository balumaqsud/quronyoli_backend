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
  MUSHAF_PAGE_SYNC_FIELDS,
} from './qf-pages.constants';
import {
  mapVersesToMushafPage,
  QfPageVerseSnippet,
  toMushafPageApiShape,
} from './qf-pages.mapper';
import { MushafPageSyncStats, QfPagesRepository } from './qf-pages.repository';

export type QfPagesSyncResult = {
  mushafId: number;
  pages: MushafPageSyncStats;
  pageCountExpected: number;
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
    let upserted = 0;

    for (
      let pageNumber = 1;
      pageNumber <= MADANI_MUSHAF_PAGE_COUNT;
      pageNumber += 1
    ) {
      const verses = await this.fetchAllVersesForPage(pageNumber, mushafId);
      const payload = mapVersesToMushafPage(
        pageNumber,
        mushafId,
        verses,
        this.config.audioCdnBase,
      );
      await this.repository.upsertPage(payload);
      seenPageNumbers.push(pageNumber);
      upserted += 1;

      await this.cache.setJson(
        this.cache.buildKey('pages', `/local/mushaf_pages/${pageNumber}`, {
          mushaf: mushafId,
        }),
        { page: toMushafPageApiShape(payload) },
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
    await this.cache.setJson(
      this.cache.buildKey('pages', '/local/mushaf_pages', { mushaf: mushafId }),
      {
        mushaf_id: mushafId,
        total: pages.length,
        pages: pages.map((row) => toMushafPageApiShape(row)),
      },
      this.config.cacheTtl.chaptersSeconds,
    );

    return {
      mushafId,
      pageCountExpected: MADANI_MUSHAF_PAGE_COUNT,
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
}
