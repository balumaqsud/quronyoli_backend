import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { RedisService } from '../src/infrastructure/cache/redis.service';

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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health is public and returns a success envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    const body = response.body as {
      success: boolean;
      timestamp?: string;
      path?: string;
      data: {
        status: string;
        info: {
          application: { status: string };
          database: { status: string };
          redis: { status: string };
        };
      };
    };

    expect(body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        info: {
          application: { status: 'up' },
          database: { status: 'up' },
          redis: { status: 'up' },
        },
      },
    });
    expect(body.timestamp).toBeDefined();
    expect(body.path).toContain('/api/v1/health');
  });

  it('GET /api/v1/health returns 503 when dependencies are down', async () => {
    prismaService.isHealthy.mockResolvedValueOnce(false);

    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(503);

    const body = response.body as {
      success: boolean;
      data: {
        status: string;
        details: {
          database: { status: string };
        };
      };
    };

    expect(body).toMatchObject({
      success: false,
      data: {
        status: 'error',
        details: {
          database: { status: 'down' },
        },
      },
    });
  });
});
