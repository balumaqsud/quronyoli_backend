import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { VersesQueryDto } from '../dto/quran-query.dto';
import { QuranService } from '../quran.service';

const SURAH_COUNT = 114;
const WARM_CONCURRENCY = 4;
const MAX_VERSE_PAGES = 15;

/** Query shape the Mini App uses for list-read (see HTTP logs). */
const LIST_READ_QUERY: VersesQueryDto = {
  per_page: 50,
  fields: 'text_uthmani,chapter_id,verse_number,verse_key',
};

@Injectable()
export class QuranCacheWarmerService implements OnModuleInit {
  constructor(
    private readonly quran: QuranService,
    @InjectPinoLogger(QuranCacheWarmerService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.QF_CACHE_WARM === 'false'
    ) {
      return;
    }

    void this.warm();
  }

  private async warm(): Promise<void> {
    const started = Date.now();
    let surahs = 0;
    let versePages = 0;
    let failures = 0;

    const catalogTasks: Array<[string, () => Promise<unknown>]> = [
      ['surah list', () => this.quran.getSurahs({})],
      ['mushaf page list', () => this.quran.getPages({})],
      ['translations', () => this.quran.getTranslations({})],
      ['tafsirs', () => this.quran.getTafsirs({})],
      ['recitations', () => this.quran.getRecitations({})],
      ['chapter reciters', () => this.quran.getChapterReciters({})],
      ['mushafs', () => this.quran.getMushafs()],
    ];
    const catalogResults = await Promise.all(
      catalogTasks.map(async ([label, load]) => {
        try {
          await load();
          return 0;
        } catch (error) {
          this.logger.warn({ err: error, label }, 'Catalog cache warm failed');
          return 1;
        }
      }),
    );
    failures += catalogResults.reduce<number>((sum, count) => sum + count, 0);

    const chapters = Array.from(
      { length: SURAH_COUNT },
      (_, index) => index + 1,
    );
    await this.mapPool(chapters, WARM_CONCURRENCY, async (chapter) => {
      const [surahOk, pages] = await Promise.all([
        this.quran
          .getSurah(chapter, {})
          .then(() => true)
          .catch((error: unknown) => {
            this.logger.warn(
              { err: error, chapter },
              'Surah cache warm failed',
            );
            return false;
          }),
        this.warmSurahVerses(chapter).catch((error: unknown) => {
          this.logger.warn(
            { err: error, chapter },
            'Surah verse cache warm failed',
          );
          return -1;
        }),
      ]);
      if (surahOk) {
        surahs += 1;
      } else {
        failures += 1;
      }
      if (pages < 0) {
        failures += 1;
      } else {
        versePages += pages;
      }
    });

    const ms = Date.now() - started;
    this.logger.info(
      { surahs, versePages, failures, ms },
      'Quran cache warm finished',
    );
  }

  private async warmSurahVerses(chapter: number): Promise<number> {
    let pages = 0;

    for (let page = 1; page <= MAX_VERSE_PAGES; page += 1) {
      const payload = await this.quran.getAyahsBySurah(chapter, {
        ...LIST_READ_QUERY,
        page,
      });
      pages += 1;
      const next = this.readNextPage(payload);
      if (next === null || next <= page) {
        break;
      }
    }

    return pages;
  }

  private readNextPage(payload: unknown): number | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const next = (payload as { pagination?: { next_page?: unknown } })
      .pagination?.next_page;
    return typeof next === 'number' && Number.isFinite(next) ? next : null;
  }

  private async mapPool<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    let cursor = 0;
    const runners = Array.from({ length: limit }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (item !== undefined) {
          await worker(item);
        }
      }
    });
    await Promise.all(runners);
  }
}
