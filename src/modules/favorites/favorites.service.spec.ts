import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
import { FavoritesRepository } from './favorites.repository';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let repository: jest.Mocked<
    Pick<
      FavoritesRepository,
      'create' | 'findOwned' | 'updateOwned' | 'deleteOwned' | 'list'
    >
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'getActiveByIdOrThrow'>>;
  let analyticsTracking: jest.Mocked<Pick<AnalyticsTrackingService, 'track'>>;

  const favorite = {
    id: 'fav-1',
    userId: 'user-1',
    chapterNumber: 2,
    verseNumber: 255,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findOwned: jest.fn(),
      updateOwned: jest.fn(),
      deleteOwned: jest.fn(),
      list: jest.fn(),
    };
    usersService = {
      getActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    analyticsTracking = {
      track: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: FavoritesRepository, useValue: repository },
        { provide: UsersService, useValue: usersService },
        { provide: AnalyticsTrackingService, useValue: analyticsTracking },
      ],
    }).compile();

    service = module.get(FavoritesService);
  });

  it('creates a favorite', async () => {
    repository.create.mockResolvedValue(favorite);

    await expect(
      service.create('user-1', { chapterNumber: 2, verseNumber: 255 }),
    ).resolves.toMatchObject({
      id: 'fav-1',
      verseKey: '2:255',
    });
  });

  it('rejects invalid coordinates', async () => {
    await expect(
      service.create('user-1', { chapterNumber: 1, verseNumber: 8 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps unique conflicts to ConflictException', async () => {
    repository.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create('user-1', { chapterNumber: 2, verseNumber: 255 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 404 for missing owned favorite', async () => {
    repository.findOwned.mockResolvedValue(null);

    await expect(service.getById('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('hard-deletes an owned favorite', async () => {
    repository.deleteOwned.mockResolvedValue(true);

    await expect(service.remove('user-1', 'fav-1')).resolves.toEqual({
      deleted: true,
    });
  });

  it('paginates favorites', async () => {
    repository.list.mockResolvedValue([favorite]);

    await expect(service.list('user-1', { limit: 20 })).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'fav-1',
          verseKey: '2:255',
        }),
      ],
      nextCursor: null,
    });
  });
});
