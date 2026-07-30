# Quron Yo'li Backend

Production-ready NestJS foundation for the **Quron Yo'li** Telegram Mini App.

## Stack

- NestJS 11 + TypeScript (strict)
- PostgreSQL + Prisma ORM 7
- Redis (`ioredis`)
- JWT authentication infrastructure
- Swagger / OpenAPI
- Pino structured logging
- Docker Compose

## Requirements

- Node.js 22+
- npm 10+
- Docker (optional, for local PostgreSQL/Redis)

## Quick start

```bash
cp .env.example .env
npm install
npx prisma generate
docker compose up -d postgres redis
npm run start:dev
```

API base path: `http://localhost:3000/api/v1`  
Swagger: `http://localhost:3000/docs`  
Health: `http://localhost:3000/api/v1/health`

## Scripts

| Script | Description |
| --- | --- |
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Compile the project |
| `npm run start:prod` | Run compiled output |
| `npm run lint` | ESLint with autofix |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate:dev` | Create/apply migrations |
| `npm run check` | Lint + test + build |

## Architecture

```
src/
  config/                 # Typed env configuration + Joi validation
  common/                 # Filters, interceptors, decorators, contracts
  infrastructure/
    auth/                 # JWT strategy, guard, token service (no auth endpoints)
    database/             # Prisma / PostgreSQL
    cache/                # Redis
  modules/
    health/               # Public health feature
  main.ts
  app.module.ts
```

This foundation intentionally excludes business modules. JWT infrastructure is ready for future auth/user features via `@Public()`, `@CurrentUser()`, and `TokenService`.

## Docker

Start the full stack:

```bash
cp .env.example .env
docker compose up --build
```

Services:

- `api` — NestJS application
- `postgres` — PostgreSQL 16
- `redis` — Redis 7

## Configuration

All runtime settings are validated at boot through `ConfigModule` + Joi. See [`.env.example`](.env.example) for the full list.

Critical variables:

- `DATABASE_URL`
- `REDIS_HOST` / `REDIS_PORT`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (min 32 chars)
- `CORS_ORIGINS`
