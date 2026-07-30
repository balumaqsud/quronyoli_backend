import { Injectable } from '@nestjs/common';
import { Favorite, Prisma } from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface FavoriteListQuery {
  userId: string;
  limit: number;
  cursorAt?: Date;
  cursorId?: string;
  chapterNumber?: number;
  verseNumber?: number;
}

@Injectable()
export class FavoritesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    chapterNumber: number;
    verseNumber: number;
  }): Promise<Favorite> {
    return await this.prisma.favorite.create({ data });
  }

  async findOwned(id: string, userId: string): Promise<Favorite | null> {
    return await this.prisma.favorite.findFirst({
      where: { id, userId },
    });
  }

  async updateOwned(
    id: string,
    userId: string,
    data: { chapterNumber: number; verseNumber: number },
  ): Promise<Favorite | null> {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.favorite.findFirst({
        where: { id, userId },
      });
      if (!existing) {
        return null;
      }

      return await tx.favorite.update({
        where: { id },
        data,
      });
    });
  }

  async deleteOwned(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.favorite.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  }

  async list(query: FavoriteListQuery): Promise<Favorite[]> {
    const where: Prisma.FavoriteWhereInput = {
      userId: query.userId,
    };

    if (query.chapterNumber !== undefined) {
      where.chapterNumber = query.chapterNumber;
    }
    if (query.verseNumber !== undefined) {
      where.verseNumber = query.verseNumber;
    }

    if (query.cursorAt && query.cursorId) {
      where.AND = [
        {
          OR: [
            { createdAt: { lt: query.cursorAt } },
            {
              AND: [
                { createdAt: query.cursorAt },
                { id: { lt: query.cursorId } },
              ],
            },
          ],
        },
      ];
    }

    return await this.prisma.favorite.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
    });
  }
}
