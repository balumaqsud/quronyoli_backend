import { Injectable } from '@nestjs/common';
import { keysetDescCursorOr } from '../../common/pagination/paginate-keyset';
import { Bookmark, Prisma } from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface BookmarkCreateData {
  userId: string;
  chapterNumber: number;
  verseNumber: number;
  wordNumber?: number | null;
  audioOffsetMs?: number | null;
  label?: string | null;
  note?: string | null;
  color?: string | null;
}

export type BookmarkUpdateData = Partial<Omit<BookmarkCreateData, 'userId'>>;

export interface BookmarkListQuery {
  userId: string;
  limit: number;
  cursorAt?: Date;
  cursorId?: string;
  chapterNumber?: number;
  verseNumber?: number;
  color?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class BookmarksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: BookmarkCreateData): Promise<Bookmark> {
    return await this.prisma.bookmark.create({ data });
  }

  async findOwnedActive(id: string, userId: string): Promise<Bookmark | null> {
    return await this.prisma.bookmark.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });
  }

  async updateOwnedActive(
    id: string,
    userId: string,
    data: BookmarkUpdateData,
  ): Promise<Bookmark | null> {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.bookmark.findFirst({
        where: {
          id,
          userId,
          deletedAt: null,
        },
      });
      if (!existing) {
        return null;
      }

      return await tx.bookmark.update({
        where: { id },
        data,
      });
    });
  }

  async softDeleteOwned(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.bookmark.updateMany({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
    return result.count > 0;
  }

  async listActive(query: BookmarkListQuery): Promise<Bookmark[]> {
    const where: Prisma.BookmarkWhereInput = {
      userId: query.userId,
      deletedAt: null,
    };

    if (query.chapterNumber !== undefined) {
      where.chapterNumber = query.chapterNumber;
    }
    if (query.verseNumber !== undefined) {
      where.verseNumber = query.verseNumber;
    }
    if (query.color !== undefined) {
      where.color = query.color;
    }
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }

    if (query.cursorAt && query.cursorId) {
      where.AND = [
        keysetDescCursorOr('createdAt', query.cursorAt, query.cursorId),
      ];
    }

    return await this.prisma.bookmark.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
    });
  }
}
