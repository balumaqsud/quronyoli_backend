import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CONFIG_KEYS } from '../../common/constants';
import { UsersService } from '../users/users.service';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
import { TOTAL_QURAN_AYAHS } from './constants/quran-coordinates';
import { ReadingRepository } from './reading.repository';
import { ReadingService } from './reading.service';
import { encodeKeysetCursor } from '../../common/pagination/keyset-cursor';

describe('ReadingService', () => {
  let service: ReadingService;
  let repository: jest.Mocked<
    Pick<
      ReadingRepository,
      | 'recordAyahOpen'
      | 'findProgress'
      | 'findRecent'
      | 'findHistory'
      | 'countUniqueAyahs'
      | 'sumReadCounts'
      | 'findDaysInRange'
      | 'findActiveDayDates'
      | 'countActiveDays'
      | 'getTimezone'
      | 'findDay'
    >
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'getActiveByIdOrThrow'>>;
  let analyticsTracking: jest.Mocked<Pick<AnalyticsTrackingService, 'track'>>;

  beforeEach(async () => {
    repository = {
      recordAyahOpen: jest.fn().mockResolvedValue(undefined),
      findProgress: jest.fn(),
      findRecent: jest.fn(),
      findHistory: jest.fn(),
      countUniqueAyahs: jest.fn(),
      sumReadCounts: jest.fn(),
      findDaysInRange: jest.fn(),
      findActiveDayDates: jest.fn(),
      countActiveDays: jest.fn(),
      getTimezone: jest.fn().mockResolvedValue('Asia/Tashkent'),
      findDay: jest.fn(),
    };
    usersService = {
      getActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    analyticsTracking = {
      track: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingService,
        { provide: ReadingRepository, useValue: repository },
        { provide: UsersService, useValue: usersService },
        { provide: AnalyticsTrackingService, useValue: analyticsTracking },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === CONFIG_KEYS.READING) {
                return { streakLookbackDays: 400 };
              }
              throw new Error(`Unexpected key ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(ReadingService);
  });

  it('records an ayah open for a valid verse key', async () => {
    await service.recordAyahOpen('user-1', '2:255');

    expect(repository.recordAyahOpen).toHaveBeenCalledWith({
      userId: 'user-1',
      chapterNumber: 2,
      verseNumber: 255,
    });
    expect(analyticsTracking.track).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        eventName: 'AYAH_OPEN',
      }),
    );
  });

  it('rejects invalid verse keys', async () => {
    await expect(
      service.recordAyahOpen('user-1', '114:999'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.recordAyahOpen).not.toHaveBeenCalled();
  });

  it('maps continue reading from the latest cursor', async () => {
    repository.findProgress.mockResolvedValue({
      userId: 'user-1',
      chapterNumber: 1,
      verseNumber: 1,
      wordNumber: null,
      lastTranslationId: null,
      lastTafsirId: null,
      lastReciterId: null,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-30T00:00:00.000Z'),
    });

    await expect(service.getContinue('user-1')).resolves.toEqual({
      chapterNumber: 1,
      verseNumber: 1,
      verseKey: '1:1',
      wordNumber: null,
      lastReadAt: new Date('2026-07-30T00:00:00.000Z'),
    });
  });

  it('paginates recent ayahs with a next cursor', async () => {
    const rows = [
      {
        id: 'r2',
        userId: 'user-1',
        chapterNumber: 2,
        verseNumber: 2,
        firstReadAt: new Date('2026-07-01T00:00:00.000Z'),
        lastReadAt: new Date('2026-07-30T02:00:00.000Z'),
        readCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'r1',
        userId: 'user-1',
        chapterNumber: 2,
        verseNumber: 1,
        firstReadAt: new Date('2026-07-01T00:00:00.000Z'),
        lastReadAt: new Date('2026-07-30T01:00:00.000Z'),
        readCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    repository.findRecent.mockResolvedValue(rows);

    const result = await service.getRecent('user-1', 1);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.verseKey).toBe('2:2');
    expect(result.nextCursor).toBe(
      encodeKeysetCursor({
        at: '2026-07-30T02:00:00.000Z',
        id: 'r2',
      }),
    );
  });

  it('computes progress percentage and repeated opens', async () => {
    repository.countUniqueAyahs.mockResolvedValue(2);
    repository.sumReadCounts.mockResolvedValue(5);
    repository.findProgress.mockResolvedValue(null);

    await expect(service.getProgress('user-1')).resolves.toEqual({
      uniqueAyahsRead: 2,
      totalQuranAyahs: TOTAL_QURAN_AYAHS,
      completionPercentage: Number(((2 / TOTAL_QURAN_AYAHS) * 100).toFixed(2)),
      totalOpens: 5,
      repeatedOpens: 3,
      continue: null,
    });
  });

  it('computes current and longest streaks', async () => {
    repository.countUniqueAyahs.mockResolvedValue(3);
    repository.sumReadCounts.mockResolvedValue(3);
    repository.countActiveDays.mockResolvedValue(3);
    repository.findProgress.mockResolvedValue(null);
    repository.getTimezone.mockResolvedValue('UTC');

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(
      Date.UTC(
        Number(today.slice(0, 4)),
        Number(today.slice(5, 7)) - 1,
        Number(today.slice(8, 10)) - 1,
      ),
    )
      .toISOString()
      .slice(0, 10);
    const older = '2026-01-01';
    const olderNext = '2026-01-02';

    repository.findDaysInRange.mockResolvedValue([
      {
        id: 'd1',
        userId: 'user-1',
        localDate: new Date(`${today}T00:00:00.000Z`),
        timezone: 'UTC',
        versesRead: 2,
        activeSeconds: 0,
        sessionsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    repository.findActiveDayDates.mockResolvedValue([
      { localDate: new Date(`${today}T00:00:00.000Z`) },
      { localDate: new Date(`${yesterday}T00:00:00.000Z`) },
      { localDate: new Date(`${olderNext}T00:00:00.000Z`) },
      { localDate: new Date(`${older}T00:00:00.000Z`) },
    ]);

    const stats = await service.getStatistics('user-1');
    expect(stats.currentStreakDays).toBe(2);
    expect(stats.longestStreakDays).toBeGreaterThanOrEqual(2);
    expect(stats.today.versesRead).toBe(2);
  });

  it('rejects inverted daily date ranges', async () => {
    await expect(
      service.getDaily('user-1', '2026-07-30', '2026-07-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns streak summary for the authenticated user', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-30T12:00:00.000Z'));
    repository.findActiveDayDates.mockResolvedValue([
      { localDate: new Date('2026-07-30T00:00:00.000Z') },
      { localDate: new Date('2026-07-29T00:00:00.000Z') },
    ]);

    const streak = await service.getStreak('user-1');
    expect(streak).toMatchObject({
      currentStreakDays: 2,
      todayActive: true,
      timezone: 'Asia/Tashkent',
    });
    jest.useRealTimers();
  });

  it('returns zeroed today reading day when none exists', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-30T12:00:00.000Z'));
    repository.findDay.mockResolvedValue(null);

    const day = await service.getTodayDay('user-1');
    expect(day).toMatchObject({
      versesRead: 0,
      activeSeconds: 0,
      sessionsCount: 0,
      timezone: 'Asia/Tashkent',
    });
    jest.useRealTimers();
  });
});
