import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '../../config/configuration';
import { CONFIG_KEYS } from '../../common/constants';
import {
  AuthenticatedUser,
  JwtPayload,
} from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const jwtConfig = configService.getOrThrow<JwtConfig>(CONFIG_KEYS.JWT);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessSecret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (payload.typ !== 'access' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid access token');
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
