import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  const baseUser: User = {
    id: 'user-1',
    telegramId: '42',
    username: 'ali',
    firstName: 'Ali',
    lastName: null,
    languageCode: 'uz',
    photoUrl: null,
    isPremium: false,
    allowsWriteToPm: true,
    isActive: true,
    isBanned: false,
    lastLoginAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(UsersRepository);
  });

  it('creates with allowsWriteToPm true when provided (bot /start shape)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({
      ...baseUser,
      allowsWriteToPm: true,
    });

    await repository.upsertFromTelegram({
      telegramId: '42',
      firstName: 'Ali',
      isPremium: false,
      allowsWriteToPm: true,
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ allowsWriteToPm: true }) as Record<
          string,
          unknown
        >,
        update: expect.objectContaining({ allowsWriteToPm: true }) as Record<
          string,
          unknown
        >,
      }),
    );
  });

  it('preserves existing true when allowsWriteToPm is omitted on login', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      allowsWriteToPm: true,
    });
    prisma.user.upsert.mockResolvedValue(baseUser);

    await repository.upsertFromTelegram({
      telegramId: '42',
      firstName: 'Ali',
      isPremium: false,
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ allowsWriteToPm: false }) as Record<
          string,
          unknown
        >,
        update: expect.objectContaining({ allowsWriteToPm: true }) as Record<
          string,
          unknown
        >,
      }),
    );
  });

  it('clears allowsWriteToPm when Telegram sends explicit false', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      allowsWriteToPm: true,
    });
    prisma.user.upsert.mockResolvedValue({
      ...baseUser,
      allowsWriteToPm: false,
    });

    await repository.upsertFromTelegram({
      telegramId: '42',
      firstName: 'Ali',
      isPremium: false,
      allowsWriteToPm: false,
    });

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ allowsWriteToPm: false }) as Record<
          string,
          unknown
        >,
      }),
    );
  });
});
