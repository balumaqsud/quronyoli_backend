# Redeploy: sslip.io + Caddy (no custom domain)

Use a free hostname `YOUR_IP.sslip.io` so Caddy can issue Let's Encrypt HTTPS for Telegram webhooks.

Replace **`YOUR_IP`** everywhere with your VPS public IPv4 (example: `203.0.113.10` → `203.0.113.10.sslip.io`).

Repo: `https://github.com/balumaqsud/quronyoli_backend.git`

---

## 0. On your Mac — finish `.env`

Local [`.env`](../.env) and [`.env.production`](../.env.production) already use:

```bash
TELEGRAM_WEBHOOK_URL=https://YOUR_IP.sslip.io/api/v1/telegram/webhook
TELEGRAM_WEBHOOK_AUTO_REGISTER=true
TRUST_PROXY=true
```

Set the real IP (one shot):

```bash
cd ~/Desktop/quron-yoli_backend
export VPS_IP=YOUR_IP   # e.g. export VPS_IP=203.0.113.10
perl -i -pe "s|https://YOUR_IP\\.sslip\\.io|https://${VPS_IP}.sslip.io|g; s|https://[0-9.]+\\.sslip\\.io|https://${VPS_IP}.sslip.io|g" .env
grep '^TELEGRAM_WEBHOOK_URL=' .env
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
export VPS_IP=YOUR_IP
scp ~/Desktop/quron-yoli_backend/.env root@${VPS_IP}:/opt/quronyoli/quronyoli_backend/.env
```

(If SSH user is not `root`, change user/path accordingly.)

---

## 3. On the VPS — deploy

```bash
cd /opt/quronyoli/quronyoli_backend
export VPS_IP=YOUR_IP
DOMAIN=${VPS_IP}.sslip.io RUN_QF_SYNC=1 ./scripts/deploy.sh
```

What this does: install Docker if needed → validate `.env` → Compose up → health wait → Caddy for `${VPS_IP}.sslip.io` → optional QF sync.

---

## 4. Verify

```bash
export VPS_IP=YOUR_IP
curl -sS http://127.0.0.1:3000/api/v1/health/ready
curl -sS https://${VPS_IP}.sslip.io/api/v1/health/ready
```

---

## 5. Later updates

```bash
cd /opt/quronyoli/quronyoli_backend
./scripts/update.sh
```

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Caddy TLS fails | Ports 80/443 open; hostname is exactly `IP.sslip.io`; wait ~1 min and `sudo systemctl reload caddy` |
| `validate-env` fails | Remove `REPLACE_*` / `YOUR_IP` leftovers; set strong `REDIS_PASSWORD` |
| Webhook not receiving | `TELEGRAM_WEBHOOK_AUTO_REGISTER=true`; check `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` |
| Wrong compose ports | Always use `docker compose -f docker-compose.yml` (deploy script does) |
