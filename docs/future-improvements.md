# Future improvements

Prioritized follow-ups grounded in current code behavior. Highest items first.

## P0 — Correctness / product gaps

### 1. `GET` ayah-by-key side effect

`GET /api/v1/quran/ayahs/by-key/:verseKey` calls `QuranService.getAyahByKeyForUser`, which fetches content then `ReadingService.recordAyahOpen`. The GET is intentionally non-idempotent for Mini App compatibility, but it complicates caching, CDN, retries, and HTTP semantics.

**Direction:** Keep a dedicated write path (e.g. `POST /reading/ayah-opens`) and make the GET read-only, or document + gate the side effect behind an explicit query flag during a client migration window.

### 2. `MINUTES` goals need `activeSeconds` writers

Goals progress maps:

- `VERSES` ← `ReadingDay.versesRead` (incremented on ayah open)
- `MINUTES` ← `floor(ReadingDay.activeSeconds / 60)`

Ayah-open transactions create/update `ReadingDay` with `activeSeconds: 0` and never increment it. Session-based `ReadingHistory` is unused. Until a writer exists (heartbeat, session end, or client-reported active seconds), **MINUTES goals always show 0 progress**.

### 3. JWT session liveness cache

`JwtStrategy.validate` only checks access-token claims. Revoked sessions and deactivated users (`isActive` / `deletedAt`) remain valid until access JWT expiry unless refresh/logout paths are hit.

**Direction:** On each authenticated request (or sampled), resolve `sid` against Redis with short TTL fallback to `UserSession` + user flags; invalidate cache on revoke/logout/disable.

## P1 — Operability

### 4. OpenAPI export

Swagger is served when enabled, but there is no CI artifact exporting `openapi.json` for clients/codegen.

**Direction:** Add a build/script step (`SwaggerModule.createDocument` → write file) and publish or commit the artifact as needed.

### 5. Metrics and tracing

Today: Pino logs, health probes, slow-request warnings. No Prometheus metrics or OpenTelemetry traces for QF latency, queue lag, throttle hits, or DB pool saturation.

**Direction:** RED metrics on HTTP + outbound clients; queue depth/age gauges; optional OTel exporter behind env flags.

### 6. Reminder scan efficiency

`ReminderScanService` runs every minute, loads due preferences for candidate local times, then filters by user timezone minute. At large scale this becomes a hot path.

**Direction:** Index/window by timezone buckets, or precompute next-fire UTC and query `WHERE next_fire_at <= now()`.

## P2 — Data lifecycle & QF typing

### 7. Retention for analytics and ayah history

`AnalyticsEvent` and `ReadingAyahHistory` are append-heavy with no retention job. Indexes help reads but storage and vacuum cost grow unbounded.

**Direction:** Time-based partitioning or scheduled prune (e.g. keep N days raw + rollups), documented retention SLAs.

### 8. Typed Quran.Foundation client wiring

Design contracts exist under `src/modules/quran/contracts/` and [qf-integration-contract.md](./qf-integration-contract.md), but runtime still passthrough-types as `Promise<unknown>`. `QURAN_FOUNDATION_CLIENT` is exported; services should inject the Symbol and return typed DTOs at the Nest boundary.

**Direction:** Wire interface → client methods → controller response DTOs incrementally (resources first, then verses/search).

## Parking lot (lower urgency)

- Split BullMQ workers into dedicated processes for horizontal scale.
- Migrate-as-Job separate from API `CMD` for stricter deploy control.
- Soft-delete / trash APIs for bookmarks beyond current soft delete.
- Wire `ReadingHistory` session sync if the Mini App needs bounded sessions distinct from ayah-open events.
