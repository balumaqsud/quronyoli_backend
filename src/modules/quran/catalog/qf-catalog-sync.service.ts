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
    const [
      translationPayload,
      tafsirPayload,
      recitationPayload,
      chapterReciterPayload,
    ] = await Promise.all([
      this.client.getContent<unknown>('/resources/translations'),
      this.client.getContent<unknown>('/resources/tafsirs'),
      this.client.getContent<unknown>('/resources/recitations'),
      this.client.getContent<unknown>('/resources/chapter_reciters'),
    ]);

    const translations = this.mapAll(
      extractResourceList(translationPayload, ['translations']),
      mapTranslationResource,
      'translation',
    );
    const tafsirs = this.mapAll(
      extractResourceList(tafsirPayload, ['tafsirs']),
      mapTafsirResource,
      'tafsir',
    );
    const reciters = this.mapAll(
      extractResourceList(recitationPayload, ['recitations']),
      mapRecitationResource,
      'recitation',
    );
    const chapterReciters = this.mapAll(
      extractResourceList(chapterReciterPayload, [
        'reciters',
        'chapter_reciters',
      ]),
      mapChapterReciterResource,
      'chapter_reciter',
    );

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
