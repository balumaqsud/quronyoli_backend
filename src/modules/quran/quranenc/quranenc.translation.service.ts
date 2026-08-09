import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { QuranCacheService } from '../cache/quran-cache.service';
import { QuranEncClient } from './quranenc.client';
import {
  QURANENC_KYRGYZ_HAKIMOV_META,
  QuranEncTranslationKey,
} from './quranenc.constants';
import {
  NormalizedEncTranslationRow,
  QuranEncAyahRow,
  toNormalizedEncTranslationRow,
} from './quranenc.mapper';

const ENC_CACHE_TTL_SECONDS = 3600;

@Injectable()
export class QuranEncTranslationService {
  constructor(
    private readonly client: QuranEncClient,
    private readonly cache: QuranCacheService,
    @InjectPinoLogger(QuranEncTranslationService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getSurahNormalized(
    key: QuranEncTranslationKey,
    surahNumber: number,
  ): Promise<NormalizedEncTranslationRow[]> {
    const rows = await this.getSurahRowsCached(key, surahNumber);
    const name = this.resourceName(key);
    return rows.map((row) => toNormalizedEncTranslationRow(row, key, name));
  }

  async getAyahNormalized(
    key: QuranEncTranslationKey,
    surahNumber: number,
    ayahNumber: number,
  ): Promise<NormalizedEncTranslationRow> {
    const cacheKey = this.cache.buildKey(
      'verses',
      `/quranenc/${key}/by_ayah/${surahNumber}/${ayahNumber}`,
    );
    const row = await this.cache.getOrSet(cacheKey, ENC_CACHE_TTL_SECONDS, () =>
      this.client.getAyahTranslation(key, surahNumber, ayahNumber),
    );
    return toNormalizedEncTranslationRow(row, key, this.resourceName(key));
  }

  /**
   * Soft-fail helper for verse merge: returns null on Enc errors so Arabic/QF
   * translations still render.
   */
  async tryGetSurahMap(
    key: QuranEncTranslationKey,
    surahNumber: number,
  ): Promise<Map<number, NormalizedEncTranslationRow> | null> {
    try {
      const rows = await this.getSurahNormalized(key, surahNumber);
      return new Map(rows.map((row) => [row.verse_number, row]));
    } catch (error) {
      this.logger.warn(
        { err: error, key, surahNumber },
        'QuranEnc surah fetch failed; omitting from verse merge',
      );
      return null;
    }
  }

  private async getSurahRowsCached(
    key: QuranEncTranslationKey,
    surahNumber: number,
  ): Promise<QuranEncAyahRow[]> {
    const cacheKey = this.cache.buildKey(
      'verses',
      `/quranenc/${key}/by_chapter/${surahNumber}`,
    );
    return this.cache.getOrSet(cacheKey, ENC_CACHE_TTL_SECONDS, () =>
      this.client.getSurahTranslation(key, surahNumber),
    );
  }

  private resourceName(key: QuranEncTranslationKey): string {
    if (key === QURANENC_KYRGYZ_HAKIMOV_META.key) {
      return QURANENC_KYRGYZ_HAKIMOV_META.name;
    }
    return key;
  }
}
