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

export interface AppConfiguration {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
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

export default (): AppConfiguration => ({
  app: {
    nodeEnv: (process.env.NODE_ENV as Environment) || 'development',
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
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
});
