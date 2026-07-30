import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Favorite } from '../../generated/prisma';
import { throwIfUniqueConflict } from '../../common/database/prisma-errors';
import {
  parseKeysetCursor,
  toKeysetPage,
} from '../../common/pagination/paginate-keyset';
import { assertAyahCoordinateOrThrow } from '../../common/quran/ayah-coordinate';
import { toVerseKey } from '../../common/quran/quran-coordinates';
import { UsersService } from '../users/users.service';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
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
    private readonly analyticsTracking: AnalyticsTrackingService,
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
      await this.analyticsTracking.track({
        userId,
        eventName: 'FAVORITE_ADDED',
        properties: {
          chapterNumber: coordinate.chapterNumber,
          verseNumber: coordinate.verseNumber,
          verseKey: coordinate.verseKey,
        },
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
    const { cursorAt, cursorId } = parseKeysetCursor(query.cursor);
    const rows = await this.favoritesRepository.list({
      userId,
      limit: limit + 1,
      cursorAt,
      cursorId,
      chapterNumber: query.chapterNumber,
      verseNumber: query.verseNumber,
    });

    return toKeysetPage(rows, {
      limit,
      getCursorAt: (row) => row.createdAt,
      getCursorId: (row) => row.id,
      mapItem: (row) => this.toResponse(row),
    });
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
