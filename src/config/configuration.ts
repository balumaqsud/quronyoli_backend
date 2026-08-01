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
  trustProxy: boolean;
  bodyLimit: string;
  slowRequestMs: number;
  shutdownDrainMs: number;
}

export interface DatabaseConfig {
  url: string;
  poolMax: number;
  poolIdleTimeoutMs: number;
  poolConnectionTimeoutMs: number;
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
  botUsername: string;
  apiBaseUrl: string;
  timeoutMs: number;
  initDataMaxAgeSeconds: number;
  webhookUrl?: string;
  webhookSecret: string;
  webhookAutoRegister: boolean;
  miniAppUrl: string;
  webAppUrl: string;
  miniAppShortName: string;
  httpMaxSockets: number;
}

export interface NotificationsConfig {
  queueName: string;
  concurrency: number;
  reminderScanCron: string;
  maxAttempts: number;
  backoffDelayMs: number;
}

export interface AnalyticsConfig {
  maxBatchSize: number;
  maxClockSkewSeconds: number;
  dbChunkSize: number;
  bufferTtlSeconds: number;
  flushDelayMs: number;
  flushMaxBatch: number;
  queueName: string;
  maxAttempts: number;
  backoffDelayMs: number;
  maxPropertiesBytes: number;
  statsCacheTtlSeconds: number;
}

export interface ReadingConfig {
  streakLookbackDays: number;
}

export interface HttpConfig {
  requestTimeoutMs: number;
}

export interface ThrottleConfig {
  ttlMs: number;
  limit: number;
  authLimit: number;
}

export type CookieSameSite = 'lax' | 'strict' | 'none';

export interface AuthCookieConfig {
  name: string;
  path: string;
  domain?: string;
  secure: boolean;
  sameSite: CookieSameSite;
  partitioned: boolean;
  maxAgeMs: number;
}

export type QuranFoundationEnvironment = 'prelive' | 'production';

export interface QuranFoundationCacheTtlConfig {
  chaptersSeconds: number;
  versesSeconds: number;
  resourcesSeconds: number;
  searchSeconds: number;
  audioSeconds: number;
}

export interface QuranFoundationConfig {
  clientId: string;
  clientSecret: string;
  environment: QuranFoundationEnvironment;
  authBaseUrl: string;
  apiBaseUrl: string;
  contentPathPrefix: string;
  searchPathPrefix: string;
  contentScope: string;
  searchScope: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  tokenSkewSeconds: number;
  rateLimitMax: number;
  rateLimitWindowSeconds: number;
  httpMaxSockets: number;
  audioCdnBase: string;
  cacheTtl: QuranFoundationCacheTtlConfig;
}

export interface AppConfiguration {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JwtConfig;
  telegram: TelegramConfig;
  notifications: NotificationsConfig;
  analytics: AnalyticsConfig;
  reading: ReadingConfig;
  http: HttpConfig;
  throttle: ThrottleConfig;
  authCookie: AuthCookieConfig;
  quranFoundation: QuranFoundationConfig;
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

const resolveCookiePartitioned = (sameSite: CookieSameSite): boolean => {
  if (process.env.AUTH_COOKIE_PARTITIONED !== undefined) {
    return process.env.AUTH_COOKIE_PARTITIONED === 'true';
  }

  return sameSite === 'none';
};

const resolveQuranFoundationEnvironment = (): QuranFoundationEnvironment => {
  const value = (
    process.env.QF_ENV ??
    process.env.QURAN_FOUNDATION_ENV ??
    'production'
  ).toLowerCase();

  if (value === 'prelive' || value === 'production') {
    return value;
  }

  throw new Error(`Invalid QF_ENV value: ${value}`);
};

const resolveQuranFoundationUrls = (
  environment: QuranFoundationEnvironment,
): Pick<QuranFoundationConfig, 'authBaseUrl' | 'apiBaseUrl'> => {
  if (environment === 'prelive') {
    return {
      authBaseUrl:
        process.env.QF_AUTH_BASE_URL ??
        'https://prelive-oauth2.quran.foundation',
      apiBaseUrl:
        process.env.QF_API_BASE_URL ?? 'https://apis-prelive.quran.foundation',
    };
  }

  return {
    authBaseUrl:
      process.env.QF_AUTH_BASE_URL ?? 'https://oauth2.quran.foundation',
    apiBaseUrl: process.env.QF_API_BASE_URL ?? 'https://apis.quran.foundation',
  };
};

export default (): AppConfiguration => {
  const nodeEnv = (process.env.NODE_ENV as Environment) || 'development';
  const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
  const quranEnvironment = resolveQuranFoundationEnvironment();
  const quranUrls = resolveQuranFoundationUrls(quranEnvironment);

  return {
    app: {
      nodeEnv,
      port: Number.parseInt(process.env.PORT ?? '3000', 10),
      name: process.env.APP_NAME ?? 'quron-yoli-backend',
      apiPrefix: process.env.API_PREFIX ?? 'api',
      apiVersion: process.env.API_VERSION ?? '1',
      corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
      logLevel: process.env.LOG_LEVEL ?? 'info',
      swaggerEnabled:
        process.env.SWAGGER_ENABLED !== undefined
          ? process.env.SWAGGER_ENABLED === 'true'
          : nodeEnv !== 'production',
      swaggerPath: process.env.SWAGGER_PATH ?? 'docs',
      trustProxy: process.env.TRUST_PROXY === 'true',
      bodyLimit: process.env.HTTP_BODY_LIMIT ?? '1mb',
      slowRequestMs: Number.parseInt(process.env.SLOW_REQUEST_MS ?? '1000', 10),
      shutdownDrainMs: Number.parseInt(
        process.env.SHUTDOWN_DRAIN_MS ?? '5000',
        10,
      ),
    },
    database: {
      url: getRequiredEnv('DATABASE_URL'),
      poolMax: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
      poolIdleTimeoutMs: Number.parseInt(
        process.env.DATABASE_POOL_IDLE_TIMEOUT_MS ?? '10000',
        10,
      ),
      poolConnectionTimeoutMs: Number.parseInt(
        process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS ?? '5000',
        10,
      ),
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
      botUsername: getRequiredEnv('TELEGRAM_BOT_USERNAME').replace(/^@/, ''),
      apiBaseUrl:
        process.env.TELEGRAM_API_BASE_URL ?? 'https://api.telegram.org',
      timeoutMs: Number.parseInt(
        process.env.TELEGRAM_TIMEOUT_MS ?? '15000',
        10,
      ),
      initDataMaxAgeSeconds: Number.parseInt(
        process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ?? '86400',
        10,
      ),
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || undefined,
      webhookSecret: getRequiredEnv('TELEGRAM_WEBHOOK_SECRET'),
      webhookAutoRegister:
        process.env.TELEGRAM_WEBHOOK_AUTO_REGISTER === 'true',
      miniAppUrl: getRequiredEnv('TELEGRAM_MINI_APP_URL'),
      webAppUrl: getRequiredEnv('TELEGRAM_WEB_APP_URL'),
      miniAppShortName: process.env.TELEGRAM_MINI_APP_SHORT_NAME ?? 'app',
      httpMaxSockets: Number.parseInt(
        process.env.TELEGRAM_HTTP_MAX_SOCKETS ?? '50',
        10,
      ),
    },
    notifications: {
      queueName: process.env.NOTIFICATIONS_QUEUE_NAME ?? 'daily-reminders',
      concurrency: Number.parseInt(
        process.env.NOTIFICATIONS_QUEUE_CONCURRENCY ?? '5',
        10,
      ),
      reminderScanCron:
        process.env.NOTIFICATIONS_REMINDER_SCAN_CRON ?? '* * * * *',
      maxAttempts: Number.parseInt(
        process.env.NOTIFICATIONS_MAX_ATTEMPTS ?? '5',
        10,
      ),
      backoffDelayMs: Number.parseInt(
        process.env.NOTIFICATIONS_BACKOFF_DELAY_MS ?? '5000',
        10,
      ),
    },
    analytics: {
      maxBatchSize: Number.parseInt(
        process.env.ANALYTICS_MAX_BATCH_SIZE ?? '100',
        10,
      ),
      maxClockSkewSeconds: Number.parseInt(
        process.env.ANALYTICS_MAX_CLOCK_SKEW_SECONDS ?? '300',
        10,
      ),
      dbChunkSize: Number.parseInt(
        process.env.ANALYTICS_DB_CHUNK_SIZE ?? '100',
        10,
      ),
      bufferTtlSeconds: Number.parseInt(
        process.env.ANALYTICS_BUFFER_TTL_SECONDS ?? '3600',
        10,
      ),
      flushDelayMs: Number.parseInt(
        process.env.ANALYTICS_FLUSH_DELAY_MS ?? '2000',
        10,
      ),
      flushMaxBatch: Number.parseInt(
        process.env.ANALYTICS_FLUSH_MAX_BATCH ?? '500',
        10,
      ),
      queueName: process.env.ANALYTICS_QUEUE_NAME ?? 'analytics-flush',
      maxAttempts: Number.parseInt(
        process.env.ANALYTICS_MAX_ATTEMPTS ?? '5',
        10,
      ),
      backoffDelayMs: Number.parseInt(
        process.env.ANALYTICS_BACKOFF_DELAY_MS ?? '5000',
        10,
      ),
      maxPropertiesBytes: Number.parseInt(
        process.env.ANALYTICS_MAX_PROPERTIES_BYTES ?? '4096',
        10,
      ),
      statsCacheTtlSeconds: Number.parseInt(
        process.env.ANALYTICS_STATS_CACHE_TTL_SECONDS ?? '30',
        10,
      ),
    },
    reading: {
      streakLookbackDays: Number.parseInt(
        process.env.READING_STREAK_LOOKBACK_DAYS ?? '400',
        10,
      ),
    },
    http: {
      requestTimeoutMs: Number.parseInt(
        process.env.HTTP_REQUEST_TIMEOUT_MS ?? '30000',
        10,
      ),
    },
    throttle: {
      ttlMs: Number.parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
      limit: Number.parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
      authLimit: Number.parseInt(process.env.THROTTLE_AUTH_LIMIT ?? '20', 10),
    },
    authCookie: (() => {
      const sameSite = resolveCookieSameSite();
      return {
        name: process.env.AUTH_COOKIE_NAME ?? 'refresh_token',
        path: process.env.AUTH_COOKIE_PATH ?? '/',
        domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
        secure: resolveCookieSecure(nodeEnv),
        sameSite,
        partitioned: resolveCookiePartitioned(sameSite),
        maxAgeMs: parseDurationToMs(refreshExpiresIn),
      };
    })(),
    quranFoundation: {
      clientId: getRequiredEnv('QF_CLIENT_ID'),
      clientSecret: getRequiredEnv('QF_CLIENT_SECRET'),
      environment: quranEnvironment,
      authBaseUrl: quranUrls.authBaseUrl,
      apiBaseUrl: quranUrls.apiBaseUrl,
      contentPathPrefix:
        process.env.QF_CONTENT_PATH_PREFIX ?? '/content/api/v4',
      searchPathPrefix: process.env.QF_SEARCH_PATH_PREFIX ?? '/search/v1',
      contentScope: process.env.QF_CONTENT_SCOPE ?? 'content',
      searchScope: process.env.QF_SEARCH_SCOPE ?? 'search',
      timeoutMs: Number.parseInt(process.env.QF_TIMEOUT_MS ?? '30000', 10),
      maxRetries: Number.parseInt(process.env.QF_MAX_RETRIES ?? '3', 10),
      retryBaseDelayMs: Number.parseInt(
        process.env.QF_RETRY_BASE_DELAY_MS ?? '250',
        10,
      ),
      tokenSkewSeconds: Number.parseInt(
        process.env.QF_TOKEN_SKEW_SECONDS ?? '30',
        10,
      ),
      rateLimitMax: Number.parseInt(process.env.QF_RATE_LIMIT_MAX ?? '60', 10),
      rateLimitWindowSeconds: Number.parseInt(
        process.env.QF_RATE_LIMIT_WINDOW_SECONDS ?? '60',
        10,
      ),
      httpMaxSockets: Number.parseInt(
        process.env.QF_HTTP_MAX_SOCKETS ?? '50',
        10,
      ),
      // Relative ayah audio paths (e.g. Alafasy/mp3/001001.mp3) resolve here.
      audioCdnBase:
        process.env.QF_AUDIO_CDN_BASE ?? 'https://audio.qurancdn.com',
      cacheTtl: {
        chaptersSeconds: Number.parseInt(
          process.env.QF_CACHE_TTL_CHAPTERS_SECONDS ?? '86400',
          10,
        ),
        versesSeconds: Number.parseInt(
          process.env.QF_CACHE_TTL_VERSES_SECONDS ?? '3600',
          10,
        ),
        resourcesSeconds: Number.parseInt(
          process.env.QF_CACHE_TTL_RESOURCES_SECONDS ?? '86400',
          10,
        ),
        searchSeconds: Number.parseInt(
          process.env.QF_CACHE_TTL_SEARCH_SECONDS ?? '300',
          10,
        ),
        audioSeconds: Number.parseInt(
          process.env.QF_CACHE_TTL_AUDIO_SECONDS ?? '3600',
          10,
        ),
      },
    },
  };
};
