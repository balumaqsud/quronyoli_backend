# REST API

Base URL pattern: `/{API_PREFIX}/v{API_VERSION}/…`  
Defaults: **`/api/v1`**.

Interactive docs: Swagger at `/{SWAGGER_PATH}` (default `/docs`) when enabled.

## Authentication

| Mechanism | Usage |
| --- | --- |
| Bearer JWT access token | `Authorization: Bearer <access>` on protected routes |
| HttpOnly refresh cookie | Name from `AUTH_COOKIE_NAME` (default `refresh_token`), path `AUTH_COOKIE_PATH` (default `/api/v1/auth`) |

Login: `POST /api/v1/auth/telegram` with Telegram Mini App `initData`.  
Refresh: `POST /api/v1/auth/refresh` with cookie (no body required).  
Logout: `POST /api/v1/auth/logout` with Bearer access token.

Global `JwtAuthGuard` applies to all routes except those marked `@Public()` (auth login/refresh, health, Telegram webhook).

## Versioning

URI versioning via Nest `VersioningType.URI`. Controllers declare `version: '1'`. Changing `API_VERSION` alone without controller updates is unsupported.

## Success envelope

All successful controller return values are wrapped by `ResponseInterceptor`:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-07-30T12:00:00.000Z",
  "path": "/api/v1/users/me",
  "requestId": "optional-uuid"
}
```

## Error envelope

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Authentication required",
  "code": "UNAUTHORIZED",
  "timestamp": "2026-07-30T12:00:00.000Z",
  "path": "/api/v1/users/me",
  "requestId": "optional-uuid"
}
```

See [architecture.md](./architecture.md#error-model) for `AppErrorCode` values. Production 5xx messages are scrubbed to `"Internal server error"`.

## Pagination

List endpoints that page use **keyset cursors** (`cursor` + `limit`), not offset pages.

Response shape (inside `data`):

```json
{
  "items": [],
  "nextCursor": "opaque-or-null"
}
```

Cursor payload is an encoded `{ at, id }` pair (`src/common/pagination`). Invalid cursors yield 400.

## Rate limits

| Scope | Config | Notes |
| --- | --- | --- |
| Global | `THROTTLE_LIMIT` / `THROTTLE_TTL_MS` (default 120 / 60s) | Tracker: `user:<id>` if JWT present, else `ip:…` |
| Auth login/refresh | `THROTTLE_AUTH_LIMIT` / `THROTTLE_TTL_MS` (default 20 / 60s) | Wired via `@Throttle` on auth routes |
| Quran routes | `QF_RATE_LIMIT_MAX` / `QF_RATE_LIMIT_WINDOW_SECONDS` | Extra Redis per-user guard |
| Health + Telegram webhook | — | `@SkipThrottle()` |

429 responses include `Retry-After`.

## Route inventory

**78** routes under `/api/v1`. Auth column: **Public**, **Bearer**, **Cookie** (refresh), or **Webhook secret**.

### Health — `/api/v1/health`

| Method | Path | Auth | Summary |
| --- | --- | --- | --- |
| GET | `/api/v1/health/live` | Public | Liveness (no dependency checks) |
| GET | `/api/v1/health/ready` | Public | Readiness (Postgres + Redis) |
| GET | `/api/v1/health` | Public | Alias of ready |

### Auth — `/api/v1/auth`

| Method | Path | Auth | Summary |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/telegram` | Public | Login / register via Telegram `initData` |
| POST | `/api/v1/auth/refresh` | Cookie | Rotate refresh; issue access token |
| POST | `/api/v1/auth/logout` | Bearer | Revoke session; clear cookie |

### Users — `/api/v1/users`

| Method | Path | Auth | Summary |
| --- | --- | --- | --- |
| GET | `/api/v1/users/me` | Bearer | Current user profile |

### Settings — `/api/v1/settings`

| Method | Path | Auth | Summary |
| --- | --- | --- | --- |
| GET | `/api/v1/settings` | Bearer | Get user settings |
| PATCH | `/api/v1/settings` | Bearer | Partial update settings |

### Reading — `/api/v1/reading`

| Method | Path | Auth | Summary |
| --- | --- | --- | --- |
| GET | `/api/v1/reading/continue` | Bearer | Latest reading cursor |
| GET | `/api/v1/reading/recent` | Bearer | Distinct recently read ayahs (keyset) |
| GET | `/api/v1/reading/history` | Bearer | Ayah-open events (keyset; from `ReadingAyahHistory`) |
| GET | `/api/v1/reading/progress` | Bearer | Coverage + completion % |
| GET | `/api/v1/reading/daily` | Bearer | `ReadingDay` rollups for date range |
| GET | `/api/v1/reading/days/today` | Bearer | Today’s day rollup |
| GET | `/api/v1/reading/streak` | Bearer | Current / longest streak |
| GET | `/api/v1/reading/statistics` | Bearer | Aggregated reading stats |

### Favorites — `/api/v1/favorites`

| Method | Path | Auth | Summary |
| --- | --- | --- | --- |
| POST | `/api/v1/favorites` | Bearer | Create favorite |
| GET | `/api/v1/favorites` | Bearer | List (keyset) |
| GET | `/api/v1/favorites/:id` | Bearer | Get by id |
| PATCH | `/api/v1/favorites/:id` | Bearer | Update |
| DELETE | `/api/v1/favorites/:id` | Bearer | Delete |

### Bookmarks — `/api/v1/bookmarks`

| Method | Path | Auth | Summary |
| --- | --- | --- | --- |
| POST | `/api/v1/bookmarks` | Bearer | Create bookmark |
| GET | `/api/v1/bookmarks` | Bearer | List (keyset) |
| GET | `/api/v1/bookmarks/:id` | Bearer | Get by id |
| PATCH | `/api/v1/bookmarks/:id` | Bearer | Update |
| DELETE | `/api/v1/bookmarks/:id` | Bearer | Soft-delete |

### Goals — `/api/v1/goals`

| Method | Path | Auth | Summary |
| --- | --- | --- | --- |
| GET | `/api/v1/goals` | Bearer | List goals |
| GET | `/api/v1/goals/progress` | Bearer | Today’s progress (VERSES / MINUTES) |
| POST | `/api/v1/goals` | Bearer | Create goal |
| PATCH | `/api/v1/goals/:id` | Bearer | Update goal |
| DELETE | `/api/v1/goals/:id` | Bearer | Soft-delete goal |

### Notifications — `/api/v1/notifications`

| Method | Path | Auth | Summary |
| --- | --- | --- | --- |
| GET | `/api/v1/notifications` | Bearer | List in-app notifications (keyset; optional `unreadOnly`) |
| GET | `/api/v1/notifications/unread-count` | Bearer | Unread count for bell badge |
| POST | `/api/v1/notifications/read-all` | Bearer | Mark all notifications as read |
| POST | `/api/v1/notifications/:id/read` | Bearer | Mark one notification as read |
| GET | `/api/v1/notifications/reminders/daily` | Bearer | Get daily reminder preference |
| PUT | `/api/v1/notifications/reminders/daily` | Bearer | Upsert daily reminder preference |
| DELETE | `/api/v1/notifications/reminders/daily` | Bearer | Disable / remove preference |

Daily reminder preference responses include `allowsWriteToPm` so the client can prompt the user to open the bot when Telegram PM writes are blocked. Inbox copy and Telegram reminder text are Uzbek.

### Analytics — `/api/v1/analytics`

| Method | Path | Auth | Summary |
| --- | --- | --- | --- |
| POST | `/api/v1/analytics/events` | Bearer | Ingest single event |
| POST | `/api/v1/analytics/events/batch` | Bearer | Ingest batch |
| GET | `/api/v1/analytics/statistics` | Bearer | Per-user statistics |

Event catalog and buffering: [analytics.md](./analytics.md).

### Telegram — `/api/v1/telegram`

| Method | Path | Auth | Summary |
| --- | --- | --- | --- |
| POST | `/api/v1/telegram/webhook` | Webhook secret | Bot update receiver |
| GET | `/api/v1/telegram/links/mini-app` | Bearer | Mini App / bot deep links |
| GET | `/api/v1/telegram/share/ayah/:verseKey` | Bearer | Share + deep links for an ayah |

Webhook requires header `x-telegram-bot-api-secret-token` matching `TELEGRAM_WEBHOOK_SECRET`. Details: [telegram.md](./telegram.md).

### Quran — `/api/v1/quran`

All routes require **Bearer** auth and `QuranRateLimitGuard`. Stable catalog GETs may send short private HTTP cache headers.

| Method | Path | Summary |
| --- | --- | --- |
| GET | `/api/v1/quran/surahs` | List surahs/chapters |
| GET | `/api/v1/quran/surahs/:id` | Surah by id |
| GET | `/api/v1/quran/surahs/:id/info` | Surah info |
| GET | `/api/v1/quran/ayahs/by-surah/:chapter` | Ayahs by surah |
| GET | `/api/v1/quran/ayahs/daily` | Daily ayah (timezone-aware) |
| GET | `/api/v1/quran/ayahs/by-key/:verseKey` | Ayah by key (**records reading open**) |
| GET | `/api/v1/quran/ayahs/by-juz/:juz` | Ayahs by juz |
| GET | `/api/v1/quran/ayahs/by-page/:page` | Ayahs by page (alias of `/pages/:page/verses`) |
| GET | `/api/v1/quran/juz` | List juz |
| GET | `/api/v1/quran/juz/:id` | Juz by id |
| GET | `/api/v1/quran/pages` | List Madani page metadata (DB) — `[{ page, firstVerse, lastVerse, verseCount }]` |
| GET | `/api/v1/quran/pages/lookup` | Page lookup (QF proxy) |
| GET | `/api/v1/quran/pages/:pageNumber` | Page metadata by number (DB, camelCase) |
| GET | `/api/v1/quran/pages/:pageNumber/verses` | Page meta + QF verses (Arabic/words; optional translations/tafsir/audio) |
| GET | `/api/v1/quran/translations` | Translation resources |
| GET | `/api/v1/quran/translations/:translationId/info` | Translation info |
| GET | `/api/v1/quran/translations/:resourceId/by-surah/:chapter` | Translation by surah |
| GET | `/api/v1/quran/translations/:resourceId/by-ayah/:ayahKey` | Translation by ayah |
| GET | `/api/v1/quran/translations/:resourceId/by-juz/:juz` | Translation by juz |
| GET | `/api/v1/quran/translations/:resourceId/by-page/:page` | Translation by page |
| GET | `/api/v1/quran/tafsirs` | Tafsir resources |
| GET | `/api/v1/quran/tafsirs/:tafsirId/info` | Tafsir info |
| GET | `/api/v1/quran/tafsirs/:resourceId/by-surah/:chapter` | Tafsir by surah |
| GET | `/api/v1/quran/tafsirs/:resourceId/by-ayah/:ayahKey` | Tafsir by ayah |
| GET | `/api/v1/quran/tafsirs/:resourceId/by-juz/:juz` | Tafsir by juz |
| GET | `/api/v1/quran/tafsirs/:resourceId/by-page/:page` | Tafsir by page |
| GET | `/api/v1/quran/audio/recitations` | Recitations list |
| GET | `/api/v1/quran/audio/chapter-reciters` | Chapter reciters |
| GET | `/api/v1/quran/audio/chapter-reciters/:reciterId` | Chapter reciter |
| GET | `/api/v1/quran/audio/chapter-reciters/:reciterId/:chapter` | Chapter audio |
| GET | `/api/v1/quran/audio/recitations/:recitationId/by-surah/:chapter` | Recitation by surah |
| GET | `/api/v1/quran/audio/recitations/:recitationId/by-ayah/:ayahKey` | Recitation by ayah |
| GET | `/api/v1/quran/audio/reciters/:reciterId/timestamps` | Audio timestamps |
| GET | `/api/v1/quran/search` | Search |

QF proxy behavior, cache TTLs, and resource IDs: [quran-foundation.md](./quran-foundation.md), [qf-integration-contract.md](./qf-integration-contract.md).

## Counts

| Area | Routes |
| --- | --- |
| Health | 3 |
| Auth | 3 |
| Users | 1 |
| Settings | 2 |
| Reading | 8 |
| Favorites | 5 |
| Bookmarks | 5 |
| Goals | 5 |
| Notifications | 7 |
| Analytics | 3 |
| Telegram | 3 |
| Quran | 33 |
| **Total** | **78** |
