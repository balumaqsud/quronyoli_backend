export type JwtTokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string;
  sid: string;
  typ: JwtTokenType;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  sub: string;
  sid: string;
  typ: 'access';
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
