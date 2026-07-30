import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONFIG_KEYS } from '../../common/constants';
import { AnalyticsConfig } from '../../config/configuration';
import { UsersService } from '../users/users.service';
import { DEFAULT_READING_TIMEZONE } from '../reading/constants/quran-coordinates';
import { toDateOnly } from '../reading/utils/reading-date.utils';
import { AnalyticsRepository } from './analytics.repository';
import {
  normalizeAnalyticsEvent,
  RawAnalyticsEventInput,
} from './analytics.validation';
import {
  AnalyticsIngestResponseDto,
  AnalyticsStatisticsQueryDto,
  AnalyticsStatisticsResponseDto,
} from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  private readonly config: AnalyticsConfig;

  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.config = this.configService.getOrThrow<AnalyticsConfig>(
      CONFIG_KEYS.ANALYTICS,
    );
  }

  async ingestOne(
    userId: string,
    input: RawAnalyticsEventInput,
  ): Promise<AnalyticsIngestResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const event = normalizeAnalyticsEvent(userId, input, this.config);
    return this.analyticsRepository.insertMany(
      [event],
      this.config.dbChunkSize,
    );
  }

  async ingestBatch(
    userId: string,
    inputs: RawAnalyticsEventInput[],
  ): Promise<AnalyticsIngestResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);

    if (inputs.length > this.config.maxBatchSize) {
      throw new BadRequestException(
        `Batch size cannot exceed ${this.config.maxBatchSize}`,
      );
    }

    const events = inputs.map((input) =>
      normalizeAnalyticsEvent(userId, input, this.config),
    );

    return this.analyticsRepository.insertMany(events, this.config.dbChunkSize);
  }

  async getStatistics(
    userId: string,
    query: AnalyticsStatisticsQueryDto,
  ): Promise<AnalyticsStatisticsResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);

    const fromIso = query.from.slice(0, 10);
    const toIso = query.to.slice(0, 10);
    if (fromIso > toIso) {
      throw new BadRequestException('from must be on or before to');
    }

    const from = toDateOnly(fromIso);
    const to = new Date(`${toIso}T23:59:59.999Z`);
    const spanMs = to.getTime() - from.getTime();
    const maxSpanMs = 366 * 24 * 60 * 60 * 1000;
    if (spanMs > maxSpanMs) {
      throw new BadRequestException('Statistics range cannot exceed 366 days');
    }

    const timezone = query.timezone ?? DEFAULT_READING_TIMEZONE;
    this.assertTimezone(timezone);

    const [
      totalEvents,
      countsByEvent,
      dailySeries,
      uniqueActiveDays,
      surahTops,
      topAyahs,
      bounds,
    ] = await Promise.all([
      this.analyticsRepository.countTotal(userId, from, to),
      this.analyticsRepository.countByEventName(userId, from, to),
      this.analyticsRepository.dailySeries(userId, from, to, timezone),
      this.analyticsRepository.uniqueActiveDays(userId, from, to, timezone),
      this.analyticsRepository.topProperty(
        userId,
        from,
        to,
        'SURAH_OPEN',
        'chapterNumber',
      ),
      this.analyticsRepository.topProperty(
        userId,
        from,
        to,
        'AYAH_OPEN',
        'verseKey',
      ),
      this.analyticsRepository.findFirstLast(userId, from, to),
    ]);

    const countMap = new Map(
      countsByEvent.map((row) => [row.eventName, row.count]),
    );

    let topSurahs = surahTops;
    if (topSurahs.length === 0) {
      topSurahs = await this.analyticsRepository.topProperty(
        userId,
        from,
        to,
        'AYAH_OPEN',
        'chapterNumber',
      );
    }

    return {
      from: fromIso,
      to: toIso,
      timezone,
      totalEvents,
      uniqueActiveDays,
      countsByEvent,
      dailySeries,
      topSurahs,
      topAyahs,
      searchCount: countMap.get('SEARCH') ?? 0,
      shareCount: countMap.get('SHARE') ?? 0,
      audioPlayCount: countMap.get('AUDIO_PLAY') ?? 0,
      firstEventAt: bounds.firstEventAt,
      lastEventAt: bounds.lastEventAt,
    };
  }

  private assertTimezone(timezone: string): void {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      throw new BadRequestException('Invalid timezone');
    }
  }
}
