import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthCookieService } from './auth-cookie.service';

describe('AuthCookieService', () => {
  const cookieConfig = {
    name: 'refresh_token',
    path: '/',
    domain: undefined as string | undefined,
    secure: true,
    sameSite: 'none' as const,
    partitioned: true,
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  };

  const configService = {
    getOrThrow: () => cookieConfig,
  } as unknown as ConfigService;

  const service = new AuthCookieService(configService);

  const expectedOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none' as const,
    path: '/',
    domain: undefined,
    partitioned: true,
    maxAge: cookieConfig.maxAgeMs,
  };

  it('sets refresh cookie with cross-site Mini App attributes', () => {
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;

    service.setRefreshToken(response, 'test-refresh-token');

    expect(cookie).toHaveBeenCalledWith(
      'refresh_token',
      'test-refresh-token',
      expectedOptions,
    );
  });

  it('clears refresh cookie with the same attributes', () => {
    const clearCookie = jest.fn();
    const response = { clearCookie } as unknown as Response;

    service.clearRefreshToken(response);

    expect(clearCookie).toHaveBeenCalledWith('refresh_token', expectedOptions);
  });
});
