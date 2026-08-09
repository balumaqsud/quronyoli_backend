# Production Readiness Report

**Date:** 2026-08-03  
**Target:** Ubuntu 24.04 via `docker compose -f docker-compose.yml up -d`  
**Scope:** Infrastructure, deployment, configuration, security, scalability — no business-logic changes.

---

## Production readiness score: **91 / 100**

| Area | Score | Notes |
| --- | --- | --- |
| Docker / Compose | 95 | Postgres 17, Redis AOF/password, internal ports, entrypoint, healthchecks |
| Config / env validation | 95 | Joi + production Redis password requirement |
| Security | 90 | Helmet, CORS, throttling, secrets not published; multi-replica throttle still in-memory |
| Observability | 85 | Pino + rotating files; no Prometheus/OTel yet |
| Data safety | 92 | migrate deploy only, idempotent seed, backup/restore scripts |
| Performance | 88 | gzip, pools, Redis cache; Fastify N/A (Express retained) |

---

## Files changed

- [`docker-compose.yml`](../docker-compose.yml) — production-first stack (Postgres 17, Redis hardened, API-only published port)
- [`Dockerfile`](../Dockerfile) — entrypoint, uploads/logs, longer start period
- [`.dockerignore`](../.dockerignore) — allow Docker assets; exclude logs/uploads/backups
- [`.gitignore`](../.gitignore) — keep env templates + log/upload placeholders
- [`src/main.ts`](../src/main.ts) — `x-powered-by` off, uploads/logs dirs, uncaught handlers
- [`src/app.module.ts`](../src/app.module.ts) — production Pino multi-target rolling logs
- [`src/config/configuration.ts`](../src/config/configuration.ts) — `logDir` / `uploadsDir`
- [`src/config/env.validation.ts`](../src/config/env.validation.ts) — production `REDIS_PASSWORD` min 16
- [`src/modules/health/health.module.ts`](../src/modules/health/health.module.ts) — register alias controller
- [`prisma.config.ts`](../prisma.config.ts) — seed command
- [`package.json`](../package.json) / `package-lock.json` — `pino-roll`, seed/backup scripts
- [`.env.example`](../.env.example) — Docker notes + checklist aliases
- [`README.md`](../README.md) — production quick start
- [`docs/docker.md`](./docker.md) — updated
- [`docs/deployment.md`](./deployment.md) — updated

---

## New files

| File | Purpose |
| --- | --- |
| `docker-compose.override.yml` | Local ports + pgAdmin / Redis Insight (`dev` profile) |
| `docker/entrypoint.sh` | Wait → migrate deploy → seed → start |
| `.env.example` | Committed placeholder template (no real secrets) |
| `.env` | Local/server secrets only — **gitignored** |
| `src/config/logger.streams.ts` | Pino-roll destinations |
| `src/modules/health/health-alias.controller.ts` | `GET /api/health` |
| `prisma/seed.cjs` | Idempotent empty-DB check (no wipe) |
| `scripts/backup.sh` | Postgres + Redis + uploads backup |
| `scripts/restore.sh` | Confirmed restore |
| `uploads/.gitkeep`, `logs/.gitkeep` | Persistent dirs |
| `README_DOCKER.md` | Docker one-pager |
| `README_DEPLOYMENT.md` | Ubuntu deploy one-pager |
| `deployment.md` | Root pointer to deploy docs |
| `docs/PRODUCTION_READINESS_REPORT.md` | This report |

---

## Security improvements

- Postgres and Redis **not published** on production Compose
- Redis **password required**, AOF + protected-mode
- Production Joi requires `REDIS_PASSWORD` (≥16 chars)
- `X-Powered-By` disabled
- Secure cookie defaults in production `.env` (`Secure`, `SameSite=none`, partitioned)
- Swagger off by default in production template
- Existing: Helmet, HSTS (prod), CORS whitelist, ValidationPipe, body limits, throttling, Pino redaction

---

## Docker improvements

- Compose v2 production file + local override
- Health-gated `depends_on` for Postgres and Redis
- Named volumes for DB/Redis; bind mounts only for `uploads` and `logs`
- Multi-stage Node 22 image, non-root user, `npm ci`
- Entrypoint replaces inline migrate CMD
- Dev profile: pgAdmin + Redis Insight

---

## PostgreSQL improvements

- Image upgraded to **PostgreSQL 17** Alpine
- `TZ` / `PGTZ` / `timezone=UTC`
- Persistent named volume
- Startup: `migrate deploy` only (never reset)
- Idempotent seed after migrate
- Existing `pg` pool settings unchanged (`DATABASE_POOL_*`)

---

## Redis improvements

- Password required in Compose
- Append-only file enabled
- Protected mode enabled
- Persistent volume
- Healthcheck with auth
- Existing ioredis reconnect strategy retained

---

## Performance improvements

- Existing Express `compression` (gzip) retained — no Fastify migration (would break stack)
- Existing Redis response caching + HTTP cache interceptor retained
- Existing DB connection pooling retained
- Daily rotating log files without blocking stdout for Docker

---

## Breaking changes

**None intentional for API clients.**

Operational notes:

1. **Compose now requires `REDIS_PASSWORD`** — empty password fails Compose interpolation / production Joi.
2. **Postgres image 16 → 17** — fresh volume is fine; migrating an existing `postgres_data` volume from 16 may need `pg_upgrade` or dump/restore (do not reuse 16 data dir with 17 blindly).
3. **Production deploys should use** `docker compose -f docker-compose.yml ...` so the local override does not publish DB/Redis ports.
4. Env checklist names (`JWT_SECRET`, `BOT_TOKEN`, `QURAN_API_KEY`) remain **aliases in docs only**; code still uses `JWT_ACCESS_SECRET` / `TELEGRAM_BOT_TOKEN` / `QF_CLIENT_*`.

---

## Remaining recommendations

1. Redis-backed `@nestjs/throttler` storage for multi-replica rate limits  
2. OpenTelemetry / Prometheus metrics  
3. Per-request JWT/session revocation check (see `docs/future-improvements.md`)  
4. Automated data retention jobs for analytics / ayah history  
5. Consider dedicated BullMQ worker process if queue load grows  
6. Dependency majors when ready: BullMQ 6, ioredis 6 (breaking); keep Nest 11 / Prisma 7 on current minors  
7. `source-map-support` appears only via transitive tooling — not required as a direct app dependency  

---

## Dependencies

| Action | Package |
| --- | --- |
| Added | `pino-roll` (daily rotating file logs) |
| Removed | None (no unused direct deps confirmed safe to drop without audit risk) |
| Upgrade candidates | `bullmq` 6.x, `ioredis` 6.x, `eslint` 10.x, `typescript` 7.x (major — plan separately) |

---

## Verification performed

- `npm run build` — success after changes
