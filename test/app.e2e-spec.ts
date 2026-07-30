import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TokenService } from '../src/infrastructure/auth/token.service';
import { RedisService } from '../src/infrastructure/cache/redis.service';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { SessionsRepository } from '../src/modules/auth/sessions.repository';
import { TelegramInitDataVerifier } from '../src/modules/auth/telegram/telegram-init-data.verifier';
import { BookmarksRepository } from '../src/modules/bookmarks/bookmarks.repository';
import { FavoritesRepository } from '../src/modules/favorites/favorites.repository';
import { GoalsRepository } from '../src/modules/goals/goals.repository';
import { QuranFoundationClient } from '../src/modules/quran/client/quran-foundation.client';
import { ReadingRepository } from '../src/modules/reading/reading.repository';
import { SettingsRepository } from '../src/modules/settings/settings.repository';
import { UsersRepository } from '../src/modules/users/users.repository';
import { DailyGoalMetric } from '../src/generated/prisma';

describe('Auth & Users (e2e)', () => {
  let app: INestApplication<App>;
  let tokenService: TokenService;

  const userId = randomUUID();
  const sessionId = randomUUID();
  let storedRefreshHash = '';

  const user = {
    id: userId,
    telegramId: '42',
    username: 'ali',
    firstName: 'Ali',
    lastName: 'Valiyev',
    languageCode: 'uz',
    photoUrl: null,
    isPremium: false,
    allowsWriteToPm: false,
    isActive: true,
    lastLoginAt: new Date(),
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    isHealthy: jest.fn().mockResolvedValue(true),
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  };

  const redisService = {
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    isHealthy: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    buildKey: jest.fn((key: string) => key),
    getClient: jest.fn().mockReturnValue({
      eval: jest.fn().mockResolvedValue([1, 60]),
    }),
  };

  const usersRepository = {
    upsertFromTelegram: jest.fn().mockResolvedValue(user),
    findActiveById: jest.fn().mockResolvedValue(user),
    findById: jest.fn().mockResolvedValue(user),
    findByTelegramId: jest.fn().mockResolvedValue(user),
  };

  const sessionsRepository = {
    create: jest
      .fn()
      .mockImplementation(
        (input: {
          id: string;
          userId: string;
          refreshTokenHash: string;
          expiresAt: Date;
        }) => {
          storedRefreshHash = input.refreshTokenHash;
          return Promise.resolve({
            id: input.id,
            userId: input.userId,
            refreshTokenHash: input.refreshTokenHash,
            expiresAt: input.expiresAt,
            revokedAt: null,
            ipAddress: null,
            userAgent: null,
            lastUsedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        },
      ),
    findById: jest.fn().mockImplementation((id: string) => {
      if (!storedRefreshHash) {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        id,
        userId,
        refreshTokenHash: storedRefreshHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        ipAddress: null,
        userAgent: null,
        lastUsedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }),
    rotate: jest
      .fn()
      .mockImplementation(
        (input: { sessionId: string; refreshTokenHash: string }) => {
          storedRefreshHash = input.refreshTokenHash;
          return Promise.resolve({
            id: input.sessionId,
            userId,
            refreshTokenHash: input.refreshTokenHash,
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
            ipAddress: null,
            userAgent: null,
            lastUsedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        },
      ),
    revoke: jest.fn().mockResolvedValue(null),
  };

  const telegramVerifier = {
    verify: jest.fn().mockReturnValue({
      user: {
        id: 42,
        first_name: 'Ali',
        last_name: 'Valiyev',
        username: 'ali',
        language_code: 'uz',
      },
      authDate: new Date(),
    }),
  };

  const quranClient = {
    getContent: jest.fn().mockResolvedValue({ chapters: [{ id: 1 }] }),
    getSearch: jest.fn().mockResolvedValue({ result: { verses: [] } }),
  };

  const defaultSettings = {
    userId,
    locale: 'uz',
    timezone: 'Asia/Tashkent',
    theme: 'SYSTEM',
    arabicFontSize: 24,
    translationFontSize: 16,
    playbackRate: 1,
    autoPlayNext: false,
    repeatVerse: false,
    defaultTranslationId: null,
    defaultTafsirId: null,
    defaultReciterId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    defaultTranslation: null,
    defaultTafsir: null,
    defaultReciter: null,
  };

  let storedSettings = { ...defaultSettings };

  const settingsRepository = {
    findByUserId: jest
      .fn()
      .mockImplementation(() => Promise.resolve(storedSettings)),
    upsertDefaults: jest
      .fn()
      .mockImplementation(() => Promise.resolve(storedSettings)),
    upsertWithUpdate: jest
      .fn()
      .mockImplementation((_userId: string, data: Record<string, unknown>) => {
        storedSettings = {
          ...storedSettings,
          ...data,
          updatedAt: new Date(),
        };
        return Promise.resolve(storedSettings);
      }),
    findActiveTranslationByExternalId: jest.fn().mockResolvedValue(null),
    findActiveTafsirByExternalId: jest.fn().mockResolvedValue(null),
    findActiveReciterByExternalId: jest.fn().mockResolvedValue(null),
  };

  const readingProgress = {
    userId,
    chapterNumber: 1,
    verseNumber: 1,
    wordNumber: null,
    lastTranslationId: null,
    lastTafsirId: null,
    lastReciterId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const readingRepository = {
    getTimezone: jest.fn().mockResolvedValue('Asia/Tashkent'),
    recordAyahOpen: jest.fn().mockResolvedValue(undefined),
    findProgress: jest.fn().mockResolvedValue(readingProgress),
    findRecent: jest.fn().mockResolvedValue([
      {
        id: 'recent-1',
        userId,
        chapterNumber: 1,
        verseNumber: 1,
        firstReadAt: new Date('2026-07-01T00:00:00.000Z'),
        lastReadAt: new Date('2026-07-30T00:00:00.000Z'),
        readCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    findHistory: jest.fn().mockResolvedValue([
      {
        id: 'hist-1',
        userId,
        chapterNumber: 1,
        verseNumber: 1,
        openedAt: new Date('2026-07-30T00:00:00.000Z'),
        createdAt: new Date(),
      },
    ]),
    countUniqueAyahs: jest.fn().mockResolvedValue(1),
    sumReadCounts: jest.fn().mockResolvedValue(2),
    findDaysInRange: jest.fn().mockResolvedValue([]),
    findAllActiveDays: jest.fn().mockResolvedValue([]),
    countActiveDays: jest.fn().mockResolvedValue(0),
    findDay: jest.fn().mockResolvedValue(null),
  };

  const favoriteId = randomUUID();
  let favoriteStore = {
    id: favoriteId,
    userId,
    chapterNumber: 2,
    verseNumber: 255,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const favoritesRepository = {
    create: jest.fn().mockImplementation((data: typeof favoriteStore) => {
      favoriteStore = {
        ...favoriteStore,
        ...data,
        id: favoriteId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return Promise.resolve(favoriteStore);
    }),
    findOwned: jest.fn().mockImplementation((id: string, ownerId: string) => {
      if (id === favoriteStore.id && ownerId === favoriteStore.userId) {
        return Promise.resolve(favoriteStore);
      }
      return Promise.resolve(null);
    }),
    updateOwned: jest
      .fn()
      .mockImplementation(
        (
          id: string,
          ownerId: string,
          data: { chapterNumber: number; verseNumber: number },
        ) => {
          if (id !== favoriteStore.id || ownerId !== favoriteStore.userId) {
            return Promise.resolve(null);
          }
          favoriteStore = {
            ...favoriteStore,
            ...data,
            updatedAt: new Date(),
          };
          return Promise.resolve(favoriteStore);
        },
      ),
    deleteOwned: jest.fn().mockResolvedValue(true),
    list: jest.fn().mockImplementation(() => Promise.resolve([favoriteStore])),
  };

  const bookmarkId = randomUUID();
  let bookmarkStore: {
    id: string;
    userId: string;
    chapterNumber: number;
    verseNumber: number;
    wordNumber: number | null;
    audioOffsetMs: number | null;
    label: string | null;
    note: string | null;
    color: string | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } = {
    id: bookmarkId,
    userId,
    chapterNumber: 2,
    verseNumber: 255,
    wordNumber: null,
    audioOffsetMs: null,
    label: 'Kursi',
    note: 'Remember',
    color: '#2F6B4F',
    deletedAt: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const bookmarksRepository = {
    create: jest.fn().mockImplementation((data: typeof bookmarkStore) => {
      bookmarkStore = {
        ...bookmarkStore,
        ...data,
        id: bookmarkId,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return Promise.resolve(bookmarkStore);
    }),
    findOwnedActive: jest
      .fn()
      .mockImplementation((id: string, ownerId: string) => {
        if (
          id === bookmarkStore.id &&
          ownerId === bookmarkStore.userId &&
          bookmarkStore.deletedAt === null
        ) {
          return Promise.resolve(bookmarkStore);
        }
        return Promise.resolve(null);
      }),
    updateOwnedActive: jest
      .fn()
      .mockImplementation(
        (id: string, ownerId: string, data: Record<string, unknown>) => {
          if (
            id !== bookmarkStore.id ||
            ownerId !== bookmarkStore.userId ||
            bookmarkStore.deletedAt !== null
          ) {
            return Promise.resolve(null);
          }
          bookmarkStore = {
            ...bookmarkStore,
            ...data,
            updatedAt: new Date(),
          };
          return Promise.resolve(bookmarkStore);
        },
      ),
    softDeleteOwned: jest
      .fn()
      .mockImplementation((id: string, ownerId: string) => {
        if (
          id !== bookmarkStore.id ||
          ownerId !== bookmarkStore.userId ||
          bookmarkStore.deletedAt !== null
        ) {
          return Promise.resolve(false);
        }
        bookmarkStore = {
          ...bookmarkStore,
          deletedAt: new Date(),
          updatedAt: new Date(),
        };
        return Promise.resolve(true);
      }),
    listActive: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          bookmarkStore.deletedAt === null ? [bookmarkStore] : [],
        ),
      ),
  };

  const goalId = randomUUID();
  let goalStore: {
    id: string;
    userId: string;
    metric: DailyGoalMetric;
    targetValue: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    isEnabled: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } = {
    id: goalId,
    userId,
    metric: DailyGoalMetric.VERSES,
    targetValue: 10,
    effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
    effectiveTo: null,
    isEnabled: true,
    deletedAt: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const goalsRepository = {
    getTimezone: jest.fn().mockResolvedValue('Asia/Tashkent'),
    list: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(goalStore.deletedAt === null ? [goalStore] : []),
      ),
    findOwnedActive: jest
      .fn()
      .mockImplementation((id: string, ownerId: string) => {
        if (
          id === goalStore.id &&
          ownerId === goalStore.userId &&
          goalStore.deletedAt === null
        ) {
          return Promise.resolve(goalStore);
        }
        return Promise.resolve(null);
      }),
    createClosingOpenEnded: jest
      .fn()
      .mockImplementation(
        (input: {
          userId: string;
          metric: DailyGoalMetric;
          targetValue: number;
          effectiveFrom: Date;
        }) => {
          goalStore = {
            ...goalStore,
            ...input,
            id: goalId,
            effectiveTo: null,
            isEnabled: true,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          return Promise.resolve(goalStore);
        },
      ),
    updateOwned: jest
      .fn()
      .mockImplementation(
        (id: string, ownerId: string, data: Record<string, unknown>) => {
          if (
            id !== goalStore.id ||
            ownerId !== goalStore.userId ||
            goalStore.deletedAt !== null
          ) {
            return Promise.resolve(null);
          }
          goalStore = {
            ...goalStore,
            ...data,
            updatedAt: new Date(),
          };
          return Promise.resolve(goalStore);
        },
      ),
    softDeleteOwned: jest
      .fn()
      .mockImplementation((id: string, ownerId: string) => {
        if (
          id !== goalStore.id ||
          ownerId !== goalStore.userId ||
          goalStore.deletedAt !== null
        ) {
          return Promise.resolve(false);
        }
        goalStore = {
          ...goalStore,
          deletedAt: new Date(),
          isEnabled: false,
          updatedAt: new Date(),
        };
        return Promise.resolve(true);
      }),
    findActiveGoalsForDate: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          goalStore.deletedAt === null && goalStore.isEnabled
            ? [goalStore]
            : [],
        ),
      ),
    findReadingDay: jest.fn().mockResolvedValue({
      userId,
      localDate: new Date('2026-07-30T00:00:00.000Z'),
      timezone: 'Asia/Tashkent',
      versesRead: 4,
      activeSeconds: 0,
      sessionsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findGoalResult: jest.fn().mockResolvedValue(null),
    upsertGoalResult: jest
      .fn()
      .mockImplementation(
        (input: {
          dailyGoalId: string;
          localDate: Date;
          actualValue: number;
          completedAt: Date | null;
        }) =>
          Promise.resolve({
            id: 'result-1',
            dailyGoalId: input.dailyGoalId,
            localDate: input.localDate,
            actualValue: input.actualValue,
            completedAt: input.completedAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
      ),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .overrideProvider(RedisService)
      .useValue(redisService)
      .overrideProvider(UsersRepository)
      .useValue(usersRepository)
      .overrideProvider(SessionsRepository)
      .useValue(sessionsRepository)
      .overrideProvider(TelegramInitDataVerifier)
      .useValue(telegramVerifier)
      .overrideProvider(QuranFoundationClient)
      .useValue(quranClient)
      .overrideProvider(SettingsRepository)
      .useValue(settingsRepository)
      .overrideProvider(ReadingRepository)
      .useValue(readingRepository)
      .overrideProvider(FavoritesRepository)
      .useValue(favoritesRepository)
      .overrideProvider(BookmarksRepository)
      .useValue(bookmarksRepository)
      .overrideProvider(GoalsRepository)
      .useValue(goalsRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    tokenService = app.get(TokenService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with Telegram initData and sets a refresh cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/telegram')
      .send({ initData: 'query_id=AA&user=%7B%7D&auth_date=1&hash=abc' })
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { accessToken: string; user: { id: string; telegramId: string } };
    };

    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.user).toMatchObject({
      id: userId,
      telegramId: '42',
    });
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refresh_token=')]),
    );
  });

  it('rejects invalid Telegram auth payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/telegram')
      .send({})
      .expect(400);
  });

  it('returns the authenticated user profile', async () => {
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { id: string; telegramId: string };
    };

    expect(body).toMatchObject({
      success: true,
      data: {
        id: userId,
        telegramId: '42',
      },
    });
  });

  it('rotates the refresh token cookie', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/telegram')
      .send({ initData: 'valid' })
      .expect(200);

    const setCookieHeader = loginResponse.headers['set-cookie'];
    const cookies: string[] = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : typeof setCookieHeader === 'string'
        ? [setCookieHeader]
        : [];
    const refreshCookie = cookies.find((cookie: string) =>
      cookie.startsWith('refresh_token='),
    );

    expect(refreshCookie).toBeDefined();

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie as string)
      .expect(200);

    const body = refreshResponse.body as {
      success: boolean;
      data: { accessToken: string };
    };

    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(sessionsRepository.rotate).toHaveBeenCalled();
  });

  it('logs out and clears the refresh cookie', async () => {
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { success: boolean };
    };

    expect(body).toMatchObject({
      success: true,
      data: { success: true },
    });
    expect(sessionsRepository.revoke).toHaveBeenCalledWith(sessionId);
  });

  it('proxies protected Quran surah list through Quran.Foundation client', async () => {
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/quran/surahs')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { chapters: Array<{ id: number }> };
    };

    expect(body.success).toBe(true);
    expect(body.data.chapters[0]?.id).toBe(1);
    expect(quranClient.getContent).toHaveBeenCalled();
  });

  it('returns default settings for the authenticated user', async () => {
    storedSettings = { ...defaultSettings };
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { locale: string; theme: string; arabicFontSize: number };
    };

    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      locale: 'uz',
      theme: 'SYSTEM',
      arabicFontSize: 24,
    });
  });

  it('partially updates settings for the authenticated user', async () => {
    storedSettings = { ...defaultSettings };
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    const response = await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        theme: 'DARK',
        arabicFontSize: 28,
        autoPlayNext: true,
      })
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: {
        theme: string;
        arabicFontSize: number;
        autoPlayNext: boolean;
        locale: string;
      };
    };

    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      theme: 'DARK',
      arabicFontSize: 28,
      autoPlayNext: true,
      locale: 'uz',
    });
  });

  it('rejects invalid settings payloads', async () => {
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    await request(app.getHttpServer())
      .patch('/api/v1/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ arabicFontSize: 3 })
      .expect(400);
  });

  it('records reading when opening a single ayah by key', async () => {
    quranClient.getContent.mockResolvedValueOnce({
      verse: { verse_key: '1:1' },
    });
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    await request(app.getHttpServer())
      .get('/api/v1/quran/ayahs/by-key/1:1')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(readingRepository.recordAyahOpen).toHaveBeenCalledWith({
      userId,
      chapterNumber: 1,
      verseNumber: 1,
    });
  });

  it('returns continue reading for the authenticated user', async () => {
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/reading/continue')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      success: boolean;
      data: { verseKey: string };
    };

    expect(body.success).toBe(true);
    expect(body.data.verseKey).toBe('1:1');
  });

  it('returns recent and history reading lists', async () => {
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    const recent = await request(app.getHttpServer())
      .get('/api/v1/reading/recent')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const history = await request(app.getHttpServer())
      .get('/api/v1/reading/history')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(recent.body).toMatchObject({
      success: true,
      data: { items: [{ verseKey: '1:1' }] },
    });
    expect(history.body).toMatchObject({
      success: true,
      data: { items: [{ verseKey: '1:1' }] },
    });
  });

  it('rejects inverted daily reading ranges', async () => {
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    await request(app.getHttpServer())
      .get('/api/v1/reading/daily')
      .query({ from: '2026-07-30', to: '2026-07-01' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
  });

  it('creates, lists, updates, and deletes favorites', async () => {
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    const created = await request(app.getHttpServer())
      .post('/api/v1/favorites')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ chapterNumber: 2, verseNumber: 255 })
      .expect(201);

    expect(created.body).toMatchObject({
      success: true,
      data: { verseKey: '2:255' },
    });

    const listed = await request(app.getHttpServer())
      .get('/api/v1/favorites')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listed.body).toMatchObject({
      success: true,
      data: { items: [{ verseKey: '2:255' }] },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/favorites/${favoriteId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ chapterNumber: 1, verseNumber: 1 })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/favorites/${favoriteId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('rejects invalid favorite coordinates', async () => {
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    await request(app.getHttpServer())
      .post('/api/v1/favorites')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ chapterNumber: 1, verseNumber: 8 })
      .expect(400);
  });

  it('creates, updates, lists, and soft-deletes bookmarks', async () => {
    bookmarkStore.deletedAt = null;
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    const created = await request(app.getHttpServer())
      .post('/api/v1/bookmarks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        chapterNumber: 2,
        verseNumber: 255,
        note: 'Remember',
        label: 'Kursi',
        color: '#2F6B4F',
      })
      .expect(201);

    expect(created.body).toMatchObject({
      success: true,
      data: { verseKey: '2:255', note: 'Remember' },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/bookmarks/${bookmarkId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ note: null, label: 'Updated' })
      .expect(200);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/bookmarks')
      .query({ chapterNumber: 2 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listed.body).toMatchObject({
      success: true,
      data: { items: [{ verseKey: '2:255' }] },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/bookmarks/${bookmarkId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get('/api/v1/bookmarks')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(afterDelete.body).toMatchObject({
      success: true,
      data: { items: [] },
    });
  });

  it('returns daily ayah without recording a reading open', async () => {
    quranClient.getContent.mockResolvedValueOnce({
      verse: { verse_key: '1:1' },
    });
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    readingRepository.recordAyahOpen.mockClear();

    const response = await request(app.getHttpServer())
      .get('/api/v1/quran/ayahs/daily')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        timezone: 'Asia/Tashkent',
        verseKey: expect.stringMatching(/^\d{1,3}:\d{1,3}$/) as string,
        content: { verse: { verse_key: '1:1' } },
      },
    });
    expect(readingRepository.recordAyahOpen).not.toHaveBeenCalled();
  });

  it('creates, lists, updates progress, and soft-deletes goals', async () => {
    goalStore.deletedAt = null;
    goalStore.isEnabled = true;
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    const created = await request(app.getHttpServer())
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ metric: 'VERSES', targetValue: 10 })
      .expect(201);

    expect(created.body).toMatchObject({
      success: true,
      data: { metric: 'VERSES', targetValue: 10 },
    });

    const listed = await request(app.getHttpServer())
      .get('/api/v1/goals')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(listed.body).toMatchObject({
      success: true,
      data: { items: [{ id: goalId }] },
    });

    const progress = await request(app.getHttpServer())
      .get('/api/v1/goals/progress')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(progress.body).toMatchObject({
      success: true,
      data: {
        versesRead: 4,
        goals: [{ goalId, actualValue: 4, percent: 40, completed: false }],
      },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/goals/${goalId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ targetValue: 5 })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/goals/${goalId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('rejects invalid goal payloads', async () => {
    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    await request(app.getHttpServer())
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ metric: 'VERSES', targetValue: 0 })
      .expect(400);
  });

  it('requires JWT for streak and today reading-day endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/reading/streak')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/reading/days/today')
      .expect(401);

    const accessToken = await tokenService.generateAccessToken(
      userId,
      sessionId,
    );

    const streak = await request(app.getHttpServer())
      .get('/api/v1/reading/streak')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(streak.body).toMatchObject({
      success: true,
      data: {
        currentStreakDays: expect.any(Number) as number,
        longestStreakDays: expect.any(Number) as number,
        todayActive: expect.any(Boolean) as boolean,
        timezone: 'Asia/Tashkent',
      },
    });

    const today = await request(app.getHttpServer())
      .get('/api/v1/reading/days/today')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(today.body).toMatchObject({
      success: true,
      data: {
        versesRead: 0,
        activeSeconds: 0,
        sessionsCount: 0,
      },
    });
  });
});

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  const prismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    isHealthy: jest.fn().mockResolvedValue(true),
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  };

  const redisService = {
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    isHealthy: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    buildKey: jest.fn((key: string) => key),
    getClient: jest.fn().mockReturnValue({
      eval: jest.fn().mockResolvedValue([1, 60]),
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .overrideProvider(RedisService)
      .useValue(redisService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health remains public', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });
});
