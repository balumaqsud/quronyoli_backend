import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { Response } from 'express';
import { CONFIG_KEYS } from '../../../common/constants';
import { AuthCookieConfig } from '../../../config/configuration';
import { AdminRole } from '../../../generated/prisma';
import { TokenService } from '../../../infrastructure/auth/token.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuthCookieService } from '../../auth/auth-cookie.service';
import { AuthRequestContext } from '../../auth/interfaces/auth-request-context.interface';
import { SessionsRepository } from '../../auth/sessions.repository';
import { TelegramInitDataVerifier } from '../../auth/telegram/telegram-init-data.verifier';
import { UsersService } from '../../users/users.service';
import { AuthenticatedUser } from '../../../infrastructure/auth/interfaces/jwt-payload.interface';
import { AdminAuthTokensResponseDto } from './dto/admin-auth-response.dto';

@Injectable()
export class AdminAuthService {
  private readonly cookieConfig: AuthCookieConfig;

  constructor(
    private readonly telegramInitDataVerifier: TelegramInitDataVerifier,
    private readonly usersService: UsersService,
    private readonly sessionsRepository: SessionsRepository,
    private readonly tokenService: TokenService,
    private readonly authCookieService: AuthCookieService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.cookieConfig = this.configService.getOrThrow<AuthCookieConfig>(
      CONFIG_KEYS.AUTH_COOKIE,
    );
  }

  async loginWithTelegram(
    initData: string,
    context: AuthRequestContext,
    response: Response,
  ): Promise<AdminAuthTokensResponseDto> {
    const verified = this.telegramInitDataVerifier.verify(initData);
    const telegramUser = verified.user;

    const user = await this.usersService.upsertFromTelegram({
      telegramId: String(telegramUser.id),
      username: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      languageCode: telegramUser.language_code,
      photoUrl: telegramUser.photo_url,
      isPremium: telegramUser.is_premium ?? false,
      allowsWriteToPm: telegramUser.allows_write_to_pm,
    });

    if (user.isBanned) {
      throw new ForbiddenException('User is banned');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { userId: user.id },
    });

    if (!admin) {
      throw new ForbiddenException('Admin access required');
    }

    const sessionId = randomUUID();
    const tokens = await this.tokenService.generateTokenPair(
      user.id,
      sessionId,
      { role: admin.role },
    );

    await this.sessionsRepository.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.hashToken(tokens.refreshToken),
      expiresAt: this.resolveRefreshExpiry(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    this.authCookieService.setRefreshToken(response, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      admin: {
        id: admin.id,
        role: admin.role,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          photoUrl: user.photoUrl,
        },
      },
    };
  }

  async refresh(
    refreshToken: string | undefined,
    context: AuthRequestContext,
    response: Response,
  ): Promise<AdminAuthTokensResponseDto> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      this.authCookieService.clearRefreshToken(response);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.sessionsRepository.findById(payload.sid);

    if (!session || session.userId !== payload.sub) {
      this.authCookieService.clearRefreshToken(response);
      throw new UnauthorizedException('Session not found');
    }

    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      await this.sessionsRepository.revoke(session.id);
      this.authCookieService.clearRefreshToken(response);
      throw new UnauthorizedException('Session is no longer valid');
    }

    const incomingHash = this.hashToken(refreshToken);
    const storedHashBuffer = Buffer.from(session.refreshTokenHash, 'hex');
    const incomingHashBuffer = Buffer.from(incomingHash, 'hex');

    if (
      storedHashBuffer.length !== incomingHashBuffer.length ||
      !timingSafeEqual(storedHashBuffer, incomingHashBuffer)
    ) {
      await this.sessionsRepository.revoke(session.id);
      this.authCookieService.clearRefreshToken(response);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const user = await this.usersService.getActiveByIdOrThrow(session.userId);

    if (user.isBanned) {
      await this.sessionsRepository.revoke(session.id);
      this.authCookieService.clearRefreshToken(response);
      throw new ForbiddenException('User is banned');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { userId: user.id },
    });

    if (!admin) {
      await this.sessionsRepository.revoke(session.id);
      this.authCookieService.clearRefreshToken(response);
      throw new ForbiddenException('Admin access required');
    }

    const tokens = await this.tokenService.generateTokenPair(
      user.id,
      session.id,
      { role: admin.role as AdminRole },
    );

    const rotated = await this.sessionsRepository.rotateIfHashMatches({
      sessionId: session.id,
      expectedRefreshTokenHash: incomingHash,
      refreshTokenHash: this.hashToken(tokens.refreshToken),
      expiresAt: this.resolveRefreshExpiry(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    if (!rotated) {
      await this.sessionsRepository.revoke(session.id);
      this.authCookieService.clearRefreshToken(response);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    this.authCookieService.setRefreshToken(response, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      admin: {
        id: admin.id,
        role: admin.role,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          photoUrl: user.photoUrl,
        },
      },
    };
  }

  async logout(
    currentUser: AuthenticatedUser,
    response: Response,
  ): Promise<{ success: true }> {
    await this.sessionsRepository.revoke(currentUser.sid);
    this.authCookieService.clearRefreshToken(response);
    return { success: true };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private resolveRefreshExpiry(): Date {
    return new Date(Date.now() + this.cookieConfig.maxAgeMs);
  }
}
