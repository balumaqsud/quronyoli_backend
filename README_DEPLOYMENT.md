# Deployment (Ubuntu 24.04)

Deploy the API with Docker Compose + Caddy (HTTPS).

## Prerequisites

- Ubuntu 24.04 server (root or sudo)
- DNS A/AAAA for your API host pointing at the VPS (required for Telegram webhooks / Caddy TLS), **or** use free `YOUR_IP.sslip.io` — see [docs/sslip-caddy-redeploy.md](docs/sslip-caddy-redeploy.md)
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
6. Runs `./scripts/ensure-qf-data.sh` — syncs catalog + mushaf pages if mushaf **1** or **10** lack 604 active rows (book/reading mode needs **10**); also mushaf **1405** when Classic Medina is configured

Before `compose up`, deploy also runs `qy_ensure_mushaf_1405_env`: if `uploads/mushaf/1405/` has **604** WebPs and a public host is known (`PUBLIC_API_ORIGIN`, `DOMAIN`, or `TELEGRAM_WEBHOOK_URL`), it writes `PUBLIC_API_ORIGIN` + `QF_MUSHAF_1405_IMAGE_BASE` into `.env` automatically.

| Env | Effect |
| --- | --- |
| `DOMAIN=api.example.com` | Override Caddy hostname |
| `SKIP_CADDY=1` | Docker stack only (no TLS proxy) |
| `SKIP_DOCKER_INSTALL=1` | Assume Docker already installed |
| `SKIP_QF_ENSURE=1` | Skip catalog/pages ensure (not recommended) |
| `RUN_QF_SYNC=1` / `FORCE_QF_SYNC=1` | Force full QF sync even when pages already exist |
| `HEALTH_ATTEMPTS` / `HEALTH_INTERVAL_SEC` | Readiness wait tuning |

Manual equivalent (without scripts): copy `.env`, then `docker compose -f docker-compose.yml up -d --build`, then `./scripts/sync-qf.sh`.

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
3. Auto-configures Classic Medina 1405 env when 604 WebPs are present
4. `docker compose -f docker-compose.yml up -d --build` — **volumes are never removed**
5. Asserts database `POSTGRES_DB` still exists (fails closed if wiped)
6. Waits for `/api/v1/health/ready`
7. Re-syncs Caddy to `.env` `PORT` + asserts `https://DOMAIN/api/v1/health/ready`
8. Entrypoint runs `prisma migrate deploy` (additive; creates new tables without wiping rows)
9. Runs `./scripts/ensure-qf-data.sh` to heal missing mushaf page rows (incl. 1405 when configured)

### Ops command map

| Goal | Command | Touches Postgres data? |
| --- | --- | --- |
| First install | `./scripts/deploy.sh` | No wipe (creates DB on first volume init) |
| Code + new tables/columns | `./scripts/update.sh` | **No** — additive migrate only |
| Restart API only | `./scripts/restart-api.sh` | **No** (postgres/redis left alone) |
| Recreate all containers | `./scripts/restart-stack.sh` | **No** — volumes kept |
| Diagnose outage | `./scripts/doctor.sh` | Read-only |
| Restore missing/empty DB | `CONFIRM_RESTORE=yes ./scripts/repair-db.sh [backup-dir]` | Restores from dump |

```bash
# API-only (partial): rebuild api, leave DB running
./scripts/restart-api.sh
REBUILD=0 ./scripts/restart-api.sh   # restart without rebuild

# Full container recreate (total restart, data stays)
./scripts/restart-stack.sh
```

### Hard rules (data safety)

- Never `docker compose down -v` on production
- Never `prisma migrate reset` or `db push --force-reset` on production
- Do not change `POSTGRES_USER` / `POSTGRES_DB` after first boot
- Schema changes: run `npm run prisma:migrate:dev` in development, commit `prisma/migrations/`, merge to main, then `./scripts/update.sh` on the server

### Caddy / PORT drift (HTTPS 502)

VPS: **`189.74.96.28`** · public host: **`189.74.96.28.sslip.io`** · API: **`.env` `PORT=3000`**.

`update.sh` / `restart-api.sh` / `restart-stack.sh` re-write Caddy to `127.0.0.1:${PORT}` from `.env` and fail if public HTTPS is down. Never leave a stale shell `PORT=3001` — Caddy ignores it and always uses `.env`.

```bash
curl -sS https://189.74.96.28.sslip.io/api/v1/health/ready
DOMAIN=189.74.96.28.sslip.io ./scripts/setup-caddy.sh   # manual fix
./scripts/doctor.sh
```

### DB missing / Prisma P1003 runbook

Symptoms: readiness 503 with `database: down`, logs `database "quron_yoli" does not exist`, Mini App login errors, or `curl` connection reset while API crash-loops.

```bash
./scripts/doctor.sh
CONFIRM_RESTORE=yes ./scripts/repair-db.sh backups/20260809T090949Z
# or latest under backups/:
CONFIRM_RESTORE=yes ./scripts/repair-db.sh
curl -sS http://127.0.0.1:3000/api/v1/health/ready
```

`repair-db.sh` creates the database if missing, restores the dump, restarts the API, and runs `ensure-qf-data.sh`.

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

## After first boot (catalog + reading pages)

`deploy.sh` already calls `ensure-qf-data.sh`, which syncs when mushaf **1** or **10** are incomplete. Reading/book mode uses mushaf **`10`** (`isStandard`); text editions use **1** (and clones **4,5,19**).

Manual / force sync anytime:

```bash
./scripts/sync-qf.sh
# or: npm run sync:qf
# force even if counts look complete:
FORCE_QF_SYNC=1 ./scripts/ensure-qf-data.sh
```

Equivalent Compose commands:

```bash
docker compose -f docker-compose.yml exec api npm run qf:sync-catalog:prod
docker compose -f docker-compose.yml exec api npm run qf:sync-pages:prod -- --mushaf=1
docker compose -f docker-compose.yml exec api npm run qf:sync-pages:prod -- --mushaf=4,5,19 --clone-from=1
docker compose -f docker-compose.yml exec api npm run qf:sync-pages:prod -- --mushaf=10
```

Then in the **admin panel**, enable the translations/tafsirs that should appear in the Mini App. New translations/tafsirs sync as inactive; **qaris sync as active**. Sync never re-enables ones you disabled. List endpoints (`/quran/translations`, `/quran/audio/recitations`, `/quran/audio/chapter-reciters`) only return `isActive=true` rows.

### Classic Medina 1405 (image edition)

Upload `1.webp`…`604.webp` to `uploads/mushaf/1405/` once. After that, **`./scripts/deploy.sh`** or **`./scripts/update.sh`** keeps it enabled:

1. Auto-sets `PUBLIC_API_ORIGIN` and `QF_MUSHAF_1405_IMAGE_BASE=https://<public-host>/uploads/mushaf/1405` when 604 WebPs are present  
2. Ensures 604 page rows for mushaf **1405** (clone from mushaf 1) via `ensure-qf-data.sh`  
3. `GET /quran/mushafs` then includes id **1405**

Without WebP assets, leave the base unset so the Mini App picker only shows working editions (Dar al-Marefa / mushaf 10).

## Backups (cron)

```bash
# Daily 02:00 UTC
0 2 * * * cd /opt/quronyoli/quronyoli_backend && ./scripts/backup.sh >> logs/backup.log 2>&1
```

Restore (destructive — requires confirmation):

```bash
CONFIRM_RESTORE=yes ./scripts/restore.sh backups/<timestamp>
# Preferred full recovery (create DB if missing + restart API + ensure-qf):
CONFIRM_RESTORE=yes ./scripts/repair-db.sh backups/<timestamp>
./scripts/doctor.sh
```

## Reverse proxy tips

- First deploy and every **update/restart** re-sync Caddy to `.env` `PORT` (default `3000`)
- Terminate TLS at Caddy; proxy to `127.0.0.1:3000` (never a stale `:3001`)
- Set `TRUST_PROXY=true` (already in `.env.production`)
- Point `TELEGRAM_WEBHOOK_URL` at `https://189.74.96.28.sslip.io/api/v1/telegram/webhook`
- Public health: `https://189.74.96.28.sslip.io/api/v1/health/ready`
- See [docs/sslip-caddy-redeploy.md](docs/sslip-caddy-redeploy.md)

## Production vs local Compose

| Mode | Command |
| --- | --- |
| Production first boot | `./scripts/deploy.sh` |
| Production update | `./scripts/update.sh` |
| Restart API only | `./scripts/restart-api.sh` |
| Recreate stack (keep volumes) | `./scripts/restart-stack.sh` |
| Diagnose | `./scripts/doctor.sh` |
| Repair DB from backup | `CONFIRM_RESTORE=yes ./scripts/repair-db.sh [backup-dir]` |
| Production (manual) | `docker compose -f docker-compose.yml up -d` |
| Local (+ published DB/Redis ports) | `docker compose up -d` |
| Local + pgAdmin / Redis Insight | `docker compose --profile dev up -d` |

More detail: [docs/deployment.md](docs/deployment.md), [README_DOCKER.md](README_DOCKER.md).
