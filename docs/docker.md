# Docker

How the production image and Compose stack are wired for Quron Yo'li.

Root quick reference: [README_DOCKER.md](../README_DOCKER.md).

## Dockerfile stages

Multi-stage build (`Dockerfile`), Node **22** Alpine:

| Stage | Purpose |
| --- | --- |
| `base` | `WORKDIR /app`, `libc6-compat` + `openssl` |
| `deps` | Copy `package.json` / lockfile / `prisma` / `prisma.config.ts`, `npm ci` |
| `build` | Copy sources, `prisma generate`, `npm run build`, `npm prune --omit=dev` |
| `production` | Non-root `nestjs` user, `uploads`/`logs` dirs, entrypoint, healthcheck |

Production image copies:

- `package.json`, `package-lock.json`, pruned `node_modules`
- `dist/`
- `prisma/` (including `seed.cjs`) + `prisma.config.ts`
- `src/generated` → **`dist/generated`** (Prisma Client path expected at runtime)
- `docker/entrypoint.sh`

Exposed port: **3000**. Runs as user `nestjs`.

### Healthcheck

```
wget -qO- http://127.0.0.1:3000/api/v1/health/live
```

Interval 30s, timeout 5s, start period 60s, 3 retries.

### Entrypoint

[`docker/entrypoint.sh`](../docker/entrypoint.sh):

1. Wait for PostgreSQL (`pg` connectivity)
2. `npx prisma migrate deploy` (fail closed; never reset)
3. `npx prisma db seed` (idempotent)
4. `exec node dist/main.js`

## Compose services

### Production file: [`docker-compose.yml`](../docker-compose.yml)

| Service | Image / build | Host ports | Role |
| --- | --- | --- | --- |
| `postgres` | `postgres:17-alpine` | **none** | Primary DB; UTC; volume `postgres_data` |
| `redis` | `redis:7-alpine` | **none** | Password + AOF + protected-mode; volume `redis_data` |
| `api` | Build `Dockerfile` | `PORT` only (default 3000) | Nest API; bind mounts `./uploads`, `./logs` |

Deploy production without the override:

```bash
docker compose -f docker-compose.yml up -d --build
```

Project name is pinned as `quron-yoli` so volume names do not depend on the checkout folder.

### Updating without wiping data

```bash
./scripts/update.sh
# or: npm run update:prod
```

Rebuilds the API, runs additive `prisma migrate deploy` on start, and **never** runs `down -v`. See [deployment.md](./deployment.md).

### Local override: [`docker-compose.override.yml`](../docker-compose.override.yml)

Auto-merged for plain `docker compose up`:

- Publishes Postgres `5432` and Redis `6379`
- Profile `dev`: **pgAdmin** (`5050`) and **Redis Insight** (`5540`)

```bash
docker compose --profile dev up -d
```

### `api` environment overrides

Compose sets:

- `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public`
- `REDIS_HOST=redis`, `REDIS_PORT=6379`, `REDIS_PASSWORD` (required)
- `LOG_DIR=/app/logs`, `UPLOADS_DIR=/app/uploads`
- Plus `env_file: .env` for JWT, Telegram, QF, etc.

Host `.env` `DATABASE_URL` / `REDIS_HOST=localhost` values are **overridden** inside the `api` container. When running Nest on the host against Compose DB/Redis, keep localhost URLs in `.env` and only start `postgres` + `redis`.

### Healthchecks

| Service | Check |
| --- | --- |
| postgres | `pg_isready` |
| redis | `redis-cli -a $REDIS_PASSWORD ping` |
| api | `wget` → `/api/v1/health` (readiness) |

## Volumes

| Volume / mount | Docker volume name | Path |
| --- | --- | --- |
| `postgres_data` | `quron-yoli_postgres_data` | `/var/lib/postgresql/data` |
| `redis_data` | `quron-yoli_redis_data` | `/data` |
| `./uploads` | (bind) | `/app/uploads` |
| `./logs` | (bind) | `/app/logs` |

Destroying named volumes (`docker compose down -v` or `docker volume rm`) wipes DB/cache state. Bind mounts persist on the host. Normal `up -d --build` and `./scripts/update.sh` keep volumes intact.

If you already ran Compose under a different project/folder name, volumes may still be named `<oldproject>_postgres_data`. Either rename/reattach them to `quron-yoli_postgres_data` / `quron-yoli_redis_data`, or temporarily set the volume `name:` fields to match the existing volume names before the first update with this compose file.

## Redis configuration

- `--requirepass` (required via Compose)
- `--appendonly yes`
- `--protected-mode yes`
- App client reconnect via `ioredis` `retryStrategy`

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Compose exits on start | `.env` missing `REDIS_PASSWORD` |
| API unhealthy | `docker compose logs api`; DB migrate errors; Joi validation |
| Cannot connect to Postgres from host (prod) | Expected — ports not published; use `-f docker-compose.yml` awareness or override for local |
| Empty Quran catalog | Run `qf:sync-catalog:prod` / `qf:sync-pages:prod` inside the api container |
