import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SessionsRepository } from './sessions.repository';

describe('SessionsRepository', () => {
  let repository: SessionsRepository;
  let prisma: {
    userSession: {
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      userSession: {
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(SessionsRepository);
  });

  it('rotateIfHashMatches updates only when hash and session match', async () => {
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.userSession.findUnique.mockResolvedValue({
      id: 'session-1',
      refreshTokenHash: 'new-hash',
    });

    const rotated = await repository.rotateIfHashMatches({
      sessionId: 'session-1',
      expectedRefreshTokenHash: 'old-hash',
      refreshTokenHash: 'new-hash',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(prisma.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'session-1',
          refreshTokenHash: 'old-hash',
          revokedAt: null,
        },
        data: expect.objectContaining({
          refreshTokenHash: 'new-hash',
        }) as Record<string, unknown>,
      }),
    );
    expect(rotated?.id).toBe('session-1');
  });

  it('rotateIfHashMatches returns null when another rotate already won', async () => {
    prisma.userSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.rotateIfHashMatches({
        sessionId: 'session-1',
        expectedRefreshTokenHash: 'old-hash',
        refreshTokenHash: 'new-hash',
        expiresAt: new Date(),
      }),
    ).resolves.toBeNull();
  });
});
