import { BadRequestException } from '@nestjs/common';
import { isValidAyahCoordinate } from '../../common/quran/quran-coordinates';
import { AnalyticsConfig } from '../../config/configuration';
import {
  ALLOWED_PROPERTY_KEYS,
  ANALYTICS_EVENT_NAME_SET,
  AnalyticsEventName,
  NormalizedAnalyticsEvent,
} from './analytics.constants';

export interface RawAnalyticsEventInput {
  eventName: string;
  occurredAt?: string | Date;
  deviceId?: string;
  sessionId?: string;
  schemaVersion?: number;
  properties?: Record<string, unknown>;
  idempotencyKey?: string;
}

export function normalizeAnalyticsEvent(
  userId: string,
  input: RawAnalyticsEventInput,
  config: AnalyticsConfig,
  now: Date = new Date(),
): NormalizedAnalyticsEvent {
  if (!ANALYTICS_EVENT_NAME_SET.has(input.eventName)) {
    throw new BadRequestException(`Unsupported eventName: ${input.eventName}`);
  }

  const eventName = input.eventName as AnalyticsEventName;
  const occurredAt = resolveOccurredAt(input.occurredAt, config, now);
  const properties = normalizeProperties(
    eventName,
    input.properties,
    config.maxPropertiesBytes,
  );

  if (input.idempotencyKey && input.idempotencyKey.length > 128) {
    throw new BadRequestException(
      'idempotencyKey must be at most 128 characters',
    );
  }

  if (input.deviceId && input.deviceId.length > 128) {
    throw new BadRequestException('deviceId must be at most 128 characters');
  }

  if (input.sessionId && input.sessionId.length > 128) {
    throw new BadRequestException('sessionId must be at most 128 characters');
  }

  return {
    userId,
    eventName,
    occurredAt,
    deviceId: input.deviceId ?? null,
    sessionId: input.sessionId ?? null,
    schemaVersion: input.schemaVersion ?? 1,
    properties,
    idempotencyKey: input.idempotencyKey ?? null,
  };
}

function resolveOccurredAt(
  value: string | Date | undefined,
  config: AnalyticsConfig,
  now: Date,
): Date {
  if (value === undefined) {
    return now;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('occurredAt must be a valid ISO date');
  }

  const skewMs = config.maxClockSkewSeconds * 1000;
  if (date.getTime() > now.getTime() + skewMs) {
    throw new BadRequestException('occurredAt is too far in the future');
  }

  const min = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000);
  if (date.getTime() < min.getTime()) {
    throw new BadRequestException('occurredAt is too far in the past');
  }

  return date;
}

function normalizeProperties(
  eventName: AnalyticsEventName,
  properties: Record<string, unknown> | undefined,
  maxBytes: number,
): Record<string, unknown> | null {
  if (!properties) {
    return null;
  }

  if (typeof properties !== 'object' || Array.isArray(properties)) {
    throw new BadRequestException('properties must be an object');
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) {
      throw new BadRequestException(`Unsupported property: ${key}`);
    }
    if (value === undefined) {
      continue;
    }
    cleaned[key] = value;
  }

  validateEventProperties(eventName, cleaned);

  const encoded = Buffer.byteLength(JSON.stringify(cleaned), 'utf8');
  if (encoded > maxBytes) {
    throw new BadRequestException('properties payload is too large');
  }

  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function validateEventProperties(
  eventName: AnalyticsEventName,
  properties: Record<string, unknown>,
): void {
  const chapter = properties.chapterNumber;
  const verse = properties.verseNumber;

  if (chapter !== undefined || verse !== undefined) {
    if (typeof chapter !== 'number' || typeof verse !== 'number') {
      throw new BadRequestException(
        'chapterNumber and verseNumber must both be numbers when provided',
      );
    }
    if (!isValidAyahCoordinate(chapter, verse)) {
      throw new BadRequestException('Invalid ayah coordinate in properties');
    }
  }

  if (
    properties.verseKey !== undefined &&
    typeof properties.verseKey !== 'string'
  ) {
    throw new BadRequestException('verseKey must be a string');
  }

  if (
    (eventName === 'AYAH_OPEN' ||
      eventName === 'FAVORITE_ADDED' ||
      eventName === 'BOOKMARK_ADDED' ||
      eventName === 'DAILY_AYAH') &&
    chapter === undefined &&
    properties.verseKey === undefined
  ) {
    // Server hooks always set coordinates; client may omit for some events.
  }

  if (
    properties.queryLength !== undefined &&
    (typeof properties.queryLength !== 'number' || properties.queryLength < 0)
  ) {
    throw new BadRequestException('queryLength must be a non-negative number');
  }

  if (
    properties.resultCount !== undefined &&
    (typeof properties.resultCount !== 'number' || properties.resultCount < 0)
  ) {
    throw new BadRequestException('resultCount must be a non-negative number');
  }
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
