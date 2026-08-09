# Redeploy: sslip.io + Caddy (no custom domain)

Use free hostname **`189.74.96.28.sslip.io`** so Caddy can issue Let's Encrypt HTTPS for Telegram webhooks on VPS **`189.74.96.28`**.

Repo: `https://github.com/balumaqsud/quronyoli_backend.git`

---

## 0. On your Mac — finish `.env`

Production webhook host must be:

```bash
TELEGRAM_WEBHOOK_URL=https://189.74.96.28.sslip.io/api/v1/telegram/webhook
TELEGRAM_WEBHOOK_AUTO_REGISTER=true
TRUST_PROXY=true
PORT=3000
```

Confirm secrets are real (no `REPLACE_*`), especially `REDIS_PASSWORD` (≥16 chars), JWT secrets, Telegram, QF.

---

## 1. On the VPS — firewall + clone

```bash
sudo apt update && sudo apt install -y git ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

sudo mkdir -p /opt/quronyoli && sudo chown "$USER:$USER" /opt/quronyoli
cd /opt/quronyoli
git clone https://github.com/balumaqsud/quronyoli_backend.git quronyoli_backend
cd quronyoli_backend
chmod +x scripts/*.sh
```

---

## 2. On your Mac — upload `.env`

```bash
scp ~/Desktop/quron-yoli_backend/.env root@189.74.96.28:/opt/quronyoli/quronyoli_backend/.env
```

(If SSH user is not `root`, change user/path accordingly.)

---

## 3. On the VPS — deploy

```bash
cd /opt/quronyoli/quronyoli_backend
DOMAIN=189.74.96.28.sslip.io RUN_QF_SYNC=1 ./scripts/deploy.sh
```

What this does: install Docker if needed → validate `.env` → Compose up → health wait → Caddy for `189.74.96.28.sslip.io` → verify HTTPS → optional QF sync.

Caddy upstream is always **`.env` `PORT`** (default `3000`). A stale shell `PORT=3001` cannot redirect the proxy.

---

## 4. Verify

```bash
curl -sS http://127.0.0.1:3000/api/v1/health/ready
curl -sS https://189.74.96.28.sslip.io/api/v1/health/ready
./scripts/doctor.sh
```

---

## 5. Later updates / restarts

```bash
cd /opt/quronyoli/quronyoli_backend
./scripts/update.sh          # pull + rebuild + re-sync Caddy to .env PORT + HTTPS check
./scripts/restart-api.sh     # API only; re-syncs Caddy
./scripts/restart-stack.sh   # recreate containers; keep volumes; re-syncs Caddy
```

`SKIP_CADDY=1` skips Caddy rewrite/HTTPS assert when needed.

Manual Caddy fix:

```bash
DOMAIN=189.74.96.28.sslip.io ./scripts/setup-caddy.sh
```

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Caddy TLS fails | Ports 80/443 open; hostname is exactly `189.74.96.28.sslip.io`; wait ~1 min and `sudo systemctl reload caddy` |
| HTTPS 502 but localhost:3000 OK | Stale Caddy upstream (often `:3001`). Run `DOMAIN=189.74.96.28.sslip.io ./scripts/setup-caddy.sh` or `./scripts/restart-api.sh` as root |
| `validate-env` fails | Remove `REPLACE_*` leftovers; set strong `REDIS_PASSWORD` |
| Webhook not receiving | `TELEGRAM_WEBHOOK_AUTO_REGISTER=true`; check `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` |
| Wrong compose ports | Always use `docker compose -f docker-compose.yml` (deploy script does) |
| Diagnose | `./scripts/doctor.sh` |
