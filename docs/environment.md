# Environment

Canonical template: [`.env.example`](../.env.example).  
Validation: `src/config/env.validation.ts` (Joi).  
Typed loading: `src/config/configuration.ts`.

Do **not** copy real secrets from a local `.env` into docs or commits. Placeholders below match `.env.example` / Joi only.

## Legend

| Marker | Meaning |
| --- | --- |
| **secret** | Credential or signing material — rotate if leaked |
| **required** | No useful default; boot fails if missing (Joi/`getRequiredEnv`) |
| **compose-only** | Used by `docker-compose.yml` for the Postgres service image; the Nest app does not read these for its pool |

`allowUnknown: true` on ConfigModule — extra env keys are ignored by Joi.

## Application / HTTP

| Variable | Default (Joi / loader) | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `3000` | Listen port |
| `APP_NAME` | `quron-yoli-backend` | Log / identity |
| `API_PREFIX` | `api` | Global prefix |
| `API_VERSION` | `1` | Default URI version |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated; include `https://web.telegram.org` and the deployed Mini App origin (e.g. `https://quronyoli-front.vercel.app`) |
| `HTTP_REQUEST_TIMEOUT_MS` | `30000` | Nest timeout + Node `requestTimeout` |
| `HTTP_BODY_LIMIT` | `1mb` | JSON / urlencoded limit |
| `TRUST_PROXY` | `false` | Set `true` behind reverse proxy |
| `SLOW_REQUEST_MS` | `1000` | Warn threshold |
| `SHUTDOWN_DRAIN_MS` | `5000` | BullMQ drain on shutdown |
| `LOG_LEVEL` | `info` | Pino levels |
| `SWAGGER_ENABLED` | optional | If unset: enabled unless `NODE_ENV=production` |
| `SWAGGER_PATH` | `docs` | Swagger mount path |

## PostgreSQL

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | — | **required** — app connection string |
| `DATABASE_POOL_MAX` | `10` | `pg.Pool` max |
| `DATABASE_POOL_IDLE_TIMEOUT_MS` | `10000` | |
| `DATABASE_POOL_CONNECTION_TIMEOUT_MS` | `5000` | |
| `POSTGRES_USER` | `postgres` | **compose-only** |
| `POSTGRES_PASSWORD` | `postgres` | **compose-only** · treat as **secret** in shared envs |
| `POSTGRES_DB` | `quron_yoli` | **compose-only** |
| `POSTGRES_PORT` | `5432` | Host port mapping for Compose |

Compose builds `DATABASE_URL` for the `api` service as `postgresql://…@postgres:5432/…` from `POSTGRES_*`.

## Redis

| Variable | Default | Notes |
| --- | --- | --- |
| `REDIS_HOST` | — | **required** (`localhost` locally; `redis` in Compose) |
| `REDIS_PORT` | `6379` | |
| `REDIS_PASSWORD` | `''` | **secret** when set |
| `REDIS_DB` | `0` | |
| `REDIS_KEY_PREFIX` | `quron-yoli:` | Key namespace |

## JWT

| Variable | Default | Notes |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | — | **required** **secret** · min 32 chars |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_SECRET` | — | **required** **secret** · min 32 chars |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Also drives cookie `maxAge` |

## Telegram

| Variable | Default | Notes |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | — | **required** **secret** · min 30 |
| `TELEGRAM_BOT_USERNAME` | — | **required** |
| `TELEGRAM_API_BASE_URL` | `https://api.telegram.org` | HTTPS only |
| `TELEGRAM_TIMEOUT_MS` | `15000` | |
| `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` | `86400` | |
| `TELEGRAM_WEBHOOK_URL` | optional / `''` | HTTPS webhook URL |
| `TELEGRAM_WEBHOOK_SECRET` | — | **required** **secret** · min 16 |
| `TELEGRAM_WEBHOOK_AUTO_REGISTER` | `false` | Register webhook on boot when true |
| `TELEGRAM_MINI_APP_URL` | — | **required** HTTPS |
| `TELEGRAM_MINI_APP_SHORT_NAME` | `app` | |
| `TELEGRAM_HTTP_MAX_SOCKETS` | `50` | Keep-alive agent |

## Notifications (BullMQ)

| Variable | Default | Notes |
| --- | --- | --- |
| `NOTIFICATIONS_QUEUE_NAME` | `daily-reminders` | |
| `NOTIFICATIONS_QUEUE_CONCURRENCY` | `5` | |
| `NOTIFICATIONS_REMINDER_SCAN_CRON` | `* * * * *` | |
| `NOTIFICATIONS_MAX_ATTEMPTS` | `5` | |
| `NOTIFICATIONS_BACKOFF_DELAY_MS` | `5000` | |

## Analytics

| Variable | Default | Notes |
| --- | --- | --- |
| `ANALYTICS_MAX_BATCH_SIZE` | `100` | Client batch cap |
| `ANALYTICS_MAX_CLOCK_SKEW_SECONDS` | `300` | |
| `ANALYTICS_DB_CHUNK_SIZE` | `100` | |
| `ANALYTICS_BUFFER_TTL_SECONDS` | `3600` | |
| `ANALYTICS_FLUSH_DELAY_MS` | `2000` | |
| `ANALYTICS_FLUSH_MAX_BATCH` | `500` | |
| `ANALYTICS_QUEUE_NAME` | `analytics-flush` | |
| `ANALYTICS_MAX_ATTEMPTS` | `5` | |
| `ANALYTICS_BACKOFF_DELAY_MS` | `5000` | |
| `ANALYTICS_MAX_PROPERTIES_BYTES` | `4096` | |
| `ANALYTICS_STATS_CACHE_TTL_SECONDS` | `30` | `0` disables |

## Reading

| Variable | Default | Notes |
| --- | --- | --- |
| `READING_STREAK_LOOKBACK_DAYS` | `400` | Streak query window |

## Throttling

| Variable | Default | Notes |
| --- | --- | --- |
| `THROTTLE_TTL_MS` | `60000` | Global + auth window |
| `THROTTLE_LIMIT` | `120` | Global requests per window |
| `THROTTLE_AUTH_LIMIT` | `20` | **Wired** on `POST /auth/telegram` and `POST /auth/refresh` via `@Throttle` (reads env at controller load) |

## Auth cookie

| Variable | Default | Notes |
| --- | --- | --- |
| `AUTH_COOKIE_NAME` | `refresh_token` | |
| `AUTH_COOKIE_PATH` | `/` | Prefer `/` for cross-site Mini App refresh |
| `AUTH_COOKIE_DOMAIN` | optional / empty | Leave empty (do not set `localhost`) |
| `AUTH_COOKIE_SECURE` | optional | Loader defaults secure in production when unset |
| `AUTH_COOKIE_SAME_SITE` | `lax` | `lax` \| `strict` \| `none`; use `none` with `secure=true` for Vercel ↔ ngrok |
| `AUTH_COOKIE_PARTITIONED` | optional | Defaults to `true` when `sameSite` is `none` (CHIPS) |

## Quran.Foundation

| Variable | Default | Notes |
| --- | --- | --- |
| `QF_CLIENT_ID` | — | **required** **secret** · min 8 |
| `QF_CLIENT_SECRET` | — | **required** **secret** · min 8 |
| `QF_ENV` | `production` | `prelive` \| `production` — selects default base URLs |
| `QF_AUTH_BASE_URL` | optional override | Defaults: prod `https://oauth2.quran.foundation`; prelive `https://prelive-oauth2.quran.foundation` |
| `QF_API_BASE_URL` | optional override | Defaults: prod `https://apis.quran.foundation`; prelive `https://apis-prelive.quran.foundation` |
| `QF_CONTENT_PATH_PREFIX` | `/content/api/v4` | |
| `QF_SEARCH_PATH_PREFIX` | `/search/v1` | |
| `QF_CONTENT_SCOPE` | `content` | OAuth scope |
| `QF_SEARCH_SCOPE` | `search` | OAuth scope |
| `QF_TIMEOUT_MS` | `30000` | |
| `QF_MAX_RETRIES` | `3` | |
| `QF_RETRY_BASE_DELAY_MS` | `250` | |
| `QF_TOKEN_SKEW_SECONDS` | `30` | Refresh before expiry |
| `QF_RATE_LIMIT_MAX` | `60` | Per-user Redis limiter |
| `QF_RATE_LIMIT_WINDOW_SECONDS` | `60` | |
| `QF_HTTP_MAX_SOCKETS` | `50` | |
| `QF_CACHE_TTL_CHAPTERS_SECONDS` | `86400` | |
| `QF_CACHE_TTL_VERSES_SECONDS` | `3600` | |
| `QF_CACHE_TTL_RESOURCES_SECONDS` | `86400` | |
| `QF_CACHE_TTL_SEARCH_SECONDS` | `300` | |
| `QF_CACHE_TTL_AUDIO_SECONDS` | `3600` | |

### QF URL overrides

Leave `QF_AUTH_BASE_URL` / `QF_API_BASE_URL` unset to use environment defaults derived from `QF_ENV`. Set them only when pointing at a non-standard host.

## Secret checklist

Treat as secrets in every non-local environment:

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
- `QF_CLIENT_ID`, `QF_CLIENT_SECRET`
- `DATABASE_URL` (embeds DB password)
- `REDIS_PASSWORD` (when non-empty)
- `POSTGRES_PASSWORD` (Compose / DB bootstrap)
