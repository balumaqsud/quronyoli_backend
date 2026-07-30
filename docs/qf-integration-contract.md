# Quran.Foundation integration contract

Discovery + design contract for Quron Yo'li’s Content v4 + Search v1 proxy.

**Status:** design-only. Runtime still returns mostly `Promise<unknown>` passthrough. Typed client under [`src/modules/quran/contracts/`](../src/modules/quran/contracts/) is **not** wired into Nest yet.

**Ops / env / rate-limit:** [`quran-foundation.md`](./quran-foundation.md)  
**Curated IDs:** [`qf-resource-ids.md`](./qf-resource-ids.md)  
**Sample payloads:** [`qf-discovery-samples.json`](./qf-discovery-samples.json)  
**Discovery script:** `npx ts-node --transpile-only scripts/qf-discovery-sample.ts`

Official sources:

- https://api-docs.quran.foundation/docs/quickstart/
- https://api-docs.quran.foundation/docs/quickstart/manual-authentication/
- https://api-docs.quran.foundation/docs/category/content-apis-4.0.0/
- https://api-docs.quran.foundation/docs/search_apis_versioned/1.0.0/quran-foundation-search-api/

---

## 1. Scope / non-goals

### In scope

- Content APIs under `{apiBaseUrl}{QF_CONTENT_PATH_PREFIX}` (default `/content/api/v4`)
- Search under `{apiBaseUrl}{QF_SEARCH_PATH_PREFIX}` (default `/search/v1`)
- Auth, pagination/filters, cache TTLs, sample JSON, resource ID catalog, TypeScript client/response shapes
- Mapping every current `QuranController` route (including Daily Ayah → `verses/by_key`)

### Out of scope (this phase)

- Implementing `QuranFoundationClient` interface on the live Axios client
- Changing controller/service return types away from `unknown`
- Persisting Quran text in Postgres
- User-related QF APIs, Quran Reflect, QF-side bookmarks/notes (we own those locally)
- Phase 4 product features

---

## 2. Auth

| Item | Contract |
| --- | --- |
| Grant | OAuth2 `client_credentials` |
| Token URL | `{authBaseUrl}/oauth2/token` |
| Auth header | HTTP Basic `base64(client_id:client_secret)` |
| Body | `application/x-www-form-urlencoded` with `grant_type=client_credentials&scope={scope}` |
| Content scope | `content` (`QF_CONTENT_SCOPE`) |
| Search scope | `search` (`QF_SEARCH_SCOPE`) — **separate tokens** |
| Request headers (API) | `x-auth-token: {access_token}`, `x-client-id: {client_id}` |
| Lifetime | `expires_in` ≈ **3600** seconds |
| Refresh token | **None** — re-request client credentials |
| Skew / renewal | Renew `QF_TOKEN_SKEW_SECONDS` (default 30) before expiry; Redis keys `qf:token:content` / `qf:token:search` |
| 401 handling | Invalidate cached token and retry once (current client behavior) |

### Environments

| `QF_ENV` | Auth base | API base |
| --- | --- | --- |
| `prelive` | `https://prelive-oauth2.quran.foundation` | `https://apis-prelive.quran.foundation` |
| `production` | `https://oauth2.quran.foundation` | `https://apis.quran.foundation` |

Overrides: `QF_AUTH_BASE_URL`, `QF_API_BASE_URL`.

### Security

- `QF_CLIENT_SECRET` stays **server-side only** (never Mini App / browser).
- App routes still require our JWT; QF tokens never leave the backend.

### Drift vs `QuranFoundationTokenService`

Aligned with official manual-auth docs: Basic auth, form body, separate scopes, Redis cache with skew, no refresh token. No known protocol drift; live discovery in this environment received **401** from the token endpoint with configured credentials (re-check client access / env pair).

Sample token response (docs):

```json
{
  "access_token": "YOUR_ACCESS_TOKEN",
  "token_type": "bearer",
  "expires_in": 3600,
  "scope": "content"
}
```

---

## 3. Endpoint catalog

Upstream paths are relative to `QF_CONTENT_PATH_PREFIX` unless noted. Cache class: see §6.

| Domain | Method | Upstream path | Primary query params | Pagination | Cache |
| --- | --- | --- | --- | --- | --- |
| Chapters | GET | `/chapters` | `language` | — | Stable |
| Chapter | GET | `/chapters/{id}` | `language` | — | Stable |
| Chapter info | GET | `/chapters/{id}/info` | `language` | — | Stable |
| Verses by chapter | GET | `/verses/by_chapter/{chapter}` | verse filters\* | `page`, `per_page` | Verse |
| Verses by key | GET | `/verses/by_key/{verseKey}` | verse filters\* | — | Verse |
| Verses by juz | GET | `/verses/by_juz/{juz}` | verse filters\* | `page`, `per_page` | Verse |
| Verses by page | GET | `/verses/by_page/{page}` | verse filters\* | `page`, `per_page` | Verse |
| Juz list / one | GET | `/juzs`, `/juzs/{id}` | — | — | Stable |
| Pages | GET | `/pages`, `/pages/{n}` | `language` | — | Stable |
| Page lookup | GET | `/pages/lookup` | `mushaf`, `chapter_number`, `juz_number`, `page_number`, `from`, `to` | — | Stable |
| Translation resources | GET | `/resources/translations` | `language` | — | Stable |
| Translation info | GET | `/resources/translations/{id}/info` | — | — | Stable |
| Translation body | GET | `/translations/{id}/by_{chapter\|ayah\|juz\|page}/…` | `language`, `page`, `per_page` | yes (chapter/juz/page) | Verse |
| Tafsir resources | GET | `/resources/tafsirs` | `language` | — | Stable |
| Tafsir info | GET | `/resources/tafsirs/{id}/info` | — | — | Stable |
| Tafsir body | GET | `/tafsirs/{id}/by_{chapter\|ayah\|juz\|page}/…` | `language`, `page`, `per_page` | yes | Verse |
| Recitations | GET | `/resources/recitations` | `language` | — | Stable |
| Chapter reciters | GET | `/resources/chapter_reciters` | `language` | — | Stable |
| Chapter audio | GET | `/chapter_recitations/{reciterId}`, `…/{chapter}` | — | — | Audio |
| Ayah audio | GET | `/recitations/{id}/by_chapter/{c}`, `…/by_ayah/{key}` | `page`, `per_page` | yes (chapter) | Audio |
| Timestamps | GET | `/audio/reciters/{reciterId}/timestamp` | `chapter_number`, `verse_key`, `verse_id`, `word` | — | Audio |
| Search | GET | `{searchPrefix}/search` | `query`, `mode`, `page`, `size`, `translation_ids`, … | `page`, `size` (app max 50) | Search |

\*Verse filters (app `VersesQueryDto`): `language`, `page`, `per_page` (max **100**), `translations`, `tafsirs`, `words`, `audio`, `fields`, `word_fields`, `translation_fields`, `tafsir_fields`, `mushaf`.

---

## 4. Sample request / response JSON

Collapsed samples live in [`qf-discovery-samples.json`](./qf-discovery-samples.json). Representative shapes below (snake_case = wire format from QF).

### Chapters list

```http
GET /content/api/v4/chapters?language=en
x-auth-token: …
x-client-id: …
```

```json
{
  "chapters": [
    {
      "id": 1,
      "revelation_place": "makkah",
      "revelation_order": 5,
      "bismillah_pre": false,
      "name_simple": "Al-Fatihah",
      "name_complex": "Al-Fātiĥah",
      "name_arabic": "الفاتحة",
      "verses_count": 7,
      "pages": [1, 1],
      "translated_name": { "language_name": "english", "name": "The Opener" }
    }
  ]
}
```

### Verses by chapter (with extras)

```http
GET /content/api/v4/verses/by_chapter/1?language=en&translations=131&tafsirs=169&words=true&audio=7&per_page=1
```

```json
{
  "verses": [
    {
      "id": 1,
      "chapter_id": 1,
      "verse_number": 1,
      "verse_key": "1:1",
      "juz_number": 1,
      "page_number": 1,
      "audio": {
        "verse_key": "1:1",
        "url": "https://verses.quran.foundation/Alafasy/mp3/001001.mp3"
      },
      "translations": [
        {
          "resource_id": 131,
          "resource_name": "Dr. Mustafa Khattab, the Clear Quran",
          "text": "In the Name of Allah—the Most Compassionate, Most Merciful."
        }
      ],
      "tafsirs": [
        {
          "id": 82641,
          "resource_id": 169,
          "language_name": "english",
          "name": "Tafsir Ibn Kathir",
          "text": "<h2 class=\"title\">…</h2>"
        }
      ]
    }
  ],
  "pagination": {
    "per_page": 1,
    "current_page": 1,
    "next_page": 2,
    "total_pages": 7,
    "total_records": 7
  }
}
```

### Translation resource catalog

```json
{
  "translations": [
    {
      "id": 20,
      "name": "Saheeh International",
      "author_name": "Saheeh International",
      "slug": "en-sahih-international",
      "language_name": "english",
      "translated_name": { "name": "Saheeh International", "language_name": "english" }
    }
  ]
}
```

### Error shape (documented)

```json
{
  "message": "The request requires user authentication",
  "type": "unauthorized",
  "success": false
}
```

Observed `type` values in docs: `invalid_request`, `unauthorized`, `forbidden`, `not_found`, `unprocessable_entity`, `rate_limit_exceeded`, `internal_server_error`, `bad_gateway`, `service_unavailable`, `gateway_timeout`.

App mapping of upstream status → Nest HTTP codes is in [`quran-foundation.md`](./quran-foundation.md).

### Search

```http
GET /search/v1/search?query=fatiha&mode=quick&size=5
```

Requires `search` scope. Live sample not captured (auth 401); treat response as opaque until typed follow-up — contract method `search()` returns `SearchResponse` with optional navigational + verse hit arrays (see TS types).

---

## 5. Resource ID tables

See [`qf-resource-ids.md`](./qf-resource-ids.md).

Summary defaults: uz translation **55**, en **20** (or **131** if present on QF), ru **45**, en tafsir **169**, ayah reciter **7**. Arabic reading uses verse Arabic text fields, not a translation ID.

---

## 6. Pagination, filtering, search

| Endpoint family | Pagination | Filters / notes | Limits |
| --- | --- | --- | --- |
| `/verses/by_*` | `page`, `per_page` | `translations`, `tafsirs`, `words`, `audio`, field selectors, `mushaf`, `language` | App caps `per_page` ≤ 100 |
| `/translations|tafsirs/{id}/by_*` | `page`, `per_page` (except by_ayah) | `language` | same |
| `/recitations/{id}/by_chapter` | `page`, `per_page` | — | same |
| Catalogs (`/resources/*`, `/chapters`, `/juzs`, `/pages`) | none observed | `language` for localized names | — |
| `/pages/lookup` | — | mushaf / chapter / juz / page / from–to | — |
| `/search` | `page`, `size` | `mode`=`quick`\|`advanced`, `translation_ids`, `navigationalResultsNumber`, `versesResultsNumber`, `exact_matches_only` | App caps `size` ≤ 50 |
| Cursor pagination | **Not used** by current product routes | — | — |

Verse list responses include `pagination: { per_page, current_page, next_page, total_pages, total_records }` (`next_page` may be `null`).

---

## 7. Cacheability and TTLs

Conceptual Redis key: `{REDIS_KEY_PREFIX}qf:cache:{namespace}:{sha1(path?canonicalQuery)}` via `QuranCacheService.buildKey`. Concurrent misses single-flight.

| Class | Examples | Recommended TTL | Current defaults |
| --- | --- | --- | --- |
| Stable catalogs | chapters, juzs, pages, `/resources/*` | 24h | `QF_CACHE_TTL_CHAPTERS_SECONDS` / `…_RESOURCES_SECONDS` = 86400 |
| Verse / content bodies | verses, translation/tafsir by_\* | 1h | `QF_CACHE_TTL_VERSES_SECONDS` = 3600 |
| Audio metadata / URLs | recitations, chapter audio, timestamps | 1h; **revalidate if CDN URLs expire** | `QF_CACHE_TTL_AUDIO_SECONDS` = 3600 |
| Search | `/search` | 5m | `QF_CACHE_TTL_SEARCH_SECONDS` = 300 |

Audio caveat: docs/examples serve absolute URLs under `verses.quran.foundation` / relative word audio paths. Treat cached audio URLs as **semi-stable**; if clients report 404/expired media, shorten audio TTL or bypass cache for that path.

---

## 8. Client interface summary

Design-only interface: `src/modules/quran/contracts/qf-client.interface.ts`.

- Token acquisition stays in `QuranFoundationTokenService` (not on the content client).
- Today’s Axios `QuranFoundationClient` is a thin `getContent` / `getSearch` proxy; a later phase should implement this interface and map snake_case → camelCase internal types.
- Controllers must not re-export raw OpenAPI/axios types.

---

## 9. Internal typing rules

| Rule | Detail |
| --- | --- |
| Wire format | QF JSON uses **snake_case** |
| Internal models | **camelCase** under `contracts/qf-*.types.ts` |
| Mapping | Explicit mappers in a follow-up (not this phase); document field pairs in types comments |
| Controllers | Keep Nest/Swagger DTOs for **query** params; response bodies stay untyped until wiring phase |
| No leak | Do not export generated OpenAPI client types from HTTP layer |

---

## 10. Mapping: App route → QF path → contract method

Base app path: `GET /api/v1/quran/*` (JWT + `QuranRateLimitGuard`).

| App route | QF path | Contract method |
| --- | --- | --- |
| `/surahs` | `/chapters` | `getChapters` |
| `/surahs/:id` | `/chapters/:id` | `getChapter` |
| `/surahs/:id/info` | `/chapters/:id/info` | `getChapterInfo` |
| `/ayahs/by-surah/:chapter` | `/verses/by_chapter/:chapter` | `getVersesByChapter` |
| `/ayahs/by-key/:verseKey` | `/verses/by_key/:verseKey` | `getVersesByKey` |
| `/ayahs/daily` | wrapper → `by_key` | `getVersesByKey` (+ Daily Ayah envelope) |
| `/ayahs/by-juz/:juz` | `/verses/by_juz/:juz` | `getVersesByJuz` |
| `/ayahs/by-page/:page` | `/verses/by_page/:page` | `getVersesByPage` |
| `/juz` | `/juzs` | `getJuzs` |
| `/juz/:id` | `/juzs/:id` | `getJuz` |
| `/pages` | `/pages` | `getPages` |
| `/pages/:pageNumber` | `/pages/:n` | `getPage` |
| `/pages/lookup` | `/pages/lookup` | `lookupPages` |
| `/translations` | `/resources/translations` | `getTranslations` |
| `/translations/:id/info` | `/resources/translations/:id/info` | `getTranslationInfo` |
| `/translations/:id/by-surah/:c` | `/translations/:id/by_chapter/:c` | `getTranslationByChapter` |
| `/translations/:id/by-ayah/:k` | `/translations/:id/by_ayah/:k` | `getTranslationByAyah` |
| `/translations/:id/by-juz/:j` | `/translations/:id/by_juz/:j` | `getTranslationByJuz` |
| `/translations/:id/by-page/:p` | `/translations/:id/by_page/:p` | `getTranslationByPage` |
| `/tafsirs` | `/resources/tafsirs` | `getTafsirs` |
| `/tafsirs/:id/info` | `/resources/tafsirs/:id/info` | `getTafsirInfo` |
| `/tafsirs/:id/by-surah/:c` | `/tafsirs/:id/by_chapter/:c` | `getTafsirByChapter` |
| `/tafsirs/:id/by-ayah/:k` | `/tafsirs/:id/by_ayah/:k` | `getTafsirByAyah` |
| `/tafsirs/:id/by-juz/:j` | `/tafsirs/:id/by_juz/:j` | `getTafsirByJuz` |
| `/tafsirs/:id/by-page/:p` | `/tafsirs/:id/by_page/:p` | `getTafsirByPage` |
| `/audio/recitations` | `/resources/recitations` | `getRecitations` |
| `/audio/chapter-reciters` | `/resources/chapter_reciters` | `getChapterReciters` |
| `/audio/chapter-reciters/:id` | `/chapter_recitations/:id` | `getChapterAudioFiles` |
| `/audio/chapter-reciters/:id/:c` | `/chapter_recitations/:id/:c` | `getChapterAudioFile` |
| `/audio/recitations/:id/by-surah/:c` | `/recitations/:id/by_chapter/:c` | `getAyahAudioByChapter` |
| `/audio/recitations/:id/by-ayah/:k` | `/recitations/:id/by_ayah/:k` | `getAyahAudioByKey` |
| `/audio/reciters/:id/timestamps` | `/audio/reciters/:id/timestamp` | `getAudioTimestamps` |
| `/search` | `/search/v1/search` | `search` |

---

## 11. Gaps / unknowns / follow-ups

1. **Live QF OAuth:** discovery got `401` with current `QF_CLIENT_*` (hosts reachable). Re-run `scripts/qf-discovery-sample.ts` after credential/env fix; refresh [`qf-discovery-samples.json`](./qf-discovery-samples.json) and ID tables from authenticated catalogs.
2. **Clear Quran `131`:** present in QF docs examples; missing from public `api.quran.com` translation list — confirm on QF production/prelive.
3. **Search response schema:** docs portal page is thin; capture a live payload to harden `SearchResponse`.
4. **Chapter reciters:** public endpoint flaky (503); need authenticated sample for internal type fields.
5. **Audio URL TTL:** confirm whether CDN signed URLs expire; adjust `QF_CACHE_TTL_AUDIO_SECONDS` if needed.
6. **Follow-up engineering:** implement interface on Axios client, camelCase mappers, typed service returns, optional OpenAPI sync.

---

## Verification (this phase)

- [x] Contract covers every `QuranController` route + Daily Ayah
- [x] `contracts/` TypeScript added (unwired)
- [x] Discovery script present; samples + resource ID docs written
- [ ] Re-run live QF sample fetch when credentials succeed
