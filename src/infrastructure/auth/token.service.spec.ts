import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { CONFIG_KEYS } from '../../common/constants';

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

  it('generates an access and refresh token pair', async () => {
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    await expect(service.generateTokenPair('user-1')).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
  });

  it('verifies an access token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      typ: 'access',
    });

    await expect(service.verifyAccessToken('token')).resolves.toEqual({
      sub: 'user-1',
      typ: 'access',
    });
  });
});
