import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/cache/redis.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: jest.Mocked<Pick<PrismaService, 'isHealthy'>>;
  let redisService: jest.Mocked<Pick<RedisService, 'isHealthy'>>;

  beforeEach(async () => {
    prismaService = {
      isHealthy: jest.fn(),
    };
    redisService = {
      isHealthy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('returns ok when database and redis are healthy', async () => {
    prismaService.isHealthy.mockResolvedValue(true);
    redisService.isHealthy.mockResolvedValue(true);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      info: {
        application: { status: 'up' },
        database: { status: 'up' },
        redis: { status: 'up' },
      },
      details: {
        application: { status: 'up' },
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });

  it('returns error when a dependency is unhealthy', async () => {
    prismaService.isHealthy.mockResolvedValue(true);
    redisService.isHealthy.mockResolvedValue(false);

    await expect(service.check()).resolves.toEqual({
      status: 'error',
      info: {
        application: { status: 'up' },
        database: { status: 'up' },
        redis: { status: 'down' },
      },
      details: {
        application: { status: 'up' },
        database: { status: 'up' },
        redis: { status: 'down' },
      },
    });
  });
});
