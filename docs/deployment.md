# Deployment

Operational guide for building, migrating, running, and rolling back the API. Hardening details (pools, timeouts, throttle behavior) live in [production.md](./production.md). Container specifics: [docker.md](./docker.md). Env reference: [environment.md](./environment.md).

## Build / migrate / start

### Local / VM (Node process)

```bash
cp .env.example .env   # populate secrets for the target environment
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy
npm run start:prod     # node dist/main.js
```

### Docker image

```bash
docker build -t quron-yoli-api .
# Provide DATABASE_URL, REDIS_*, JWT_*, Telegram, QF, etc. at runtime
docker run --env-file .env -p 3000:3000 quron-yoli-api
```

Image `CMD` is:

```sh
npx prisma migrate deploy && node dist/main.js
```

Migrations therefore run on **every container start** before the Nest process binds the port. Ensure the DB is reachable and the migrate role can apply DDL.

### Compose

```bash
cp .env.example .env
docker compose up --build -d
```

Compose overrides `DATABASE_URL` and Redis host for the `api` service. See [docker.md](./docker.md).

## Health probes

| Probe | Path | Use |
| --- | --- | --- |
| Liveness | `GET /api/v1/health/live` | Process up; Dockerfile `HEALTHCHECK` |
| Readiness | `GET /api/v1/health/ready` | Postgres + Redis |
| Compatibility | `GET /api/v1/health` | Same as ready (Compose healthcheck) |

Orchestrators should use **live** for restart decisions and **ready** for load-balancer membership.

## `TRUST_PROXY`

Set `TRUST_PROXY=true` when the app sits behind nginx, Cloudflare, ALB, etc. This enables Express `trust proxy` so:

- Client IP for throttling and auth context comes from `X-Forwarded-For`
- Secure cookies behave correctly when TLS terminates upstream

Leave `false` for direct local binding.

## Cookies

Refresh token cookie settings (`AUTH_COOKIE_*`):

| Concern | Guidance |
| --- | --- |
| Path | Default `/api/v1/auth` — browser only sends cookie to auth routes |
| Secure | Enable in production (HTTPS Mini App / web clients) |
| SameSite | `lax` default; `none` requires `Secure` and cross-site setups |
| Domain | Set only when sharing across subdomains |

CORS must allow credentials and list Mini App / web origins in `CORS_ORIGINS`.

## Webhook TLS

Telegram webhooks require a public **HTTPS** URL (`TELEGRAM_WEBHOOK_URL`).

1. Terminate TLS at the reverse proxy / load balancer.
2. Forward to the API (HTTP OK on the private network).
3. Set `TELEGRAM_WEBHOOK_SECRET` and configure Telegram with the same secret header value.
4. Optionally set `TELEGRAM_WEBHOOK_AUTO_REGISTER=true` so boot calls `setWebhook`.

Never expose the bot token or webhook secret in logs (Pino redacts common auth headers; still avoid logging bodies that contain tokens).

### Local HTTPS with ngrok

Use ngrok when you need Telegram to reach a laptop API:

```bash
# 1) API on PORT (example 3001)
npm run build && npm run start:prod

# 2) Public HTTPS edge
ngrok http 3001

# 3) Point env at the ngrok origin (ephemeral on free plans)
TELEGRAM_WEBHOOK_URL=https://<ngrok-host>/api/v1/telegram/webhook
TELEGRAM_WEBHOOK_AUTO_REGISTER=true
TRUST_PROXY=true
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=none

# 4) Restart Nest so bootstrap re-registers setWebhook
#    or call Telegram setWebhook manually with the same secret_token
```

Notes:

- Free ngrok URLs change when the tunnel restarts. Update `.env` and re-register the webhook every time.
- Verify with Telegram `getWebhookInfo` (`pending_update_count` should settle at 0 with no `last_error_message`).
- Local health remains on `http://127.0.0.1:3001/api/v1/health`; public checks go through the ngrok HTTPS URL (send `ngrok-skip-browser-warning: true` for curl).

### Quran catalog sync after migrate

`PATCH /settings` validates translation/tafsir/reciter IDs against local Postgres catalogs. Populate them after migrate (not on Nest boot):

```bash
npx prisma migrate deploy
npm run qf:sync-catalog          # or npm run qf:sync-catalog:prod after build
```

The sync upserts QF `/resources/translations`, `/resources/tafsirs`, and `/resources/recitations` (ayah audio → `quran_reciters`), then marks missing upstream IDs `is_active=false` without deleting rows.

## Rollout checklist

1. Apply config secrets in the secret store / env.
2. Deploy new image or artifact.
3. Confirm migrate succeeds (container logs or explicit `prisma migrate deploy`).
4. Run `npm run qf:sync-catalog` (or the prod dist script) so settings catalogs are populated.
5. Wait for readiness (`/health/ready`).
6. Smoke: auth telegram (staging), health, one Quran GET, reminder preference if used.
7. Watch error rate and slow-request logs.

## Rollback

1. Point the load balancer / orchestrator at the previous image/revision.
2. Prefer **forward-compatible** migrations (additive columns/indexes). If a migration is not backward-compatible, restore DB from backup **before** restarting old app code, or ship a compensating migration.
3. Prisma migrate history is append-only — do not delete applied migration folders from production history.
4. Redis is ephemeral for cache/queues; flushing is safe but may delay reminder/analytics flush briefly.

## Related

- [production.md](./production.md) — pools, throttle, timeouts, HTTP cache, graceful shutdown
- [docker.md](./docker.md) — image stages and Compose
- [telegram.md](./telegram.md) — webhook and reminders
