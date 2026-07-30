import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../generated/prisma';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<
    Pick<UsersRepository, 'upsertFromTelegram' | 'findActiveById'>
  >;

  const user: User = {
    id: 'user-1',
    telegramId: '42',
    username: 'ali',
    firstName: 'Ali',
    lastName: 'Valiyev',
    languageCode: 'uz',
    photoUrl: null,
    isPremium: false,
    allowsWriteToPm: false,
    isActive: true,
    lastLoginAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    repository = {
      upsertFromTelegram: jest.fn(),
      findActiveById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('upserts a Telegram user', async () => {
    repository.upsertFromTelegram.mockResolvedValue(user);

    await expect(
      service.upsertFromTelegram({
        telegramId: '42',
        firstName: 'Ali',
        isPremium: false,
        allowsWriteToPm: false,
      }),
    ).resolves.toEqual(user);
  });

  it('maps a safe user response', () => {
    expect(service.toResponse(user)).toEqual({
      id: 'user-1',
      telegramId: '42',
      username: 'ali',
      firstName: 'Ali',
      lastName: 'Valiyev',
      languageCode: 'uz',
      photoUrl: null,
      isPremium: false,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    });
  });

  it('throws when the user is missing or inactive', async () => {
    repository.findActiveById.mockResolvedValue(null);

    await expect(
      service.getActiveByIdOrThrow('missing'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
