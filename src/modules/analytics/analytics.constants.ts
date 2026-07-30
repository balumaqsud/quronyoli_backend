export const ANALYTICS_EVENT_NAMES = [
  'APP_OPEN',
  'SURAH_OPEN',
  'AYAH_OPEN',
  'TRANSLATION_CHANGE',
  'AUDIO_PLAY',
  'FAVORITE_ADDED',
  'BOOKMARK_ADDED',
  'SEARCH',
  'SHARE',
  'DAILY_AYAH',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const ANALYTICS_EVENT_NAME_SET = new Set<string>(ANALYTICS_EVENT_NAMES);

/** Events that are authoritative when emitted by the server after a successful action. */
export const SERVER_AUTHORITATIVE_EVENTS = new Set<AnalyticsEventName>([
  'AYAH_OPEN',
  'FAVORITE_ADDED',
  'BOOKMARK_ADDED',
  'TRANSLATION_CHANGE',
  'SEARCH',
  'DAILY_AYAH',
]);

/** Events that should primarily come from the authenticated client. */
export const CLIENT_AUTHORITATIVE_EVENTS = new Set<AnalyticsEventName>([
  'APP_OPEN',
  'SURAH_OPEN',
  'AUDIO_PLAY',
  'SHARE',
]);

export const ALLOWED_PROPERTY_KEYS = new Set([
  'chapterNumber',
  'verseNumber',
  'verseKey',
  'translationId',
  'previousTranslationId',
  'reciterId',
  'audioPositionMs',
  'audioDurationMs',
  'queryLength',
  'resultCount',
  'shareTarget',
  'shareSource',
  'localDate',
  'timezone',
  'source',
]);

export interface NormalizedAnalyticsEvent {
  userId: string;
  eventName: AnalyticsEventName;
  occurredAt: Date;
  deviceId?: string | null;
  sessionId?: string | null;
  schemaVersion: number;
  properties?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
}
