# Deployment

See [README_DEPLOYMENT.md](./README_DEPLOYMENT.md) for the Ubuntu 24.04 one-pager.

Full operational guide: [docs/deployment.md](./docs/deployment.md).

```bash
cp .env.production .env
docker compose -f docker-compose.yml up -d --build
```
