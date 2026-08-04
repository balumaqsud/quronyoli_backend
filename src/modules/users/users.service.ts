import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminRole, User } from '../../generated/prisma';
import {
  UpsertTelegramUserInput,
  UserResponseDto,
} from './interfaces/user.interface';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async upsertFromTelegram(input: UpsertTelegramUserInput): Promise<User> {
    return this.usersRepository.upsertFromTelegram(input);
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.usersRepository.findByTelegramId(telegramId);
  }

  async getActiveByIdOrThrow(id: string): Promise<User> {
    const user = await this.usersRepository.findActiveById(id);

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  async findAdminRole(userId: string): Promise<AdminRole | null> {
    return this.usersRepository.findAdminRole(userId);
  }

  toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      languageCode: user.languageCode,
      photoUrl: user.photoUrl,
      isPremium: user.isPremium,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
