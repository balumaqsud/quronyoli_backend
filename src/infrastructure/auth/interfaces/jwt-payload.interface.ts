export type JwtTokenType = 'access' | 'refresh';

export type AdminRoleClaim = 'SUPER_ADMIN' | 'ADMIN';

export interface JwtPayload {
  sub: string;
  sid: string;
  typ: JwtTokenType;
  role?: AdminRoleClaim;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  sub: string;
  sid: string;
  typ: 'access';
  role?: AdminRoleClaim;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type GenerateTokenOptions = {
  role?: AdminRoleClaim;
};
