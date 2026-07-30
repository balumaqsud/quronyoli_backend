# Production hardening

Operational notes for pool sizing, throttling, timeouts, health probes, and shutdown.

## Health probes

| Path | Purpose |
| --- | --- |
| `GET /api/v1/health/live` | Liveness — process is up (no dependency checks) |
| `GET /api/v1/health/ready` | Readiness — PostgreSQL + Redis |
| `GET /api/v1/health` | Alias of ready (Docker / compose compatibility) |

## Connection pooling

`DATABASE_POOL_MAX` (default 10), `DATABASE_POOL_IDLE_TIMEOUT_MS`, and `DATABASE_POOL_CONNECTION_TIMEOUT_MS` configure the `pg.Pool` used by Prisma’s driver adapter.

BullMQ uses a single shared `BullRootModule` Redis connection factory (feature modules only `registerQueue`).

Outbound Quran/Telegram HTTP clients use keep-alive agents (`QF_HTTP_MAX_SOCKETS`, `TELEGRAM_HTTP_MAX_SOCKETS`).

## Rate limiting

Global `@nestjs/throttler` (`THROTTLE_LIMIT` / `THROTTLE_TTL_MS`, default 120 / 60s). Tracked by authenticated `userId` when present, otherwise client IP.

Auth login/refresh use a stricter `@Throttle` (20 / 60s). Health and Telegram webhook skip throttling. Quran routes keep the additional Redis per-user limiter.

429 responses include `Retry-After`.

## Request timeout

`HTTP_REQUEST_TIMEOUT_MS` (default 30000) applies via a Nest interceptor and Node HTTP `requestTimeout` / `headersTimeout`. Slow requests over `SLOW_REQUEST_MS` are logged as warnings.

## HTTP caching

Default: `Cache-Control: private, no-store`. Stable Quran GETs (surahs, translations/tafsirs lists) use `@HttpCache('private-short')` → `private, max-age=60` with `Vary: Authorization`.

## Memory / queries

Reading streaks load only `localDate` within `READING_STREAK_LOOKBACK_DAYS` (default 400). Analytics statistics may be micro-cached in Redis (`ANALYTICS_STATS_CACHE_TTL_SECONDS`, default 30).

## Security

- Helmet (HSTS enabled when `NODE_ENV=production`)
- `TRUST_PROXY=true` when behind a reverse proxy
- `HTTP_BODY_LIMIT` (default `1mb`)
- Swagger off by default in production unless `SWAGGER_ENABLED=true`

## Graceful shutdown

`enableShutdownHooks()` plus `SHUTDOWN_DRAIN_MS` while closing BullMQ queues, then Redis quit and Prisma pool end.
