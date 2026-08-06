import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '../../config/configuration';
import { CONFIG_KEYS } from '../../common/constants';
import { PrismaService } from '../database/prisma.service';
import {
  AuthenticatedUser,
  JwtPayload,
} from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtConfig = configService.getOrThrow<JwtConfig>(CONFIG_KEYS.JWT);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.typ !== 'access' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        isBanned: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    return {
      sub: payload.sub,
      sid: payload.sid,
      typ: 'access',
      ...(payload.role ? { role: payload.role } : {}),
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}
