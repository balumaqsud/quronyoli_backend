# Folder structure

Conventions for the NestJS codebase under `src/`. Paths reflect the repository as of the documentation refresh.

## Repository top level

```
.
├── .env.example
├── .github/workflows/ci.yml
├── Dockerfile
├── docker-compose.yml
├── docs/
├── nest-cli.json
├── package.json
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── prisma.config.ts
├── scripts/
│   └── qf-discovery-sample.ts
├── src/
├── test/
└── tsconfig*.json
```

## `src/` tree

```
src/
├── main.ts                 # Bootstrap: helmet, CORS, versioning, Swagger, timeouts
├── app.module.ts           # Root module wiring
├── config/
│   ├── configuration.ts    # Typed env → config objects
│   └── env.validation.ts   # Joi schema + defaults
├── common/
│   ├── constants/          # CONFIG_KEYS, DI Symbols, queue/job names
│   ├── database/           # Prisma error helpers
│   ├── datetime/           # Local-date helpers
│   ├── decorators/         # @Public, @CurrentUser, @HttpCache, …
│   ├── errors/             # AppErrorCode, AppHttpException
│   ├── filters/            # GlobalExceptionFilter
│   ├── http/               # Keep-alive HttpModule factory
│   ├── interceptors/       # Response, timeout, HTTP cache
│   ├── interfaces/         # API envelope types
│   ├── pagination/         # Keyset cursor encode/decode + page helper
│   ├── quran/              # Verse-key / daily-ayah pure helpers
│   └── validation/         # Shared class-validator decorators
├── infrastructure/
│   ├── auth/               # JwtModule, JwtStrategy, JwtAuthGuard, TokenService
│   ├── cache/              # RedisModule / RedisService
│   ├── database/           # PrismaService + pool
│   ├── queue/              # Bull root + QueueShutdownService
│   └── throttle/           # Throttler config + AppThrottlerGuard
├── modules/
│   ├── analytics/
│   ├── auth/
│   ├── bookmarks/
│   ├── favorites/
│   ├── goals/
│   ├── health/
│   ├── notifications/
│   ├── quran/
│   ├── reading/
│   ├── settings/
│   ├── telegram/
│   └── users/
├── generated/prisma/       # Prisma Client output (generated; do not edit)
└── types/                  # Ambient / shared TS types
```

Generated Prisma Client lives at `src/generated/prisma` (see `schema.prisma` `output`). Production image copies it to `dist/generated`.

## Layer conventions

### `common/`

Cross-cutting, framework-adjacent utilities with **no feature business rules**. Safe to import from any module. Prefer pure functions and Nest providers registered once in `AppModule` (filters/interceptors) or imported as helpers.

### `infrastructure/`

Process-wide adapters: database, Redis, JWT passport stack, BullMQ connection factory, global throttling. Feature modules should consume these through Nest DI, not by constructing clients.

### `modules/`

One Nest feature module per bounded context. Typical files today:

| Pattern | Role |
| --- | --- |
| `*.module.ts` | Nest wiring |
| `*.controller.ts` | HTTP surface |
| `*.service.ts` | Application / orchestration |
| `*.repository.ts` | Prisma data access (when present) |
| `dto/` | Request/response DTOs |
| `client/` / `guards/` / `queues/` / `cache/` | Feature-local adapters |

### Preferred growth layout

As a module grows past a flat service/repository pair, prefer an explicit onion inside the module:

```
modules/<feature>/
  presentation/     # controllers, DTOs, HTTP mappers
  application/      # use-cases / services, ports (interfaces)
  domain/           # pure rules, value objects, invariants
  infrastructure/   # Prisma repos, HTTP clients, queue processors
```

Existing modules are not required to rename overnight; new substantial features should follow this split when it reduces coupling.

## Dependency direction

```
controllers  →  application services  →  domain
                      │
                      ▼
              ports / interfaces
                      │
                      ▼
              infrastructure adapters (Prisma, Axios, BullMQ)
```

**Allowed**

- `modules/*` → `common/*`, `infrastructure/*`, `config` types via `ConfigService`
- `modules/A` → public exports of `modules/B` (e.g. `QuranModule` imports `ReadingModule` + `AnalyticsModule`)
- `infrastructure` → `common`, `config`

**Avoid**

- `common` or `infrastructure` importing feature modules
- Circular module imports
- Controllers calling repositories or Prisma directly
- Persisting Quran text/audio in repositories

## Path alias

TypeScript / Jest map `@/*` → `src/*` (`tsconfig.json`, `package.json` Jest `moduleNameMapper`). Prefer relative imports within a module; use `@/` when crossing deep paths if the file already does.
