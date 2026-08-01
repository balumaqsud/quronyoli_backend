import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  APP_NAME: Joi.string().default('quron-yoli-backend'),
  API_PREFIX: Joi.string().default('api'),
  API_VERSION: Joi.string().default('1'),

  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  DATABASE_POOL_IDLE_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(10000),
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(5000),

  REDIS_HOST: Joi.string().hostname().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().integer().min(0).default(0),
  REDIS_KEY_PREFIX: Joi.string().default('quron-yoli:'),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  TELEGRAM_BOT_TOKEN: Joi.string().min(30).required(),
  TELEGRAM_BOT_USERNAME: Joi.string().min(3).required(),
  TELEGRAM_API_BASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .default('https://api.telegram.org'),
  TELEGRAM_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: Joi.number()
    .integer()
    .min(60)
    .default(86400),
  TELEGRAM_WEBHOOK_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .optional()
    .allow(''),
  TELEGRAM_WEBHOOK_SECRET: Joi.string().min(16).required(),
  TELEGRAM_WEBHOOK_AUTO_REGISTER: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  TELEGRAM_MINI_APP_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .required(),
  TELEGRAM_WEB_APP_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .required(),
  TELEGRAM_MINI_APP_SHORT_NAME: Joi.string().min(1).default('app'),
  TELEGRAM_HTTP_MAX_SOCKETS: Joi.number().integer().min(1).max(500).default(50),

  NOTIFICATIONS_QUEUE_NAME: Joi.string().default('daily-reminders'),
  NOTIFICATIONS_QUEUE_CONCURRENCY: Joi.number().integer().min(1).default(5),
  NOTIFICATIONS_REMINDER_SCAN_CRON: Joi.string().default('* * * * *'),
  NOTIFICATIONS_MAX_ATTEMPTS: Joi.number().integer().min(1).max(20).default(5),
  NOTIFICATIONS_BACKOFF_DELAY_MS: Joi.number().integer().min(100).default(5000),

  ANALYTICS_MAX_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(100),
  ANALYTICS_MAX_CLOCK_SKEW_SECONDS: Joi.number().integer().min(0).default(300),
  ANALYTICS_DB_CHUNK_SIZE: Joi.number().integer().min(1).max(500).default(100),
  ANALYTICS_BUFFER_TTL_SECONDS: Joi.number().integer().min(60).default(3600),
  ANALYTICS_FLUSH_DELAY_MS: Joi.number().integer().min(100).default(2000),
  ANALYTICS_FLUSH_MAX_BATCH: Joi.number()
    .integer()
    .min(1)
    .max(2000)
    .default(500),
  ANALYTICS_QUEUE_NAME: Joi.string().default('analytics-flush'),
  ANALYTICS_MAX_ATTEMPTS: Joi.number().integer().min(1).max(20).default(5),
  ANALYTICS_BACKOFF_DELAY_MS: Joi.number().integer().min(100).default(5000),
  ANALYTICS_MAX_PROPERTIES_BYTES: Joi.number().integer().min(256).default(4096),
  ANALYTICS_STATS_CACHE_TTL_SECONDS: Joi.number().integer().min(0).default(30),

  READING_STREAK_LOOKBACK_DAYS: Joi.number()
    .integer()
    .min(7)
    .max(3660)
    .default(400),

  HTTP_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  HTTP_BODY_LIMIT: Joi.string().default('1mb'),
  TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').default(false),
  SLOW_REQUEST_MS: Joi.number().integer().min(100).default(1000),
  SHUTDOWN_DRAIN_MS: Joi.number().integer().min(0).default(5000),

  THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(120),
  THROTTLE_AUTH_LIMIT: Joi.number().integer().min(1).default(20),

  AUTH_COOKIE_NAME: Joi.string().default('refresh_token'),
  AUTH_COOKIE_PATH: Joi.string().default('/'),
  AUTH_COOKIE_DOMAIN: Joi.string().allow('').optional(),
  AUTH_COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').optional(),
  AUTH_COOKIE_SAME_SITE: Joi.string()
    .valid('lax', 'strict', 'none')
    .default('lax'),
  AUTH_COOKIE_PARTITIONED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .optional(),

  QF_CLIENT_ID: Joi.string().min(8).required(),
  QF_CLIENT_SECRET: Joi.string().min(8).required(),
  QF_ENV: Joi.string().valid('prelive', 'production').default('production'),
  QF_AUTH_BASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .optional(),
  QF_API_BASE_URL: Joi.string()
    .uri({ scheme: ['https'] })
    .optional(),
  QF_CONTENT_PATH_PREFIX: Joi.string().default('/content/api/v4'),
  QF_SEARCH_PATH_PREFIX: Joi.string().default('/search/v1'),
  QF_CONTENT_SCOPE: Joi.string().default('content'),
  QF_SEARCH_SCOPE: Joi.string().default('search'),
  QF_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  QF_MAX_RETRIES: Joi.number().integer().min(0).max(5).default(3),
  QF_RETRY_BASE_DELAY_MS: Joi.number().integer().min(50).default(250),
  QF_TOKEN_SKEW_SECONDS: Joi.number().integer().min(5).default(30),
  QF_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(60),
  QF_RATE_LIMIT_WINDOW_SECONDS: Joi.number().integer().min(1).default(60),
  QF_HTTP_MAX_SOCKETS: Joi.number().integer().min(1).max(500).default(50),
  QF_AUDIO_CDN_BASE: Joi.string()
    .uri({ scheme: ['https'] })
    .default('https://audio.qurancdn.com'),
  QF_CACHE_TTL_CHAPTERS_SECONDS: Joi.number().integer().min(1).default(86400),
  QF_CACHE_TTL_VERSES_SECONDS: Joi.number().integer().min(1).default(3600),
  QF_CACHE_TTL_RESOURCES_SECONDS: Joi.number().integer().min(1).default(86400),
  QF_CACHE_TTL_SEARCH_SECONDS: Joi.number().integer().min(1).default(300),
  QF_CACHE_TTL_AUDIO_SECONDS: Joi.number().integer().min(1).default(3600),

  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),

  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').optional(),
  SWAGGER_PATH: Joi.string().default('docs'),
});
