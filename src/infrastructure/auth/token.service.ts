import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtConfig } from '../../config/configuration';
import { CONFIG_KEYS } from '../../common/constants';
import {
  GenerateTokenOptions,
  JwtPayload,
  TokenPair,
} from './interfaces/jwt-payload.interface';

@Injectable()
export class TokenService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtConfig = this.configService.getOrThrow<JwtConfig>(CONFIG_KEYS.JWT);
  }

  async generateAccessToken(
    userId: string,
    sessionId: string,
    options?: GenerateTokenOptions,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      sid: sessionId,
      typ: 'access',
      ...(options?.role ? { role: options.role } : {}),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.jwtConfig
        .accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  async generateRefreshToken(
    userId: string,
    sessionId: string,
    options?: GenerateTokenOptions,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      sid: sessionId,
      typ: 'refresh',
      ...(options?.role ? { role: options.role } : {}),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.refreshSecret,
      expiresIn: this.jwtConfig
        .refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  async generateTokenPair(
    userId: string,
    sessionId: string,
    options?: GenerateTokenOptions,
  ): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, sessionId, options),
      this.generateRefreshToken(userId, sessionId, options),
    ]);

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.jwtConfig.accessSecret,
    });

    if (payload.typ !== 'access' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid access token');
    }

    return payload;
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.jwtConfig.refreshSecret,
    });

    if (payload.typ !== 'refresh' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return payload;
  }
}
