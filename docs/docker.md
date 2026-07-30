# Docker

How the production image and Compose stack are wired for Quron Yo'li.

## Dockerfile stages

Multi-stage build (`Dockerfile`), Node **22** Alpine:

| Stage | Purpose |
| --- | --- |
| `base` | `WORKDIR /app`, `libc6-compat` + `openssl` |
| `deps` | Copy `package.json` / lockfile / `prisma` / `prisma.config.ts`, `npm ci` |
| `build` | Copy sources, `prisma generate`, `npm run build`, `npm prune --omit=dev` |
| `production` | Non-root `nestjs` user, copy runtime artifacts, healthcheck, CMD |

Production image copies:

- `package.json`, `package-lock.json`, pruned `node_modules`
- `dist/`
- `prisma/` + `prisma.config.ts`
- `src/generated` → **`dist/generated`** (Prisma Client path expected at runtime)

Exposed port: **3000**.

### Healthcheck

```
wget -qO- http://127.0.0.1:3000/api/v1/health/live
```

Interval 30s, timeout 5s, start period 40s, 3 retries.

### CMD

```sh
npx prisma migrate deploy && node dist/main.js
```

Important:

- Nest emits `dist/main.js` — `package.json` `start:prod` matches this. The generated Prisma client is copied to `dist/generated/prisma`, which is where the compiled `dist/infrastructure/database/prisma.service.js` resolves `../../generated/prisma`.
- Migrations run on every container start. Failed migrate prevents the API from starting (fail closed).

## Compose services

File: [`docker-compose.yml`](../docker-compose.yml).

| Service | Image / build | Role |
| --- | --- | --- |
| `postgres` | `postgres:16-alpine` | Primary DB; volume `postgres_data` |
| `redis` | `redis:7-alpine` | Cache + BullMQ; optional password; volume `redis_data` |
| `api` | Build `Dockerfile` | Nest API; depends on healthy postgres + redis |

### `api` environment overrides

Compose sets:

- `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public`
- `REDIS_HOST=redis`, `REDIS_PORT=6379`
- Plus `env_file: .env` for JWT, Telegram, QF, etc.

Host `.env` `DATABASE_URL` / `REDIS_HOST=localhost` values are **overridden** inside the `api` container. When running Nest on the host against Compose DB/Redis, keep localhost URLs in `.env` and only start `postgres` + `redis`.

### Healthchecks

| Service | Check |
| --- | --- |
| postgres | `pg_isready` |
| redis | `redis-cli ping` (with password when set) |
| api | `wget` → `/api/v1/health` (readiness alias) |

## Volumes

| Volume | Mount |
| --- | --- |
| `postgres_data` | `/var/lib/postgresql/data` |
| `redis_data` | `/data` |

Destroying volumes wipes local DB/cache state.

## Local vs production caveats

| Topic | Local Compose | Production-like |
| --- | --- | --- |
| Secrets | `.env` from `.env.example` | Secret manager / sealed env; never bake secrets into the image |
| `NODE_ENV` | Often `development` on host; Compose defaults api to `production` | `production` |
| Swagger | On by default in non-prod | Off unless `SWAGGER_ENABLED=true` |
| `TRUST_PROXY` | Usually false | `true` behind TLS terminator |
| Cookie secure | May be false locally | true / HTTPS |
| Migrate on start | Convenient | Acceptable if migrate is idempotent and DB is ready; or run migrate as a Job then start with a migrate-free CMD |
| Resource limits | Unset | Set CPU/memory; size `DATABASE_POOL_MAX` vs replica count |
| Redis password | Optional empty | Prefer requirepass |

## Common commands

```bash
# Infra only (API on host)
docker compose up -d postgres redis

# Full stack
docker compose up --build

# Logs / rebuild api
docker compose logs -f api
docker compose up --build -d api
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `api` exits immediately | Migrate failure: DB URL, credentials, network to `postgres`, migration SQL errors in logs |
| Healthcheck failing | Wait for `start_period`; confirm process listens on 3000; readiness needs Redis + Postgres |
| Auth / throttle IPs wrong | Set `TRUST_PROXY=true` behind proxy |
| Redis auth errors | `REDIS_PASSWORD` must match Compose redis `requirepass` |
| Prisma client missing | Image must include `dist/generated`; rebuild after schema changes |
| Wrong entrypoint | Use `node dist/main.js` |
| Host app cannot reach DB | Use `localhost` + published ports; do not use hostname `postgres` outside Compose network |
| Quran/Telegram timeouts | Verify egress; check `QF_*` / `TELEGRAM_*` timeouts and credentials |

See also [deployment.md](./deployment.md) and [production.md](./production.md).
