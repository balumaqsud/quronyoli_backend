import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Favorite } from '../../generated/prisma';
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
} from '../../common/pagination/keyset-cursor';
import { assertAyahCoordinateOrThrow } from '../../common/quran/ayah-coordinate';
import { toVerseKey } from '../../common/quran/quran-coordinates';
import { throwIfUniqueConflict } from '../../common/database/prisma-errors';
import { UsersService } from '../users/users.service';
import {
  CreateFavoriteDto,
  ListFavoritesQueryDto,
  UpdateFavoriteDto,
} from './dto/favorite.dto';
import {
  FavoriteResponseDto,
  PaginatedFavoritesResponseDto,
} from './dto/favorite-response.dto';
import { FavoritesRepository } from './favorites.repository';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly favoritesRepository: FavoritesRepository,
    private readonly usersService: UsersService,
  ) {}

  async create(
    userId: string,
    dto: CreateFavoriteDto,
  ): Promise<FavoriteResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const coordinate = assertAyahCoordinateOrThrow(
      dto.chapterNumber,
      dto.verseNumber,
    );

    try {
      const favorite = await this.favoritesRepository.create({
        userId,
        chapterNumber: coordinate.chapterNumber,
        verseNumber: coordinate.verseNumber,
      });
      return this.toResponse(favorite);
    } catch (error) {
      throwIfUniqueConflict(
        error,
        `Favorite already exists for ${coordinate.verseKey}`,
      );
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateFavoriteDto,
  ): Promise<FavoriteResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const existing = await this.favoritesRepository.findOwned(id, userId);
    if (!existing) {
      throw new NotFoundException('Favorite not found');
    }

    if (dto.chapterNumber === undefined && dto.verseNumber === undefined) {
      throw new BadRequestException('No fields provided to update');
    }

    const chapterNumber = dto.chapterNumber ?? existing.chapterNumber;
    const verseNumber = dto.verseNumber ?? existing.verseNumber;
    const coordinate = assertAyahCoordinateOrThrow(chapterNumber, verseNumber);

    try {
      const updated = await this.favoritesRepository.updateOwned(id, userId, {
        chapterNumber: coordinate.chapterNumber,
        verseNumber: coordinate.verseNumber,
      });
      if (!updated) {
        throw new NotFoundException('Favorite not found');
      }
      return this.toResponse(updated);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throwIfUniqueConflict(
        error,
        `Favorite already exists for ${coordinate.verseKey}`,
      );
    }
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const deleted = await this.favoritesRepository.deleteOwned(id, userId);
    if (!deleted) {
      throw new NotFoundException('Favorite not found');
    }
    return { deleted: true };
  }

  async getById(userId: string, id: string): Promise<FavoriteResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const favorite = await this.favoritesRepository.findOwned(id, userId);
    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }
    return this.toResponse(favorite);
  }

  async list(
    userId: string,
    query: ListFavoritesQueryDto,
  ): Promise<PaginatedFavoritesResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);

    if (query.verseNumber !== undefined && query.chapterNumber === undefined) {
      throw new BadRequestException(
        'chapterNumber is required when filtering by verseNumber',
      );
    }

    if (query.chapterNumber !== undefined && query.verseNumber !== undefined) {
      assertAyahCoordinateOrThrow(query.chapterNumber, query.verseNumber);
    }

    const limit = query.limit ?? 20;
    const decoded = query.cursor ? decodeKeysetCursor(query.cursor) : undefined;
    const rows = await this.favoritesRepository.list({
      userId,
      limit: limit + 1,
      cursorAt: decoded ? new Date(decoded.at) : undefined,
      cursorId: decoded?.id,
      chapterNumber: query.chapterNumber,
      verseNumber: query.verseNumber,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      items: page.map((row) => this.toResponse(row)),
      nextCursor:
        hasMore && last
          ? encodeKeysetCursor({
              at: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  toResponse(favorite: Favorite): FavoriteResponseDto {
    return {
      id: favorite.id,
      chapterNumber: favorite.chapterNumber,
      verseNumber: favorite.verseNumber,
      verseKey: toVerseKey(favorite.chapterNumber, favorite.verseNumber),
      createdAt: favorite.createdAt,
      updatedAt: favorite.updatedAt,
    };
  }
}
