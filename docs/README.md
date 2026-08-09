# Documentation index

Staff-engineer reference for the Quron Yo'li NestJS backend. Prefer linking these docs over duplicating long domain write-ups.

## Start here

| Doc | Description |
| --- | --- |
| [../README.md](../README.md) | Project entry: purpose, stack, quick start, scripts, module map |
| [architecture.md](./architecture.md) | Boundaries, request/auth/data/queue/QF flows, DI, errors, caching, scaling |
| [folder-structure.md](./folder-structure.md) | Current tree, layer conventions, dependency direction |
| [rest-api.md](./rest-api.md) | Auth, versioning, envelope, pagination, errors, rate limits, full route inventory |
| [environment.md](./environment.md) | `.env.example` + Joi defaults, secrets, Compose-only vars, QF overrides |
| [deployment.md](./deployment.md) | Build / migrate / start, probes, `TRUST_PROXY`, cookies, webhook TLS, rollback |
| [ops-runbook.md](./ops-runbook.md) | **Production ops**: which script to run, Caddy/HTTPS, DB repair, doctor, VPS `189.74.96.28` |
| [docker.md](./docker.md) | Dockerfile stages, Compose services, local vs prod caveats |
| [PRODUCTION_READINESS_REPORT.md](./PRODUCTION_READINESS_REPORT.md) | Production hardening report (score, changes, recommendations) |
| [../README_DEPLOYMENT.md](../README_DEPLOYMENT.md) | Ubuntu 24.04 one-command deploy |
| [sslip-caddy-redeploy.md](./sslip-caddy-redeploy.md) | First HTTPS setup with `189.74.96.28.sslip.io` |
| [../README_DOCKER.md](../README_DOCKER.md) | Docker Compose quick reference |
| [database-schema.md](./database-schema.md) | Prisma/PostgreSQL ERD, cascades, soft delete, SQL-only constraints |
| [future-improvements.md](./future-improvements.md) | Prioritized follow-ups |

## Domain deep-dives (keep as source of truth)

| Doc | Description |
| --- | --- |
| [quran-foundation.md](./quran-foundation.md) | QF proxy ops: cache, rate limits, tokens, env |
| [qf-integration-contract.md](./qf-integration-contract.md) | Integration shapes, auth matrix, typed client design (not wired yet) |
| [qf-resource-ids.md](./qf-resource-ids.md) | Curated Quran.Foundation resource IDs |
| [qf-discovery-samples.json](./qf-discovery-samples.json) | Sample discovery payloads |
| [telegram.md](./telegram.md) | Bot webhook, deep links, daily reminders |
| [analytics.md](./analytics.md) | Event catalog, ingest, Redis buffer, statistics |
| [production.md](./production.md) | Pool sizing, throttling, timeouts, shutdown |

## Related source

| Path | Notes |
| --- | --- |
| [../.env.example](../.env.example) | Canonical env template |
| [../docker-compose.yml](../docker-compose.yml) | Local/prod-ish Compose stack |
| [../Dockerfile](../Dockerfile) | Multi-stage production image |
| [../prisma/schema.prisma](../prisma/schema.prisma) | Data model |
| [../scripts/qf-discovery-sample.ts](../scripts/qf-discovery-sample.ts) | `npm run qf:discover` |
