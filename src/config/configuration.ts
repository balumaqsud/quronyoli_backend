export type Environment = 'development' | 'production' | 'test';

export interface AppConfig {
  nodeEnv: Environment;
  port: number;
  name: string;
  apiPrefix: string;
  apiVersion: string;
  corsOrigins: string[];
  logLevel: string;
  swaggerEnabled: boolean;
  swaggerPath: string;
}

export interface DatabaseConfig {
  url: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  keyPrefix: string;
}

export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

export interface TelegramConfig {
  botToken: string;
  initDataMaxAgeSeconds: number;
}

export type CookieSameSite = 'lax' | 'strict' | 'none';

export interface AuthCookieConfig {
  name: string;
  path: string;
  domain?: string;
  secure: boolean;
  sameSite: CookieSameSite;
  maxAgeMs: number;
}

export interface AppConfiguration {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  telegram: TelegramConfig;
  authCookie: AuthCookieConfig;
}

const parseCorsOrigins = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const parseDurationToMs = (value: string): number => {
  const match = /^(\d+)([smhd])$/.exec(value);

  if (!match) {
    throw new Error(`Invalid duration format: ${value}`);
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
};

const resolveCookieSecure = (nodeEnv: Environment): boolean => {
  if (process.env.AUTH_COOKIE_SECURE !== undefined) {
    return process.env.AUTH_COOKIE_SECURE === 'true';
  }

  return nodeEnv === 'production';
};

const resolveCookieSameSite = (): CookieSameSite => {
  const value = (process.env.AUTH_COOKIE_SAME_SITE ?? 'lax').toLowerCase();

  if (value === 'lax' || value === 'strict' || value === 'none') {
    return value;
  }

  throw new Error(`Invalid AUTH_COOKIE_SAME_SITE value: ${value}`);
};

export default (): AppConfiguration => {
  const nodeEnv = (process.env.NODE_ENV as Environment) || 'development';
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

  return {
    app: {
      nodeEnv,
      port: Number.parseInt(process.env.PORT ?? '3000', 10),
      name: process.env.APP_NAME ?? 'quron-yoli-backend',
      apiPrefix: process.env.API_PREFIX ?? 'api',
      apiVersion: process.env.API_VERSION ?? '1',
      corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
      logLevel: process.env.LOG_LEVEL ?? 'info',
      swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
      swaggerPath: process.env.SWAGGER_PATH ?? 'docs',
    },
    database: {
      url: getRequiredEnv('DATABASE_URL'),
    },
    redis: {
      host: getRequiredEnv('REDIS_HOST'),
      port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD ?? '',
      db: Number.parseInt(process.env.REDIS_DB ?? '0', 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX ?? 'quron-yoli:',
    },
    jwt: {
      accessSecret: getRequiredEnv('JWT_ACCESS_SECRET'),
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshSecret: getRequiredEnv('JWT_REFRESH_SECRET'),
      refreshExpiresIn,
    },
    telegram: {
      botToken: getRequiredEnv('TELEGRAM_BOT_TOKEN'),
      initDataMaxAgeSeconds: Number.parseInt(
        process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ?? '86400',
        10,
      ),
    },
    authCookie: {
      name: process.env.AUTH_COOKIE_NAME ?? 'refresh_token',
      path: process.env.AUTH_COOKIE_PATH ?? '/api/v1/auth',
      domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
      secure: resolveCookieSecure(nodeEnv),
      sameSite: resolveCookieSameSite(),
      maxAgeMs: parseDurationToMs(refreshExpiresIn),
    },
  };
};
