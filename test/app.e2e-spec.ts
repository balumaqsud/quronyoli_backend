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
import { UsersRepository } from '../src/modules/users/users.repository';

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
    getClient: jest.fn(),
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
    getClient: jest.fn(),
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
