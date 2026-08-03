# Deployment (Ubuntu 24.04)

Deploy the API with Docker Compose only.

## Prerequisites

- Ubuntu 24.04 server
- Docker Engine + Docker Compose v2
- DNS / reverse proxy with HTTPS (required for Telegram webhooks)
- Secrets for Telegram Bot + Quran.Foundation OAuth

## One-command deploy

```bash
git clone <repo-url> quron-yoli_backend
cd quron-yoli_backend
cp .env.production .env
# Edit .env — replace every REPLACE_* value
docker compose -f docker-compose.yml up -d --build
```

Verify:

```bash
curl -sS http://127.0.0.1:3000/api/health
curl -sS http://127.0.0.1:3000/api/v1/health/ready
```

## What happens automatically

1. Postgres 17 and Redis start with healthchecks  
2. API waits until both are healthy  
3. `prisma migrate deploy` applies migrations (non-destructive)  
4. Idempotent seed runs (no-op if data exists)  
5. NestJS starts in `NODE_ENV=production`

## After first boot (catalog data)

Quran catalog/pages are **not** auto-synced (external API). When ready:

```bash
docker compose -f docker-compose.yml exec api npm run qf:sync-catalog:prod
docker compose -f docker-compose.yml exec api npm run qf:sync-pages:prod
```

## Backups (cron)

```bash
# Daily 02:00 UTC
0 2 * * * cd /opt/quron-yoli_backend && ./scripts/backup.sh >> logs/backup.log 2>&1
```

Restore (destructive — requires confirmation):

```bash
CONFIRM_RESTORE=yes ./scripts/restore.sh backups/<timestamp>
```

## Reverse proxy tips

- Terminate TLS at nginx/Caddy/Traefik  
- Proxy to `127.0.0.1:3000`  
- Set `TRUST_PROXY=true` (already in `.env.production`)  
- Point `TELEGRAM_WEBHOOK_URL` at `https://<public-host>/api/v1/telegram/webhook`

## Production vs local Compose

| Mode | Command |
| --- | --- |
| Production | `docker compose -f docker-compose.yml up -d` |
| Local (+ published DB/Redis ports) | `docker compose up -d` |
| Local + pgAdmin / Redis Insight | `docker compose --profile dev up -d` |

More detail: [docs/deployment.md](docs/deployment.md), [README_DOCKER.md](README_DOCKER.md).
