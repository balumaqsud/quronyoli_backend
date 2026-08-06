import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CONFIG_KEYS } from '../../common/constants';
import { PrismaService } from '../database/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: {
    user: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === CONFIG_KEYS.JWT) {
                return {
                  accessSecret: 'test-secret-at-least-32-chars-long!!',
                  accessExpiresIn: '15m',
                  refreshSecret: 'test-refresh-secret-at-least-32-chars',
                  refreshExpiresIn: '7d',
                };
              }
              throw new Error(`Unexpected key ${key}`);
            },
          },
        },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('rejects banned users even with a valid access payload', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      isBanned: true,
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        sid: 'session-1',
        typ: 'access',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts active non-banned users', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      isBanned: false,
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        sid: 'session-1',
        typ: 'access',
        role: 'ADMIN',
      }),
    ).resolves.toEqual({
      sub: 'user-1',
      sid: 'session-1',
      typ: 'access',
      role: 'ADMIN',
    });
  });
});
