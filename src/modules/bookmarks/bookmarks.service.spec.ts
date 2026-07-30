import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma';
import { UsersService } from '../users/users.service';
import { BookmarksRepository } from './bookmarks.repository';
import { BookmarksService } from './bookmarks.service';

describe('BookmarksService', () => {
  let service: BookmarksService;
  let repository: jest.Mocked<
    Pick<
      BookmarksRepository,
      | 'create'
      | 'findOwnedActive'
      | 'updateOwnedActive'
      | 'softDeleteOwned'
      | 'listActive'
    >
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'getActiveByIdOrThrow'>>;

  const bookmark = {
    id: 'bm-1',
    userId: 'user-1',
    chapterNumber: 2,
    verseNumber: 255,
    wordNumber: 1,
    audioOffsetMs: 100,
    label: 'Kursi',
    note: 'Remember',
    color: '#2F6B4F',
    deletedAt: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findOwnedActive: jest.fn(),
      updateOwnedActive: jest.fn(),
      softDeleteOwned: jest.fn(),
      listActive: jest.fn(),
    };
    usersService = {
      getActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookmarksService,
        { provide: BookmarksRepository, useValue: repository },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(BookmarksService);
  });

  it('creates a bookmark with notes', async () => {
    repository.create.mockResolvedValue(bookmark);

    await expect(
      service.create('user-1', {
        chapterNumber: 2,
        verseNumber: 255,
        note: 'Remember',
        label: 'Kursi',
        color: '#2F6B4F',
        wordNumber: 1,
        audioOffsetMs: 100,
      }),
    ).resolves.toMatchObject({
      verseKey: '2:255',
      note: 'Remember',
      label: 'Kursi',
    });
  });

  it('clears nullable metadata fields', async () => {
    repository.findOwnedActive.mockResolvedValue(bookmark);
    repository.updateOwnedActive.mockResolvedValue({
      ...bookmark,
      note: null,
      label: null,
      color: null,
      wordNumber: null,
      audioOffsetMs: null,
    });

    await expect(
      service.update('user-1', 'bm-1', {
        note: null,
        label: null,
        color: null,
        wordNumber: null,
        audioOffsetMs: null,
      }),
    ).resolves.toMatchObject({
      note: null,
      label: null,
      color: null,
      wordNumber: null,
      audioOffsetMs: null,
    });
  });

  it('maps active duplicate conflicts', async () => {
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

  it('soft-deletes an owned active bookmark', async () => {
    repository.softDeleteOwned.mockResolvedValue(true);

    await expect(service.remove('user-1', 'bm-1')).resolves.toEqual({
      deleted: true,
    });
  });

  it('returns 404 for missing active bookmarks', async () => {
    repository.findOwnedActive.mockResolvedValue(null);

    await expect(service.getById('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects inverted date filters', async () => {
    await expect(
      service.list('user-1', {
        from: '2026-07-30',
        to: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
