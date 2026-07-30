# Quron Yo'li Backend

Production-ready NestJS backend for the **Quron Yo'li** Telegram Mini App.

## Stack

- NestJS 11 + TypeScript (strict)
- PostgreSQL + Prisma ORM 7
- Redis (`ioredis`)
- Telegram Mini App authentication
- JWT access + HttpOnly refresh cookies
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
# set TELEGRAM_BOT_TOKEN to your bot token from @BotFather
npm install
npx prisma generate
docker compose up -d postgres redis
npx prisma migrate deploy
npm run start:dev
```

API base path: `http://localhost:3000/api/v1`  
Swagger: `http://localhost:3000/docs`  
Health: `http://localhost:3000/api/v1/health`

## Authentication

Telegram Mini App login flow:

1. Frontend sends `POST /api/v1/auth/telegram` with `{ "initData": "<Telegram.WebApp.initData>" }`
2. Backend verifies the Telegram HMAC signature and `auth_date`
3. User is created or updated
4. Access JWT is returned in the response body
5. Refresh JWT is set as an HttpOnly cookie (`refresh_token`)

| Endpoint | Auth | Description |
| --- | --- | --- |
| `POST /api/v1/auth/telegram` | Public | Login / register via Telegram initData |
| `POST /api/v1/auth/refresh` | Refresh cookie | Rotate refresh token and issue access token |
| `POST /api/v1/auth/logout` | Bearer access token | Revoke current session and clear cookie |
| `GET /api/v1/users/me` | Bearer access token | Current user profile |

Refresh cookies are scoped to `/api/v1/auth`, hashed with SHA-256 before storage, and rotated on every refresh. Reuse of an old refresh token revokes the session.

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
| `npm run prisma:migrate:deploy` | Apply migrations in production |
| `npm run check` | Lint + test + build |

## Architecture

```
src/
  config/                 # Typed env configuration + Joi validation
  common/                 # Filters, interceptors, decorators, contracts
  infrastructure/
    auth/                 # JWT strategy, guard, token service
    database/             # Prisma / PostgreSQL
    cache/                # Redis
  modules/
    auth/                 # Telegram login, refresh, logout, sessions
    users/                # User profile endpoints
    health/               # Public health feature
  main.ts
  app.module.ts
```

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Services:

- `api` — NestJS application
- `postgres` — PostgreSQL 16
- `redis` — Redis 7

## Configuration

All runtime settings are validated at boot through `ConfigModule` + Joi. See [`.env.example`](.env.example).

Critical variables:

- `TELEGRAM_BOT_TOKEN`
- `DATABASE_URL`
- `REDIS_HOST` / `REDIS_PORT`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (min 32 chars)
- `CORS_ORIGINS` (include `https://web.telegram.org`)
- `AUTH_COOKIE_*` for refresh cookie security settings
