# Deployment (Ubuntu 24.04)

Deploy the API with Docker Compose + Caddy (HTTPS).

## Prerequisites

- Ubuntu 24.04 server (root or sudo)
- DNS A/AAAA for your API host pointing at the VPS (required for Telegram webhooks / Caddy TLS)
- A ready `.env` with production secrets (upload via scp; scripts never invent Telegram/QF tokens)

## First deploy (one command)

On your laptop, prepare and upload `.env`:

```bash
# from your machine (example)
scp .env root@YOUR_VPS:/opt/quronyoli/quronyoli_backend/.env
```

On the server:

```bash
cd /opt/quronyoli/quronyoli_backend   # or your clone path
./scripts/deploy.sh
# or: npm run deploy:prod
```

What `deploy.sh` does:

1. Installs Docker Engine + Compose v2 if missing  
2. Validates `.env` (fails closed on placeholders / short secrets)  
3. `docker compose -f docker-compose.yml up -d --build`  
4. Waits for `/api/v1/health/ready`  
5. Installs/configures Caddy for `DOMAIN` (from `DOMAIN=...` or host of `TELEGRAM_WEBHOOK_URL`)  
6. Optionally runs QF sync when `RUN_QF_SYNC=1`

| Env | Effect |
| --- | --- |
| `DOMAIN=api.example.com` | Override Caddy hostname |
| `SKIP_CADDY=1` | Docker stack only (no TLS proxy) |
| `SKIP_DOCKER_INSTALL=1` | Assume Docker already installed |
| `RUN_QF_SYNC=1` | After healthy: catalog + pages sync inside `api` |
| `HEALTH_ATTEMPTS` / `HEALTH_INTERVAL_SEC` | Readiness wait tuning |

Manual equivalent (without scripts): copy `.env`, then `docker compose -f docker-compose.yml up -d --build`.

## One-command update (keep DB data)

After the first deploy, every time `main` has new backend code (including new Prisma migrations / tables):

```bash
cd /opt/quronyoli/quronyoli_backend
./scripts/update.sh
# or: npm run update:prod
```

What it does:

1. Pre-update backup (skip with `SKIP_BACKUP=1`)
2. `git pull --ff-only`
3. `docker compose -f docker-compose.yml up -d --build` — **volumes are never removed**
4. Waits for `/api/v1/health/ready`
5. Entrypoint runs `prisma migrate deploy` (additive; creates new tables without wiping rows)

### Hard rules (data safety)

- Never `docker compose down -v` on production
- Never `prisma migrate reset` or `db push --force-reset` on production
- Do not change `POSTGRES_USER` / `POSTGRES_DB` after first boot
- Schema changes: run `npm run prisma:migrate:dev` in development, commit `prisma/migrations/`, merge to main, then `./scripts/update.sh` on the server

Verify:

```bash
curl -sS http://127.0.0.1:3000/api/health
curl -sS http://127.0.0.1:3000/api/v1/health/ready
# with Caddy:
curl -sS https://YOUR_DOMAIN/api/v1/health/ready
```

## What happens automatically

1. Postgres 17 and Redis start with healthchecks  
2. API waits until both are healthy  
3. `prisma migrate deploy` applies migrations (non-destructive)  
4. Idempotent seed runs (no-op if data exists)  
5. NestJS starts in `NODE_ENV=production`

## After first boot (catalog data)

Quran catalog/pages are **not** auto-synced unless you pass `RUN_QF_SYNC=1` to `deploy.sh`. When ready:

```bash
docker compose -f docker-compose.yml exec api npm run qf:sync-catalog:prod
docker compose -f docker-compose.yml exec api npm run qf:sync-pages:prod
```

Then in the **admin panel**, enable the translations/tafsirs that should appear in the Mini App. New translations/tafsirs sync as inactive; **qaris sync as active**. Sync never re-enables ones you disabled. List endpoints (`/quran/translations`, `/quran/audio/recitations`, `/quran/audio/chapter-reciters`) only return `isActive=true` rows.

## Backups (cron)

```bash
# Daily 02:00 UTC
0 2 * * * cd /opt/quronyoli/quronyoli_backend && ./scripts/backup.sh >> logs/backup.log 2>&1
```

Restore (destructive — requires confirmation):

```bash
CONFIRM_RESTORE=yes ./scripts/restore.sh backups/<timestamp>
```

## Reverse proxy tips

- First deploy configures **Caddy** by default (`./scripts/setup-caddy.sh`)
- Terminate TLS at Caddy; proxy to `127.0.0.1:3000`
- Set `TRUST_PROXY=true` (already in `.env.production`)
- Point `TELEGRAM_WEBHOOK_URL` at `https://<public-host>/api/v1/telegram/webhook`
- DNS must already point at the VPS before Caddy can obtain certificates

## Production vs local Compose

| Mode | Command |
| --- | --- |
| Production first boot | `./scripts/deploy.sh` |
| Production update | `./scripts/update.sh` |
| Production (manual) | `docker compose -f docker-compose.yml up -d` |
| Local (+ published DB/Redis ports) | `docker compose up -d` |
| Local + pgAdmin / Redis Insight | `docker compose --profile dev up -d` |

More detail: [docs/deployment.md](docs/deployment.md), [README_DOCKER.md](README_DOCKER.md).
