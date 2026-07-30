import { Injectable } from '@nestjs/common';
import { UserSession } from '../../generated/prisma';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface CreateSessionInput {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface RotateSessionInput {
  sessionId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSessionInput): Promise<UserSession> {
    return await this.prisma.userSession.create({
      data: {
        id: input.id,
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        lastUsedAt: new Date(),
      },
    });
  }

  async findById(id: string): Promise<UserSession | null> {
    return await this.prisma.userSession.findUnique({
      where: { id },
    });
  }

  async rotate(input: RotateSessionInput): Promise<UserSession> {
    return await this.prisma.userSession.update({
      where: { id: input.sessionId },
      data: {
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        lastUsedAt: new Date(),
        revokedAt: null,
      },
    });
  }

  async revoke(sessionId: string): Promise<UserSession | null> {
    const session = await this.findById(sessionId);

    if (!session || session.revokedAt) {
      return session;
    }

    return await this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return result.count;
  }
}
