# Product Analytics

Authenticated product-event ingestion, server-side action hooks, Redis/BullMQ buffered writes, and per-user statistics over `AnalyticsEvent`.

## Event catalog

| Event | Source of truth |
| --- | --- |
| `APP_OPEN` | Client ingest |
| `SURAH_OPEN` | Client ingest |
| `AUDIO_PLAY` | Client ingest |
| `SHARE` | Client ingest only (building a share URL is not proof of sharing) |
| `AYAH_OPEN` | Server hook after successful reading record |
| `FAVORITE_ADDED` | Server hook after successful favorite create |
| `BOOKMARK_ADDED` | Server hook after successful bookmark create |
| `TRANSLATION_CHANGE` | Server hook after settings change that updates default translation |
| `SEARCH` | Server hook after successful Quran search |
| `DAILY_AYAH` | Server hook after successful Daily Ayah retrieval |

`AnalyticsEvent.eventName` remains a string in the database for schema evolution. The allowlist is enforced in DTO/service validation.

## Client ingestion

Authenticated endpoints:

- `POST /api/v1/analytics/events` — single event
- `POST /api/v1/analytics/events/batch` — bounded batch (default max 100)

`userId` is always taken from the JWT. Optional client fields: `sessionId`, `deviceId`, `occurredAt`, `idempotencyKey`, and event-specific `properties`.

Rejected payloads include unknown event names, unknown property keys, future timestamps beyond clock skew, oversized JSON, and invalid Quran coordinates.

Writes use `createMany({ skipDuplicates: true })` in chunks. Responses report `{ accepted, duplicates }` so retries are safe.

## Server tracking buffer

`AnalyticsTrackingService.track()` serializes typed events into a Redis list and schedules one delayed BullMQ flush job per short time bucket (stable job ID). The flush worker claims buffered items, inserts with `skipDuplicates`, and restores the buffer on transient DB failure.

Workers are skipped when `NODE_ENV=test`. Feature-module unit/e2e tests should mock `AnalyticsTrackingService`.

## Statistics

`GET /api/v1/analytics/statistics?from=&to=&timezone=`

- Date range is required and capped at 366 days
- Returns totals, counts by event, daily series, unique active days, top surahs/ayahs, search/share/audio counts, and first/last timestamps for the authenticated user only

Composite index `(user_id, event_name, occurred_at)` supports filtered aggregations.

## Privacy

Allowed property keys are compact IDs and aggregates (chapter/verse, audio position/duration, query length/result count, share target/source). Never store tokens, raw Telegram payloads, request headers, or Quran response bodies.

## Configuration

See `.env.example` `ANALYTICS_*` keys for batch size, clock skew, Redis buffer TTL, flush delay, DB chunk size, queue retries, and property size limits.
