import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QuranFoundationClient } from '../client/quran-foundation.client';
import {
  extractResourceList,
  mapChapterReciterResource,
  mapRecitationResource,
  mapTafsirResource,
  mapTranslationResource,
} from './qf-catalog.mapper';
import { CatalogSyncStats, QfCatalogRepository } from './qf-catalog.repository';

export type QfCatalogSyncResult = {
  translations: CatalogSyncStats;
  tafsirs: CatalogSyncStats;
  reciters: CatalogSyncStats;
  chapterReciters: CatalogSyncStats;
};

@Injectable()
export class QfCatalogSyncService {
  constructor(
    private readonly client: QuranFoundationClient,
    private readonly repository: QfCatalogRepository,
    @InjectPinoLogger(QfCatalogSyncService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Fetch catalogs first, then write. Fail closed on upstream errors
   * so we never deactivate local rows against a partial/failed fetch.
   */
  async syncAll(): Promise<QfCatalogSyncResult> {
    const [translations, tafsirs, reciters, chapterReciters] =
      await Promise.all([
        this.fetchTranslations(),
        this.fetchTafsirs(),
        this.fetchAyahReciters(),
        this.fetchChapterReciters(),
      ]);

    if (
      translations.length === 0 &&
      tafsirs.length === 0 &&
      reciters.length === 0 &&
      chapterReciters.length === 0
    ) {
      throw new Error('QF catalog sync refused: all resource lists were empty');
    }

    const result: QfCatalogSyncResult = {
      translations: await this.repository.syncTranslations(translations),
      tafsirs: await this.repository.syncTafsirs(tafsirs),
      reciters: await this.repository.syncReciters(reciters, 'AYAH'),
      chapterReciters: await this.repository.syncReciters(
        chapterReciters,
        'CHAPTER',
      ),
    };

    this.logger.info({ result }, 'Quran.Foundation catalog sync completed');
    return result;
  }

  async syncTranslationsOnly(): Promise<CatalogSyncStats> {
    const translations = await this.fetchTranslations();
    if (translations.length === 0) {
      throw new Error('QF translation sync refused: empty resource list');
    }

    const stats = await this.repository.syncTranslations(translations);
    this.logger.info({ stats }, 'Quran.Foundation translations sync completed');
    return stats;
  }

  async syncRecitersOnly(): Promise<{
    reciters: CatalogSyncStats;
    chapterReciters: CatalogSyncStats;
  }> {
    const [reciters, chapterReciters] = await Promise.all([
      this.fetchAyahReciters(),
      this.fetchChapterReciters(),
    ]);

    if (reciters.length === 0 && chapterReciters.length === 0) {
      throw new Error('QF reciter sync refused: empty resource lists');
    }

    const result = {
      reciters: await this.repository.syncReciters(reciters, 'AYAH'),
      chapterReciters: await this.repository.syncReciters(
        chapterReciters,
        'CHAPTER',
      ),
    };

    this.logger.info({ result }, 'Quran.Foundation reciters sync completed');
    return result;
  }

  private async fetchTranslations() {
    const payload = await this.client.getContent<unknown>(
      '/resources/translations',
    );
    return this.mapAll(
      extractResourceList(payload, ['translations']),
      mapTranslationResource,
      'translation',
    );
  }

  private async fetchTafsirs() {
    const payload = await this.client.getContent<unknown>('/resources/tafsirs');
    return this.mapAll(
      extractResourceList(payload, ['tafsirs']),
      mapTafsirResource,
      'tafsir',
    );
  }

  private async fetchAyahReciters() {
    const payload = await this.client.getContent<unknown>(
      '/resources/recitations',
    );
    return this.mapAll(
      extractResourceList(payload, ['recitations']),
      mapRecitationResource,
      'recitation',
    );
  }

  private async fetchChapterReciters() {
    const payload = await this.client.getContent<unknown>(
      '/resources/chapter_reciters',
    );
    return this.mapAll(
      extractResourceList(payload, ['reciters', 'chapter_reciters']),
      mapChapterReciterResource,
      'chapter_reciter',
    );
  }

  private mapAll<T>(
    items: unknown[],
    mapper: (item: unknown) => T,
    label: string,
  ): T[] {
    const mapped: T[] = [];
    for (const [index, item] of items.entries()) {
      try {
        mapped.push(mapper(item));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown mapping error';
        throw new Error(
          `Failed to map ${label} at index ${index}: ${message}`,
          { cause: error },
        );
      }
    }
    return mapped;
  }
}
