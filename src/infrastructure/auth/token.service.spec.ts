import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { CONFIG_KEYS } from '../../common/constants';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;

  beforeEach(async () => {
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === CONFIG_KEYS.JWT) {
                return {
                  accessSecret: 'access-secret-at-least-32-characters',
                  accessExpiresIn: '15m',
                  refreshSecret: 'refresh-secret-at-least-32-characters',
                  refreshExpiresIn: '7d',
                };
              }

              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  it('generates an access and refresh token pair with session id', async () => {
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    await expect(
      service.generateTokenPair('user-1', 'session-1'),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      { sub: 'user-1', sid: 'session-1', typ: 'access' },
      expect.objectContaining({
        secret: 'access-secret-at-least-32-characters',
      }),
    );
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      { sub: 'user-1', sid: 'session-1', typ: 'refresh' },
      expect.objectContaining({
        secret: 'refresh-secret-at-least-32-characters',
      }),
    );
  });

  it('rejects access tokens with the wrong type', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      typ: 'refresh',
    });

    await expect(service.verifyAccessToken('token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('verifies a refresh token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      typ: 'refresh',
    });

    await expect(service.verifyRefreshToken('token')).resolves.toEqual({
      sub: 'user-1',
      sid: 'session-1',
      typ: 'refresh',
    });
  });
});
