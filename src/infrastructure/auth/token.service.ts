import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtConfig } from '../../config/configuration';
import { CONFIG_KEYS } from '../../common/constants';
import { JwtPayload, TokenPair } from './interfaces/jwt-payload.interface';

@Injectable()
export class TokenService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtConfig = this.configService.getOrThrow<JwtConfig>(CONFIG_KEYS.JWT);
  }

  async generateAccessToken(subject: string): Promise<string> {
    const payload: JwtPayload = {
      sub: subject,
      typ: 'access',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.accessSecret,
      expiresIn: this.jwtConfig
        .accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  async generateRefreshToken(subject: string): Promise<string> {
    const payload: JwtPayload = {
      sub: subject,
      typ: 'refresh',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.jwtConfig.refreshSecret,
      expiresIn: this.jwtConfig
        .refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  async generateTokenPair(subject: string): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(subject),
      this.generateRefreshToken(subject),
    ]);

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.jwtConfig.accessSecret,
    });
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.jwtConfig.refreshSecret,
    });
  }
}
