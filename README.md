# Quron Yo'li Backend

Production NestJS backend for the **Quron Yo'li** Telegram Mini App: Telegram Mini App auth, Quran.Foundation content/search proxy, reading progress, goals, favorites/bookmarks, daily Telegram reminders, and product analytics.

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 22+, npm 10+ |
| Framework | NestJS 11 + TypeScript (strict) |
| API | REST under `/api/v1`, Swagger/OpenAPI |
| Database | PostgreSQL 17 + Prisma ORM 7 (`@prisma/adapter-pg`) |
| Cache / queues | Redis 7 (`ioredis`) + BullMQ |
| Auth | Telegram `initData` HMAC + JWT access + HttpOnly refresh cookies |
| Logging | Pino (`nestjs-pino`) with daily rotating files in production |
| Hardening | Helmet, compression, global throttling, request timeouts, Joi env validation |
| Packaging | Multi-stage Dockerfile + Docker Compose v2 |

## Requirements

- Node.js 22+ (see `.nvmrc`)
- npm 10+
- PostgreSQL and Redis (local installs or Compose)
- Telegram Bot token and Quran.Foundation OAuth client credentials

## Quick start

### Production (Ubuntu)

```bash
# Upload a ready .env to the repo root on the server, then:
./scripts/deploy.sh
# or: npm run deploy:prod
```

Later updates: `./scripts/update.sh`. Ops cheat sheet: [docs/ops-runbook.md](docs/ops-runbook.md). Also [README_DEPLOYMENT.md](README_DEPLOYMENT.md) and [README_DOCKER.md](README_DOCKER.md).

### Local development

```bash
cp .env.example .env
# Fill required secrets (Telegram, QF, JWT, REDIS_PASSWORD)
npm install
npx prisma generate
docker compose up -d postgres redis
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

| URL | Purpose |
| --- | --- |
| `http://localhost:3000/api/v1` | API base |
| `http://localhost:3000/docs` | Swagger UI (when `SWAGGER_ENABLED` is true) |
| `http://localhost:3000/api/v1/health` | Readiness (Postgres + Redis) |
| `http://localhost:3000/api/health` | Unversioned readiness alias |
| `http://localhost:3000/api/v1/health/live` | Liveness |

Full-stack Compose (API + Postgres + Redis):

```bash
cp .env.example .env
docker compose up --build -d
docker compose --profile dev up -d   # optional: pgAdmin + Redis Insight
```

**Docker notes**

- Entrypoint runs `prisma migrate deploy` → idempotent seed → `node dist/main.js`.
- Production compose (`-f docker-compose.yml`) does **not** publish Postgres/Redis ports.
- Compose overrides `DATABASE_URL` / `REDIS_HOST` to service DNS (`postgres`, `redis`). Local `npm run start:dev` should point at `localhost`.
- `POSTGRES_*` variables seed the Compose Postgres image only; the app always uses `DATABASE_URL`.
- `REDIS_PASSWORD` is required for Compose and for `NODE_ENV=production`.

## Scripts

| Script | Description |
| --- | --- |
| `npm run start:dev` | Nest watch mode |
| `npm run start:debug` | Watch + debugger |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | `node dist/main.js` |
| `npm run lint` | ESLint with `--fix` |
| `npm run test` | Unit tests (Jest) |
| `npm run test:e2e` | E2E tests |
| `npm run test:cov` | Coverage |
| `npm run prisma:generate` | Generate Prisma Client → `src/generated/prisma` |
| `npm run prisma:migrate:dev` | Create/apply migrations (dev) |
| `npm run prisma:migrate:deploy` | Apply migrations (prod/CI) |
| `npm run prisma:studio` | Prisma Studio |
| `npm run prisma:validate` | Validate schema |
| `npm run qf:discover` | Sample Quran.Foundation discovery (`scripts/qf-discovery-sample.ts`) |
| `npm run qf:sync-catalog` | Upsert QF translation/tafsir/recitation catalogs into Postgres |
| `npm run qf:sync-catalog:prod` | Same sync against compiled `dist/commands/qf-sync-catalog.js` |
| `npm run check` | `lint` + `test` + `prisma:validate` + `build` |

CI (`.github/workflows/ci.yml`) mirrors `check` after `npm ci` and `prisma generate`.

## Architecture summary

```
src/
  config/           # Typed configuration + Joi validation
  common/           # Cross-cutting filters, interceptors, pagination, errors
  infrastructure/   # JWT, Prisma, Redis, BullMQ root, throttling
  modules/          # Feature modules (controllers → services → repositories)
```

| Module | Responsibility |
| --- | --- |
| `auth` | Telegram login, refresh rotation, logout, sessions |
| `users` | Current user profile (`GET /users/me`) |
| `settings` | Locale, timezone, theme, playback, default QF resources |
| `quran` | Quran.Foundation Content v4 + Search v1 proxy, Redis cache, per-user rate limit |
| `reading` | Continue/recent/history/progress/streak/statistics; ayah-open writes |
| `favorites` | Per-ayah favorites CRUD (keyset pagination) |
| `bookmarks` | Soft-deletable bookmarks CRUD (keyset pagination) |
| `goals` | Daily VERSES / MINUTES goals + progress |
| `telegram` | Bot webhook, Mini App / share deep links (`TELEGRAM_API` DI) |
| `notifications` | Daily reminder preferences + BullMQ scan/delivery |
| `analytics` | Event ingest, Redis buffer flush, statistics |
| `health` | Liveness / readiness probes |

Dependency injection tokens of note: `TELEGRAM_API`, `QURAN_FOUNDATION_CLIENT` (see [docs/architecture.md](docs/architecture.md)).

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/architecture.md](docs/architecture.md) | Boundaries, flows, DI, errors, caching, scaling |
| [docs/folder-structure.md](docs/folder-structure.md) | Tree and conventions |
| [docs/rest-api.md](docs/rest-api.md) | Auth, envelope, pagination, full route inventory |
| [docs/environment.md](docs/environment.md) | Env vars, Joi defaults, secrets |
| [docs/deployment.md](docs/deployment.md) | Build, migrate, probes, cookies, rollback |
| [docs/ops-runbook.md](docs/ops-runbook.md) | Production ops: restart/update, Caddy/HTTPS, DB repair |
| [docs/docker.md](docs/docker.md) | Dockerfile, Compose, troubleshooting |
| [docs/database-schema.md](docs/database-schema.md) | ERD, cascades, soft delete, SQL constraints |
| [docs/quran-foundation.md](docs/quran-foundation.md) | QF proxy ops |
| [docs/qf-integration-contract.md](docs/qf-integration-contract.md) | QF shapes / contract |
| [docs/qf-resource-ids.md](docs/qf-resource-ids.md) | Curated resource IDs |
| [docs/telegram.md](docs/telegram.md) | Bot, webhook, reminders |
| [docs/analytics.md](docs/analytics.md) | Product analytics |
| [docs/production.md](docs/production.md) | Production hardening notes |
| [docs/future-improvements.md](docs/future-improvements.md) | Prioritized follow-ups |

## Configuration

All runtime settings are validated at boot via `ConfigModule` + Joi (`src/config/env.validation.ts`). Start from [`.env.example`](.env.example); see [docs/environment.md](docs/environment.md).

Required secrets (placeholders only in `.env.example`):

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (min 32 chars)
- `DATABASE_URL`, `REDIS_HOST`
- `QF_CLIENT_ID`, `QF_CLIENT_SECRET`
- `TELEGRAM_MINI_APP_URL`

Do not invent or commit real secret values from a local `.env`.
