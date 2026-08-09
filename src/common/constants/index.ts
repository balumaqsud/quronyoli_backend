export const CONFIG_KEYS = {
  APP: 'app',
  DATABASE: 'database',
  REDIS: 'redis',
  JWT: 'jwt',
  TELEGRAM: 'telegram',
  NOTIFICATIONS: 'notifications',
  ANALYTICS: 'analytics',
  READING: 'reading',
  HTTP: 'http',
  THROTTLE: 'throttle',
  AUTH_COOKIE: 'authCookie',
  QURAN_FOUNDATION: 'quranFoundation',
  QURANENC: 'quranEnc',
  SUPER_ADMIN: 'superAdmin',
} as const;

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const REQUEST_ID_HEADER = 'x-request-id';
export const TELEGRAM_WEBHOOK_SECRET_HEADER = 'x-telegram-bot-api-secret-token';

export const TELEGRAM_API = Symbol('TELEGRAM_API');
export const QURAN_FOUNDATION_CLIENT = Symbol('QURAN_FOUNDATION_CLIENT');

export const NOTIFICATION_QUEUES = {
  DAILY_REMINDERS: 'daily-reminders',
} as const;

export const NOTIFICATION_JOBS = {
  SCAN_DUE_REMINDERS: 'scan-due-reminders',
  DELIVER_DAILY_REMINDER: 'deliver-daily-reminder',
} as const;

export const ANALYTICS_QUEUES = {
  FLUSH: 'analytics-flush',
} as const;

export const ANALYTICS_JOBS = {
  FLUSH_BUFFER: 'flush-analytics-buffer',
} as const;
