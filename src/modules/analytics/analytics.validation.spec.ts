import { BadRequestException } from '@nestjs/common';
import { AnalyticsConfig } from '../../config/configuration';
import { chunkArray, normalizeAnalyticsEvent } from './analytics.validation';

const config: AnalyticsConfig = {
  maxBatchSize: 100,
  maxClockSkewSeconds: 300,
  dbChunkSize: 50,
  bufferTtlSeconds: 3600,
  flushDelayMs: 2000,
  flushMaxBatch: 500,
  queueName: 'analytics-flush',
  maxAttempts: 5,
  backoffDelayMs: 5000,
  maxPropertiesBytes: 4096,
};

describe('analytics.validation', () => {
  const now = new Date('2026-07-30T12:00:00.000Z');

  it('normalizes an allowlisted event', () => {
    const event = normalizeAnalyticsEvent(
      'user-1',
      {
        eventName: 'APP_OPEN',
        sessionId: 's1',
        properties: { source: 'home' },
      },
      config,
      now,
    );

    expect(event).toMatchObject({
      userId: 'user-1',
      eventName: 'APP_OPEN',
      sessionId: 's1',
      schemaVersion: 1,
      properties: { source: 'home' },
    });
  });

  it('rejects unknown event names', () => {
    expect(() =>
      normalizeAnalyticsEvent(
        'user-1',
        { eventName: 'UNKNOWN_EVENT' },
        config,
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects unknown property keys', () => {
    expect(() =>
      normalizeAnalyticsEvent(
        'user-1',
        {
          eventName: 'SHARE',
          properties: { authorization: 'secret' },
        },
        config,
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects future timestamps beyond clock skew', () => {
    expect(() =>
      normalizeAnalyticsEvent(
        'user-1',
        {
          eventName: 'APP_OPEN',
          occurredAt: '2026-07-30T13:00:00.000Z',
        },
        config,
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid ayah coordinates', () => {
    expect(() =>
      normalizeAnalyticsEvent(
        'user-1',
        {
          eventName: 'SURAH_OPEN',
          properties: { chapterNumber: 2, verseNumber: 9999 },
        },
        config,
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects oversized properties payloads', () => {
    const tinyConfig = { ...config, maxPropertiesBytes: 20 };
    expect(() =>
      normalizeAnalyticsEvent(
        'user-1',
        {
          eventName: 'SEARCH',
          properties: {
            queryLength: 1,
            resultCount: 2,
            source: 'x'.repeat(50),
          },
        },
        tinyConfig,
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('chunks arrays for createMany writes', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
