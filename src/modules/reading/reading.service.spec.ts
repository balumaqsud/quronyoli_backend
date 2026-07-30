import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
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
      | 'findAllActiveDays'
      | 'countActiveDays'
      | 'getTimezone'
    >
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'getActiveByIdOrThrow'>>;

  beforeEach(async () => {
    repository = {
      recordAyahOpen: jest.fn().mockResolvedValue(undefined),
      findProgress: jest.fn(),
      findRecent: jest.fn(),
      findHistory: jest.fn(),
      countUniqueAyahs: jest.fn(),
      sumReadCounts: jest.fn(),
      findDaysInRange: jest.fn(),
      findAllActiveDays: jest.fn(),
      countActiveDays: jest.fn(),
      getTimezone: jest.fn().mockResolvedValue('Asia/Tashkent'),
    };
    usersService = {
      getActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingService,
        { provide: ReadingRepository, useValue: repository },
        { provide: UsersService, useValue: usersService },
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
    repository.findAllActiveDays.mockResolvedValue([
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
      {
        id: 'd0',
        userId: 'user-1',
        localDate: new Date(`${yesterday}T00:00:00.000Z`),
        timezone: 'UTC',
        versesRead: 1,
        activeSeconds: 0,
        sessionsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'd-old-2',
        userId: 'user-1',
        localDate: new Date(`${olderNext}T00:00:00.000Z`),
        timezone: 'UTC',
        versesRead: 1,
        activeSeconds: 0,
        sessionsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'd-old-1',
        userId: 'user-1',
        localDate: new Date(`${older}T00:00:00.000Z`),
        timezone: 'UTC',
        versesRead: 1,
        activeSeconds: 0,
        sessionsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
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
});
