# Architecture

How the Quron Yo'li backend is structured: module boundaries, request paths, dependency injection, error model, caching, observability, and scaling notes.

For folder layout see [folder-structure.md](./folder-structure.md). For HTTP contracts see [rest-api.md](./rest-api.md). Domain details live in [quran-foundation.md](./quran-foundation.md), [telegram.md](./telegram.md), and [analytics.md](./analytics.md).

## Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│  HTTP (Nest)  Controllers + ValidationPipe + Guards         │
├─────────────────────────────────────────────────────────────┤
│  Feature modules (auth, quran, reading, …)                  │
│    services → repositories / clients                        │
├──────────────┬──────────────────────┬───────────────────────┤
│  common/     │  infrastructure/     │  config/              │
│  filters,    │  JWT, Prisma, Redis, │  Joi + typed loaders  │
│  interceptors│  BullMQ root,        │                       │
│  pagination  │  throttler           │                       │
└──────────────┴──────────────────────┴───────────────────────┘
         │                │                    │
         ▼                ▼                    ▼
   PostgreSQL          Redis              External APIs
   (Prisma)         (cache + BullMQ)   Telegram · Quran.Foundation
```

**Rules of thumb**

- Controllers stay thin: DTO validation, auth context, delegation.
- Feature modules own their repositories and outbound clients; they do not import other modules’ repositories.
- Cross-cutting concerns (envelope, errors, timeouts, HTTP cache headers, global throttle) live in `common/` + `AppModule` providers.
- Shared infrastructure (DB, Redis, JWT) is global via `infrastructure/*` modules.
- Quran Arabic/translation/tafsir/audio **content is never persisted**; only coordinates and QF resource catalog metadata are stored (see [database-schema.md](./database-schema.md)).

## Request flow

```
Client
  → Helmet / compression / cookie-parser / body parsers
  → CORS (credentials + allowlist)
  → Global prefix `api` + URI version `v1`
  → AppThrottlerGuard (user id or IP; SkipThrottle on health + webhook)
  → JwtAuthGuard (global; @Public() bypass)
  → TimeoutInterceptor → HttpCacheInterceptor → handler
  → ResponseInterceptor wraps success payload
  → GlobalExceptionFilter on errors
```

Request IDs: clients may send `x-request-id`; otherwise the server generates a UUID and echoes it on the response and in logs.

## Auth flow

```
POST /api/v1/auth/telegram { initData }
  → verify Telegram HMAC + auth_date age
  → upsert User + UserSettings defaults
  → create UserSession (SHA-256 hashed refresh token)
  → access JWT in JSON body; refresh JWT as HttpOnly cookie

POST /api/v1/auth/refresh  (cookie)
  → verify refresh JWT → load session → constant-time hash compare
  → rotate refresh hash; reuse detection revokes session

POST /api/v1/auth/logout   (Bearer)
  → revoke session by `sid` claim; clear cookie
```

Access tokens carry `sub` (user id), `sid` (session id), `typ: 'access'`. The global JWT strategy validates signature/claims only; it does **not** currently re-check session liveness or `User.isActive` on every request (see [future-improvements.md](./future-improvements.md)).

Refresh cookies are scoped to `AUTH_COOKIE_PATH` (default `/api/v1/auth`), hashed at rest, and rotated on every refresh.

## Data flow (reading / goals)

```
GET /api/v1/quran/ayahs/by-key/:verseKey
  → QuranService.getAyahByKeyForUser
  → QF content fetch (+ Redis cache)
  → ReadingService.recordAyahOpen  (side effect on GET)
       → ReadingAyahHistory append
       → ReadingProgress upsert
       → ReadingVerseProgress upsert
       → ReadingDay.versesRead++  (activeSeconds left at 0)
       → DailyGoalResult sync for VERSES metrics
  → AnalyticsTrackingService AYAH_OPEN (buffered)
```

`ReadingHistory` (session-bounded model) exists in Prisma but has **no writers/readers** yet. History APIs use `ReadingAyahHistory`.

`MINUTES` goals read `ReadingDay.activeSeconds`, which ayah opens never increment — progress stays 0 until an active-seconds writer exists.

## Queue flow

Two BullMQ queues share the Redis connection from `BullRootModule`:

| Queue (default name) | Jobs | Owner |
| --- | --- | --- |
| `daily-reminders` | `scan-due-reminders` (cron), `deliver-daily-reminder` | Notifications |
| `analytics-flush` | `flush-analytics-buffer` | Analytics |

Reminder path:

```
ReminderScanService (repeatable cron)
  → findDueReminders(localTime candidates)
  → enqueue deliver job with stable jobId per user/localDate
  → NotificationService sends via TELEGRAM_API
  → NotificationDelivery unique (userId, type, localDate) for idempotency
```

Analytics path:

```
track() → Redis list buffer → delayed flush job → createMany(skipDuplicates)
```

Workers are skipped when `NODE_ENV=test`. Graceful shutdown drains queues (`SHUTDOWN_DRAIN_MS`) via `QueueShutdownService`.

## Quran.Foundation flow

```
QuranController (+ QuranRateLimitGuard Redis per user)
  → QuranService
  → QuranCacheService (namespaced Redis JSON, TTL by resource class)
  → QuranFoundationClient (Axios keep-alive, retries)
  → QuranFoundationTokenService (separate content / search OAuth tokens)
  → Quran.Foundation APIs
```

Runtime client still returns mostly `Promise<unknown>` passthrough. Typed contracts under `src/modules/quran/contracts/` are design-only until wired (see [qf-integration-contract.md](./qf-integration-contract.md)).

## DI rules

| Token | Binding | Consumers |
| --- | --- | --- |
| `TELEGRAM_API` (`Symbol`) | `TelegramHttpApi` (`useClass`) | Bot service, webhook bootstrap, notifications delivery |
| `QURAN_FOUNDATION_CLIENT` (`Symbol`) | `useExisting: QuranFoundationClient` | Exported for typed injection; service currently uses the concrete class |

Prefer injecting the Symbol tokens at module boundaries so implementations can be swapped in tests without importing Axios clients.

Keep-alive HTTP modules are created via `createKeepAliveHttpModule` with socket caps from `TELEGRAM_HTTP_MAX_SOCKETS` / `QF_HTTP_MAX_SOCKETS`.

## Error model

Success envelope (`ResponseInterceptor`):

```json
{
  "success": true,
  "data": {},
  "timestamp": "ISO-8601",
  "path": "/api/v1/...",
  "requestId": "uuid"
}
```

Error envelope (`GlobalExceptionFilter`):

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "…",
  "code": "VALIDATION_FAILED",
  "timestamp": "ISO-8601",
  "path": "/api/v1/...",
  "requestId": "uuid"
}
```

Stable `code` values (`AppErrorCode` in `src/common/errors/app-error.ts`):

| Code | Typical HTTP |
| --- | --- |
| `VALIDATION_FAILED` | 400 / 422 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `RATE_LIMITED` | 429 |
| `UPSTREAM_ERROR` | mapped from Telegram/QF failures |
| `INTERNAL_ERROR` | 5xx (message scrubbed in production) |

HTTP status remains the primary wire contract; `code` is for clients and logs. Prefer `AppHttpException` when throwing domain errors with an explicit code.

## Caching

| Layer | Behavior |
| --- | --- |
| HTTP `Cache-Control` | Default `private, no-store`; stable Quran GETs use `@HttpCache('private-short')` → `private, max-age=60` + `Vary: Authorization` |
| Quran Redis cache | Path/query keyed JSON; TTLs from `QF_CACHE_TTL_*` |
| Analytics stats | Optional micro-cache `ANALYTICS_STATS_CACHE_TTL_SECONDS` (default 30) |
| QF OAuth tokens | In-memory with skew (`QF_TOKEN_SKEW_SECONDS`) |

## Observability

- Structured Pino logs; pretty transport in non-production.
- Redaction of `authorization`, `cookie`, and `x-api-key` headers.
- Slow-request warnings above `SLOW_REQUEST_MS`.
- Terminus health: `live` (no deps), `ready` / `health` (Postgres + Redis).
- No Prometheus/OpenTelemetry exporters yet — see [future-improvements.md](./future-improvements.md).

## Scaling notes

- Stateless API processes behind a reverse proxy (`TRUST_PROXY=true`).
- Horizontal scale: share Postgres + Redis; BullMQ workers run in-process today (same containers compete on queue jobs — acceptable for moderate load; split workers later if needed).
- Size `DATABASE_POOL_MAX` relative to replica count × connections.
- Quran and Telegram outbound sockets are capped; raise carefully under high fan-out.
- Reminder scan is minute-cron + local-time matching; large preference sets may need indexed/windowed scans (future work).
- Auth throttle (`THROTTLE_AUTH_LIMIT`) is applied on login/refresh; global throttle tracks authenticated `userId` when present.
