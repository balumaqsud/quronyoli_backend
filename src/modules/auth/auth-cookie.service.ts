import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';
import { CONFIG_KEYS } from '../../common/constants';
import { AuthCookieConfig } from '../../config/configuration';

@Injectable()
export class AuthCookieService {
  private readonly cookieConfig: AuthCookieConfig;

  constructor(private readonly configService: ConfigService) {
    this.cookieConfig = this.configService.getOrThrow<AuthCookieConfig>(
      CONFIG_KEYS.AUTH_COOKIE,
    );
  }

  get cookieName(): string {
    return this.cookieConfig.name;
  }

  setRefreshToken(response: Response, refreshToken: string): void {
    response.cookie(this.cookieConfig.name, refreshToken, this.buildOptions());
  }

  clearRefreshToken(response: Response): void {
    response.clearCookie(this.cookieConfig.name, this.buildOptions());
  }

  private buildOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cookieConfig.secure,
      sameSite: this.cookieConfig.sameSite,
      path: this.cookieConfig.path,
      domain: this.cookieConfig.domain,
      partitioned: this.cookieConfig.partitioned,
      maxAge: this.cookieConfig.maxAgeMs,
    };
  }
}
