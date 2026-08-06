# Madani Mushaf Pages — Audit & Implementation Report

## Summary

Quron Yo'li syncs **604 Madani Mushaf page metadata rows** into PostgreSQL (`mushaf_pages`) from Quran.Foundation Content v4, serves list/detail from DB + Redis (`page:1` … `page:604`), and composes verse bodies on demand from QF. **Verse Arabic/translation/audio text is never stored** — only relationships (`verse_keys`, `surah_ids`, juz/hizb/rub).

Upstream host: `https://apis.quran.foundation/content/api/v4` (authenticated Quran.com Content API).

Default mushaf: **`mushaf=1`** (QCF V2 / recommended Madani).

---

## Audit verdict

| Requirement | Status |
| --- | --- |
| Sync CLI for 604 Madani pages | `npm run qf:sync-pages` → `QfPagesSyncService` |
| Table `mushaf_pages` (coords only) | Prisma `MushafPage` (superset of suggested columns) |
| Every verse on exactly one page | Sync asserts disjoint `verse_keys` and total **6236** unique keys |
| REST under `/api/v1/quran/pages*` | List, detail, verses (+ ayahs-by-page alias) |
| Redis `page:{n}` | Literal keys for metadata; list `pages:list`; verses `page:{n}:verses:{digest}` |
| Swagger | CamelCase DTOs for list, detail, and verses composition |

---

## Data model

Postgres stores page coordinates only:

- `page_number`, `first_verse_key`, `last_verse_key`, `verse_count`
- `verse_keys[]`, `surah_ids[]`
- `juz_number`, `hizb_number`, `rub_el_hizb_number` (+ multi-value arrays when a page spans divisions)
- optional full-page `image_url` / `image_width` for **image mushafs** (id 10 Dar al-Marefa). Verse-level QF `image_url` ayah strips are **not** stored as page art.
- `created_at` / `updated_at` / `synced_at`

No Arabic, translations, tafsir, or audio blobs.

---

## Quran.Foundation endpoints used

| Purpose | Upstream |
| --- | --- |
| Page metadata sync | `GET /verses/by_page/{n}?mushaf=1&fields=verse_key,juz_number,…` |
| Page verses (runtime) | `GET /verses/by_page/{n}` (client may add `translations`, `audio`, `tafsirs`) |
| Page boundary lookup | `GET /pages/lookup` (live proxy) |

---

## App routes

All under `/api/v1/quran`, JWT + rate limit:

| Method | Path | Source | Response |
| --- | --- | --- | --- |
| GET | `/pages?mushaf=1` | Postgres + Redis `pages:list` | `{ pages: [{ page, firstVerse, lastVerse, verseCount }, …], total, totalPages }` |
| GET | `/pages/:pageNumber` | Postgres + Redis `page:{n}` | CamelCase page metadata (incl. `verses` as keys) |
| GET | `/pages/:pageNumber/verses` | Local meta + QF verses | `{ page, verses }` — Arabic + words by default; translations/audio/tafsir via query |
| GET | `/ayahs/by-page/:page` | Same as `/pages/:page/verses` | Same composed payload |
| GET | `/pages/lookup` | QF proxy | Upstream lookup |

### Example list item

```json
{ "page": 1, "firstVerse": "1:1", "lastVerse": "1:7", "verseCount": 7 }
```

### Redis keys

| Key | Payload |
| --- | --- |
| `page:1` … `page:604` | Full page metadata (camelCase) |
| `pages:list` | Compact list array |
| `page:{n}:verses:{digest}` | Composed `{ page, verses }` (digest from query params) |
| `page:{mushaf}:{n}` / `pages:list:{mushaf}` | Same when `mushaf != 1` |

(App Redis `keyPrefix` still applies.)

### Sync

```bash
# Default mushaf=1 (full QF crawl)
npm run qf:sync-pages

# Multiple Madani editions (604-page layout): clone coords from mushaf 1
npm run qf:sync-pages -- --mushaf=1,4,5,19 --clone-from=1

# Dar al-Marefa / Uthmani Tajweed Images (mushaf 10): full QF crawl — do NOT clone from 1
# (page breaks differ; page image URLs are attached during sync)
npm run qf:sync-pages -- --mushaf=10

# production build:
npm run qf:sync-pages:prod
npm run qf:sync-pages:prod -- --mushaf=4,5,19 --clone-from=1
```

Page serving is **per mushaf id**. Frontend Settings editions (QCF V2, QPC Hafs, Uthmani, QCF V4 Tajweed) each need synced rows or `GET /pages?mushaf=N` returns **404**. Editions that share the Madani 604 layout can use `--clone-from=1` instead of a full QF crawl.

After sync:

- Exactly **604** active rows **per mushaf id**
- Exactly **6236** unique `verse_keys` with no cross-page duplicates
- Redis `page:{n}` / `pages:list` (and `page:{mushaf}:{n}` / `pages:list:{mushaf}`) warmed

Empty DB → `GET /pages` returns **404** with a sync hint until the job completes.
