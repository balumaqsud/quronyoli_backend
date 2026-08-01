# Madani Mushaf Pages — Audit & Implementation Report

## Summary

Quron Yo'li now syncs **604 Madani Mushaf page metadata rows** into PostgreSQL (`mushaf_pages`) from Quran.Foundation Content v4, serves list/detail from DB + Redis, and proxies verse bodies on demand. **Verse Arabic/translation/audio text is never stored.**

Upstream host: `https://apis.quran.foundation/content/api/v4` (authenticated Quran.com Content API). Public `api.quran.com` is not used in production.

Default mushaf: **`mushaf=1`** (QCF V2 / recommended Madani).

---

## What already existed

| Area | Status |
| --- | --- |
| `GET /api/v1/quran/pages`, `/pages/:n`, `/pages/lookup` | Live QF proxy + Redis (`chapters` TTL) |
| `GET /api/v1/quran/ayahs/by-page/:page` | Live QF `/verses/by_page/{n}` proxy |
| Static `GET /mushafs` | Hardcoded IDs 1–7, 19 (no `/resources/mushafs` upstream) |
| Media URL normalizer | Protocol-relative `image_url` → `https:` |
| Catalog sync | Translations / tafsirs / reciters only |

## What was missing

- Local page index for all 604 pages
- Typed page responses (`first_verse_key`, `surah_ids`, juz/hizb/rub, verse_count)
- `GET /pages/:page/verses` convenience route
- Default division `fields` on page verse fetches
- Sync CLI for page metadata
- Swagger response DTOs for page metadata

## What was added

- Prisma model `MushafPage` → table `mushaf_pages` (coordinates + optional verse image meta only)
- Sync: `npm run qf:sync-pages` → fetches `/verses/by_page/{1..604}` and upserts rows
- DB-backed `GET /pages` and `GET /pages/:pageNumber` (Redis namespace `pages`)
- `GET /pages/:pageNumber/verses` (QF proxy; defaults `fields` + `mushaf=1`)
- Docs / Swagger / unit tests

---

## Quran.Foundation endpoints used

| Purpose | Upstream |
| --- | --- |
| Page metadata sync | `GET /verses/by_page/{n}?mushaf=1&fields=verse_key,juz_number,hizb_number,rub_el_hizb_number,page_number,image_url,image_width` |
| Page verses (runtime) | `GET /verses/by_page/{n}` (same; client may add translations/words/audio) |
| Page boundary lookup | `GET /pages/lookup` (unchanged live proxy) |
| Mushaf catalog | **Not available** (`/resources/mushafs` → 404); static map in app |

### Images

- No full-page Mushaf PNG catalog from QF.
- Per-verse `image_url` / `image_width` when requested; sync stores the **first** verse image on the page row (normalized to `https:`).

---

## App routes

All under `/api/v1/quran`, JWT + rate limit:

| Method | Path | Source |
| --- | --- | --- |
| GET | `/pages?mushaf=1` | Postgres `mushaf_pages` + Redis |
| GET | `/pages/:pageNumber` | Postgres + Redis |
| GET | `/pages/:pageNumber/verses` | QF proxy + Redis (`verses` TTL) |
| GET | `/ayahs/by-page/:page` | Alias of `/pages/:page/verses` |
| GET | `/pages/lookup` | QF proxy |

### Sync

```bash
npm run qf:sync-pages
# production build:
npm run qf:sync-pages:prod
```

Expect ~604 upserts for mushaf `1`. Empty DB → `GET /pages` returns **404** with a sync hint until the job completes.
