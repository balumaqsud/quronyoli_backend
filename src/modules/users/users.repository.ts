import { Injectable } from '@nestjs/common';
import { AdminRole, User } from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpsertTelegramUserInput } from './interfaces/user.interface';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findActiveById(id: string): Promise<User | null> {
    return await this.prisma.user.findFirst({
      where: {
        id,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  async findAdminRole(userId: string): Promise<AdminRole | null> {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      select: { role: true },
    });
    return admin?.role ?? null;
  }

  async upsertFromTelegram(input: UpsertTelegramUserInput): Promise<User> {
    return await this.prisma.user.upsert({
      where: { telegramId: input.telegramId },
      create: {
        telegramId: input.telegramId,
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        languageCode: input.languageCode,
        photoUrl: input.photoUrl,
        isPremium: input.isPremium,
        allowsWriteToPm: input.allowsWriteToPm,
        lastLoginAt: new Date(),
      },
      update: {
        username: input.username,
        firstName: input.firstName,
        lastName: input.lastName,
        languageCode: input.languageCode,
        photoUrl: input.photoUrl,
        isPremium: input.isPremium,
        allowsWriteToPm: input.allowsWriteToPm,
        lastLoginAt: new Date(),
        isActive: true,
        deletedAt: null,
      },
    });
  }
}
