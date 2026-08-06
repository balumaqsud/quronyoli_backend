# Quran.Foundation Proxy

The `QuranModule` proxies Quran.Foundation Content v4 and Search v1 APIs.
It does **not** store Quran text, translation text, tafsir text, or audio blobs in PostgreSQL.

**Shapes, endpoint inventory, auth matrix, pagination/cache, resource IDs, and typed client design:** see [`qf-integration-contract.md`](./qf-integration-contract.md) (source of truth for integration shapes). Curated IDs: [`qf-resource-ids.md`](./qf-resource-ids.md). Samples: [`qf-discovery-samples.json`](./qf-discovery-samples.json). Design-only TS: `src/modules/quran/contracts/`.

## Official sources

- Docs: https://api-docs.quran.foundation/
- Auth guide: https://api-docs.quran.foundation/docs/quickstart/manual-authentication/
- Content APIs: https://api-docs.quran.foundation/docs/category/content-apis-4.0.0/
- Search APIs: https://api-docs.quran.foundation/docs/search_apis_versioned/1.0.0/quran-foundation-search-api/

## Architecture

```
QuranController
  → QuranRateLimitGuard (Redis, per JWT user)
  → QuranService
  → QuranCacheService (Redis JSON cache)
  → QuranFoundationClient (Axios + retries)
  → QuranFoundationTokenService (separate content/search OAuth tokens)
  → Quran.Foundation
```

## Environment

Required:

```bash
QF_CLIENT_ID=...
QF_CLIENT_SECRET=...
QF_ENV=production   # or prelive
```

Important optional overrides:

```bash
QF_CONTENT_PATH_PREFIX=/content/api/v4
QF_SEARCH_PATH_PREFIX=/search/v1
QF_CONTENT_SCOPE=content
QF_SEARCH_SCOPE=search
QF_TIMEOUT_MS=30000
QF_MAX_RETRIES=3
QF_RATE_LIMIT_MAX=60
QF_RATE_LIMIT_WINDOW_SECONDS=60
```

Credentials are requested from https://api-docs.quran.foundation/request-access/

Leave `QF_AUTH_BASE_URL` / `QF_API_BASE_URL` unset so defaults follow `QF_ENV` (`production` → `https://oauth2.quran.foundation` + `https://apis.quran.foundation`).

## Local catalog sync

Settings defaults store QF resource IDs that must exist in Postgres. Sync them with:

```bash
npm run qf:sync-catalog
# production artifact:
npm run qf:sync-catalog:prod

# Madani Mushaf page metadata (604 rows; coordinates only):
npm run qf:sync-pages
npm run qf:sync-pages:prod
```

Behavior:

- Fetches Content catalogs first (fail closed on OAuth/network/parse errors).
- Upserts `quran_translations`, `quran_tafsirs`, and `quran_reciters` on `(provider, external_id, kind)`.
- Maps **ayah** `/resources/recitations` with `kind=AYAH` and **chapter** `/resources/chapter_reciters` with `kind=CHAPTER` (separate ID namespaces).
- Settings: `reciterId` validates ayah rows; `chapterReciterId` validates chapter rows.
- **New** translations/tafsirs are created with `is_active=false` (admin must enable for Mini App pickers). **New** qaris are created with `is_active=true` (auto-enabled for Mini App).
- **Existing** rows: metadata/name refresh only — sync does **not** overwrite `is_active` on update (admin enable/disable is preserved).
- Sets `is_active=false` for IDs missing upstream within each kind (never deletes).
- Mini App list endpoints `GET /quran/translations`, `/quran/audio/recitations`, and `/quran/audio/chapter-reciters` return **only** active local catalog rows (QF-shaped envelopes). Translation/tafsir/audio **bodies** remain QF proxies.
- Requires working `content` scope. If `search` scope is denied for the client, Search routes fail until Quran.Foundation grants the entitlement — content/catalog sync still works.

**Ops:** After sync, enable the translations/tafsirs that should appear in the Mini App via the admin panel. Qaris appear automatically; disable unwanted ones in admin. Disabled items stay disabled across future syncs.

**Mushaf pages:** `qf:sync-pages` walks `/verses/by_page/1..604` and upserts `mushaf_pages` (verse keys, surah ids, juz/hizb/rub). Verse text is not stored. Verse-level QF `image_url` ayah strips are **not** promoted to page art. Image mushaf **10** (Dar al-Marefa) gets full-page WebP URLs from `QF_TAJWEED_PAGE_IMAGE_BASE` — sync with `--mushaf=10` (do **not** `--clone-from=1`). See [mushaf-pages.md](./mushaf-pages.md).

Relative ayah audio URLs are absolutized with `QF_AUDIO_CDN_BASE` (default `https://audio.qurancdn.com`). Protocol-relative verse `image_url` values in live QF verse payloads become `https:` (page metadata does not store those strips).

## Auth model

- App routes require the existing JWT access token.
- Upstream Content calls use a cached OAuth2 client-credentials token with `content` scope.
- Upstream Search calls use a separately cached token with `search` scope.
- Tokens are refreshed about `QF_TOKEN_SKEW_SECONDS` before expiry.
- Upstream `401` invalidates the token and retries once.

## Caching

Redis keys are prefixed with the global `REDIS_KEY_PREFIX` and a `qf:` namespace.

| Resource | Default TTL |
| --- | --- |
| Chapters / Juz / Page metadata | 24h |
| Page verses (by_page) | 1h |
| Resource catalogs | 24h |
| Verses / translations / tafsirs | 1h |
| Audio | 1h |
| Search | 5m |

Concurrent identical misses share one upstream request (single-flight).

## Retry / error mapping

Retried: network failures, timeouts, `429`, `5xx` (bounded exponential backoff + jitter).  
Not retried: ordinary `4xx` except one-shot `401` token refresh.

Mapped responses:

| Upstream | App response |
| --- | --- |
| 400 | 400 |
| 404 | 404 |
| 422 | 422 |
| 401/403 | 502 |
| 429 | 429 |
| timeout | 504 |
| network / 5xx | 502/503 |

## Rate limiting

Distributed Redis counter keyed by JWT `sub`.
Default: 60 requests / 60 seconds per user for `/api/v1/quran/*`.

## Backend routes

All under `/api/v1/quran` and JWT-protected:

- Surahs: `GET /surahs`, `/surahs/:id`, `/surahs/:id/info`
- Ayahs: `GET /ayahs/by-surah/:chapter`, `/ayahs/by-key/:verseKey`, `/ayahs/by-juz/:juz`, `/ayahs/by-page/:page`, `/ayahs/by-hizb/:hizb`, `/ayahs/by-rub/:rub`, `/ayahs/by-rub-el-hizb/:rub`, `/ayahs/by-ruku/:ruku`, `/ayahs/by-manzil/:manzil`, `/ayahs/daily`
- Divisions: `GET /juz`, `/juz/:id`, `/hizbs`, `/hizbs/:id`, `/rub-el-hizbs`, `/rub-el-hizbs/:id`, `/rukus`, `/rukus/:id`, `/manzils`, `/manzils/:id`
- Pages: `GET /pages`, `/pages/:pageNumber`, `/pages/:pageNumber/verses`, `/pages/lookup` (see [mushaf-pages.md](./mushaf-pages.md))
- Resources: `GET /translations*`, `/tafsirs*`, `/languages`, `/mushafs` (static mushaf ID map), `/footnotes/:id`
- Scripts / tajweed: `GET /scripts/:script` (e.g. `uthmani_tajweed`)
- Audio: recitations, chapter reciters, chapter/ayah audio, timestamps
- Search: `GET /search` (requires QF `search` scope entitlement)

## Explicit non-goals

- No Prisma Quran text tables
- No long-term persistence of Quran.Foundation payloads
- No browser/mobile exposure of `QF_CLIENT_SECRET`
