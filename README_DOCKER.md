# Docker Guide

Production Docker image and Compose stack for Quron Yo'li.

See also: [docs/docker.md](docs/docker.md) for deeper troubleshooting.

## Quick start

### Production (Ubuntu server)

```bash
cp .env.production .env
# Fill all REPLACE_* secrets; REDIS_PASSWORD is required
docker compose -f docker-compose.yml up -d --build
```

Using `-f docker-compose.yml` skips [`docker-compose.override.yml`](docker-compose.override.yml) so Postgres and Redis stay **internal-only** (not published to the host).

### Update production (keep data)

```bash
./scripts/update.sh
# or: npm run update:prod
```

Pulls latest code, rebuilds, applies Prisma migrations additively, **never** deletes volumes. See [README_DEPLOYMENT.md](README_DEPLOYMENT.md).

### Local development

```bash
cp .env.development .env
# Fill Telegram / QF secrets
docker compose up -d --build
# Optional admin UIs:
docker compose --profile dev up -d
```

Override publishes Postgres (`5432`) and Redis (`6379`). Profile `dev` adds:

| Service | URL |
| --- | --- |
| pgAdmin | http://localhost:5050 |
| Redis Insight | http://localhost:5540 |

## Services

| Service | Image | Notes |
| --- | --- | --- |
| `postgres` | `postgres:17-alpine` | UTC, UTF8, named volume `postgres_data`, healthcheck |
| `redis` | `redis:7-alpine` | Password + AOF + protected-mode, volume `redis_data` |
| `api` | Multi-stage Dockerfile (Node 22) | Waits for healthy deps → migrate → seed → NestJS |

## Startup order

1. Redis healthy  
2. Postgres healthy  
3. `docker/entrypoint.sh`: wait for DB → `prisma migrate deploy` → `prisma db seed` → `node dist/main.js`

Migrations use **deploy only** (never reset). Seed is idempotent and never deletes data.

## Volumes / bind mounts

| Name / path | Purpose |
| --- | --- |
| `quron-yoli_postgres_data` | PostgreSQL data (Compose project `quron-yoli`) |
| `quron-yoli_redis_data` | Redis AOF/RDB |
| `./uploads` | Persistent uploads dir (created automatically) |
| `./logs` | Daily rotating Pino logs |

No other bind mounts in production compose. Never use `docker compose down -v` on production.

## Health

| Probe | Path |
| --- | --- |
| Liveness | `GET /api/v1/health/live` |
| Readiness | `GET /api/v1/health/ready` or `/api/v1/health` |
| Unversioned alias | `GET /api/health` |

## Image

- Multi-stage, Node **22** Alpine  
- `npm ci`, non-root `nestjs` user  
- `ENTRYPOINT` → [`docker/entrypoint.sh`](docker/entrypoint.sh)  
- `CMD` → `node dist/main.js`
