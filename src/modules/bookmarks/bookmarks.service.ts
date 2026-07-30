import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Bookmark } from '../../generated/prisma';
import { throwIfUniqueConflict } from '../../common/database/prisma-errors';
import {
  decodeKeysetCursor,
  encodeKeysetCursor,
} from '../../common/pagination/keyset-cursor';
import { assertAyahCoordinateOrThrow } from '../../common/quran/ayah-coordinate';
import { toVerseKey } from '../../common/quran/quran-coordinates';
import { UsersService } from '../users/users.service';
import { AnalyticsTrackingService } from '../analytics/analytics-tracking.service';
import {
  CreateBookmarkDto,
  ListBookmarksQueryDto,
  UpdateBookmarkDto,
} from './dto/bookmark.dto';
import {
  BookmarkResponseDto,
  PaginatedBookmarksResponseDto,
} from './dto/bookmark-response.dto';
import {
  BookmarkUpdateData,
  BookmarksRepository,
} from './bookmarks.repository';

@Injectable()
export class BookmarksService {
  constructor(
    private readonly bookmarksRepository: BookmarksRepository,
    private readonly usersService: UsersService,
    private readonly analyticsTracking: AnalyticsTrackingService,
  ) {}

  async create(
    userId: string,
    dto: CreateBookmarkDto,
  ): Promise<BookmarkResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const coordinate = assertAyahCoordinateOrThrow(
      dto.chapterNumber,
      dto.verseNumber,
    );

    try {
      const bookmark = await this.bookmarksRepository.create({
        userId,
        chapterNumber: coordinate.chapterNumber,
        verseNumber: coordinate.verseNumber,
        wordNumber: dto.wordNumber,
        audioOffsetMs: dto.audioOffsetMs,
        label: dto.label,
        note: dto.note,
        color: dto.color,
      });
      await this.analyticsTracking.track({
        userId,
        eventName: 'BOOKMARK_ADDED',
        properties: {
          chapterNumber: coordinate.chapterNumber,
          verseNumber: coordinate.verseNumber,
          verseKey: coordinate.verseKey,
        },
      });
      return this.toResponse(bookmark);
    } catch (error) {
      throwIfUniqueConflict(
        error,
        `Active bookmark already exists for ${coordinate.verseKey}`,
      );
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateBookmarkDto,
  ): Promise<BookmarkResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const existing = await this.bookmarksRepository.findOwnedActive(id, userId);
    if (!existing) {
      throw new NotFoundException('Bookmark not found');
    }

    const data = this.buildUpdateData(dto);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields provided to update');
    }

    const chapterNumber = data.chapterNumber ?? existing.chapterNumber;
    const verseNumber = data.verseNumber ?? existing.verseNumber;
    const coordinate = assertAyahCoordinateOrThrow(chapterNumber, verseNumber);
    data.chapterNumber = coordinate.chapterNumber;
    data.verseNumber = coordinate.verseNumber;

    try {
      const updated = await this.bookmarksRepository.updateOwnedActive(
        id,
        userId,
        data,
      );
      if (!updated) {
        throw new NotFoundException('Bookmark not found');
      }
      return this.toResponse(updated);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throwIfUniqueConflict(
        error,
        `Active bookmark already exists for ${coordinate.verseKey}`,
      );
    }
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const deleted = await this.bookmarksRepository.softDeleteOwned(id, userId);
    if (!deleted) {
      throw new NotFoundException('Bookmark not found');
    }
    return { deleted: true };
  }

  async getById(userId: string, id: string): Promise<BookmarkResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);
    const bookmark = await this.bookmarksRepository.findOwnedActive(id, userId);
    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }
    return this.toResponse(bookmark);
  }

  async list(
    userId: string,
    query: ListBookmarksQueryDto,
  ): Promise<PaginatedBookmarksResponseDto> {
    await this.usersService.getActiveByIdOrThrow(userId);

    if (query.verseNumber !== undefined && query.chapterNumber === undefined) {
      throw new BadRequestException(
        'chapterNumber is required when filtering by verseNumber',
      );
    }

    if (query.chapterNumber !== undefined && query.verseNumber !== undefined) {
      assertAyahCoordinateOrThrow(query.chapterNumber, query.verseNumber);
    }

    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from must be on or before to');
    }

    const limit = query.limit ?? 20;
    const decoded = query.cursor ? decodeKeysetCursor(query.cursor) : undefined;
    const rows = await this.bookmarksRepository.listActive({
      userId,
      limit: limit + 1,
      cursorAt: decoded ? new Date(decoded.at) : undefined,
      cursorId: decoded?.id,
      chapterNumber: query.chapterNumber,
      verseNumber: query.verseNumber,
      color: query.color,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
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

  toResponse(bookmark: Bookmark): BookmarkResponseDto {
    return {
      id: bookmark.id,
      chapterNumber: bookmark.chapterNumber,
      verseNumber: bookmark.verseNumber,
      verseKey: toVerseKey(bookmark.chapterNumber, bookmark.verseNumber),
      wordNumber: bookmark.wordNumber,
      audioOffsetMs: bookmark.audioOffsetMs,
      label: bookmark.label,
      note: bookmark.note,
      color: bookmark.color,
      createdAt: bookmark.createdAt,
      updatedAt: bookmark.updatedAt,
    };
  }

  private buildUpdateData(dto: UpdateBookmarkDto): BookmarkUpdateData {
    const data: BookmarkUpdateData = {};

    if (dto.chapterNumber !== undefined) {
      data.chapterNumber = dto.chapterNumber;
    }
    if (dto.verseNumber !== undefined) {
      data.verseNumber = dto.verseNumber;
    }
    if (dto.wordNumber !== undefined) {
      data.wordNumber = dto.wordNumber;
    }
    if (dto.audioOffsetMs !== undefined) {
      data.audioOffsetMs = dto.audioOffsetMs;
    }
    if (dto.label !== undefined) {
      data.label = dto.label;
    }
    if (dto.note !== undefined) {
      data.note = dto.note;
    }
    if (dto.color !== undefined) {
      data.color = dto.color;
    }

    return data;
  }
}
