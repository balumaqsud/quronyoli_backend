import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { Response } from 'express';
import { CONFIG_KEYS } from '../../common/constants';
import { TokenService } from '../../infrastructure/auth/token.service';
import { UsersService } from '../users/users.service';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import { SessionsRepository } from './sessions.repository';
import { TelegramInitDataVerifier } from './telegram/telegram-init-data.verifier';

describe('AuthService', () => {
  let service: AuthService;
  let telegramVerifier: jest.Mocked<Pick<TelegramInitDataVerifier, 'verify'>>;
  let usersService: jest.Mocked<
    Pick<
      UsersService,
      'upsertFromTelegram' | 'getActiveByIdOrThrow' | 'toResponse'
    >
  >;
  let sessionsRepository: jest.Mocked<
    Pick<SessionsRepository, 'create' | 'findById' | 'rotate' | 'revoke'>
  >;
  let tokenService: jest.Mocked<
    Pick<TokenService, 'generateTokenPair' | 'verifyRefreshToken'>
  >;
  let authCookieService: jest.Mocked<
    Pick<AuthCookieService, 'setRefreshToken' | 'clearRefreshToken'>
  >;
  let response: jest.Mocked<Pick<Response, 'cookie' | 'clearCookie'>>;

  const user = {
    id: 'user-1',
    telegramId: '42',
    username: 'ali',
    firstName: 'Ali',
    lastName: null,
    languageCode: 'uz',
    photoUrl: null,
    isPremium: false,
    allowsWriteToPm: false,
    isActive: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userResponse = {
    id: 'user-1',
    telegramId: '42',
    username: 'ali',
    firstName: 'Ali',
    lastName: null,
    languageCode: 'uz',
    photoUrl: null,
    isPremium: false,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };

  beforeEach(async () => {
    telegramVerifier = { verify: jest.fn() };
    usersService = {
      upsertFromTelegram: jest.fn(),
      getActiveByIdOrThrow: jest.fn(),
      toResponse: jest.fn(),
    };
    sessionsRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      rotate: jest.fn(),
      revoke: jest.fn(),
    };
    tokenService = {
      generateTokenPair: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };
    authCookieService = {
      setRefreshToken: jest.fn(),
      clearRefreshToken: jest.fn(),
    };
    response = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: TelegramInitDataVerifier, useValue: telegramVerifier },
        { provide: UsersService, useValue: usersService },
        { provide: SessionsRepository, useValue: sessionsRepository },
        { provide: TokenService, useValue: tokenService },
        { provide: AuthCookieService, useValue: authCookieService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === CONFIG_KEYS.AUTH_COOKIE) {
                return { maxAgeMs: 7 * 24 * 60 * 60 * 1000 };
              }

              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('logs in with Telegram and creates a session', async () => {
    telegramVerifier.verify.mockReturnValue({
      user: {
        id: 42,
        first_name: 'Ali',
        username: 'ali',
        language_code: 'uz',
      },
      authDate: new Date(),
    });
    usersService.upsertFromTelegram.mockResolvedValue(user);
    usersService.toResponse.mockReturnValue(userResponse);
    tokenService.generateTokenPair.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    sessionsRepository.create.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hash',
      expiresAt: new Date(),
      revokedAt: null,
      ipAddress: null,
      userAgent: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.loginWithTelegram(
        'init-data',
        { ipAddress: '127.0.0.1', userAgent: 'jest' },
        response as unknown as Response,
      ),
    ).resolves.toEqual({
      accessToken: 'access-token',
      user: userResponse,
    });

    expect(sessionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        refreshTokenHash: createHash('sha256')
          .update('refresh-token')
          .digest('hex'),
      }),
    );
    expect(authCookieService.setRefreshToken).toHaveBeenCalledWith(
      response,
      'refresh-token',
    );
  });

  it('rotates a valid refresh token', async () => {
    const refreshToken = 'refresh-token';
    const refreshTokenHash = createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      typ: 'refresh',
    });
    sessionsRepository.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      ipAddress: null,
      userAgent: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    usersService.getActiveByIdOrThrow.mockResolvedValue(user);
    usersService.toResponse.mockReturnValue(userResponse);
    tokenService.generateTokenPair.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    sessionsRepository.rotate.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'rotated',
      expiresAt: new Date(),
      revokedAt: null,
      ipAddress: null,
      userAgent: null,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.refresh(
        refreshToken,
        { ipAddress: '127.0.0.1' },
        response as unknown as Response,
      ),
    ).resolves.toEqual({
      accessToken: 'new-access',
      user: userResponse,
    });

    expect(sessionsRepository.rotate).toHaveBeenCalled();
    expect(authCookieService.setRefreshToken).toHaveBeenCalledWith(
      response,
      'new-refresh',
    );
  });

  it('revokes the session when refresh token reuse is detected', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      typ: 'refresh',
    });
    sessionsRepository.findById.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: createHash('sha256')
        .update('other-token')
        .digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      ipAddress: null,
      userAgent: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.refresh('refresh-token', {}, response as unknown as Response),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessionsRepository.revoke).toHaveBeenCalledWith('session-1');
    expect(authCookieService.clearRefreshToken).toHaveBeenCalled();
  });

  it('logs out by revoking the current session', async () => {
    sessionsRepository.revoke.mockResolvedValue(null);

    await expect(
      service.logout(
        { sub: 'user-1', sid: 'session-1', typ: 'access' },
        response as unknown as Response,
      ),
    ).resolves.toEqual({ success: true });

    expect(sessionsRepository.revoke).toHaveBeenCalledWith('session-1');
    expect(authCookieService.clearRefreshToken).toHaveBeenCalled();
  });
});
