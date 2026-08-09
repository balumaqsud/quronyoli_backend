# Backend guide for frontend (post–QF updates)

Base URL: `{API}/api/v1`  
Auth: `Authorization: Bearer <accessToken>` on all `/quran/*` routes.

Nest is **not** a raw Quran.com clone. It proxies Quran Foundation Content API v4 for verse/audio/tafsir bodies, and serves **local synced** Madani page metadata from Postgres.

```mermaid
flowchart LR
  FE[Frontend]
  Nest[Nest_api_v1_quran]
  PG[(mushaf_pages)]
  QF[QuranFoundation]

  FE -->|pages list detail| Nest --> PG
  FE -->|page verses ayahs| Nest --> QF
  FE -->|surahs translations audio| Nest --> QF
```

---

## What changed (for FE)

| Change | Meaning for FE |
| --- | --- |
| `GET /quran/pages` shape | Now `{ pages, total, totalPages }` — **not** a bare array |
| Page verses completeness | Backend defaults `per_page=50` and auto-fetches until `verseCount` ayahs |
| Page verse defaults | Always merges `text_uthmani`, `chapter_id`, `verse_number`, `verse_key`, juz/hizb/rub/page, sajdah |
| Response extras | Page verses include `pagination: { total_records, complete, ... }` |
| Scripts | `indopak_nastaleeq` allowed on `GET /quran/scripts/:script` |

---

## Mushaf book mode — call these

### 1. List pages (bounds / total)

`GET /quran/pages?mushaf=1`

```json
{
  "pages": [
    { "page": 1, "firstVerse": "1:1", "lastVerse": "1:7", "verseCount": 7 }
  ],
  "total": 604,
  "totalPages": 604
}
```

Use `total` / `totalPages` for footer `n/604`. Do **not** hardcode 604 if this is present.

### 2. Page metadata (header chrome)

`GET /quran/pages/:pageNumber?mushaf=1`

CamelCase local DTO:

- `pageNumber`, `mushafId`, `firstVerseKey`, `lastVerseKey`, `verseCount`
- `surahIds`, `juzNumber`, `hizbNumber`, `rubElHizb`
- `verses`: **string keys only** (e.g. `"112:1"`) — not Arabic text
- `imageUrl` / `imageWidth`: full-page art for **image mushafs** only:
  - mushaf **10** (Dar al-Marefa, `isStandard: true`) — external WebP CDN (e.g. `…/776x1053-webp/1.webp`)
  - mushaf **1405** (classic Medina 1405) — self-hosted `/uploads/mushaf/1405/{page}.webp` when `QF_MUSHAF_1405_IMAGE_BASE` is set **and** 604 pages are synced; otherwise the edition is **omitted** from `GET /mushafs` (do not show it in the picker)
  - Glyph/unicode mushafs (1, 2, …) → `null` — never treat QF verse ayah-strip URLs as page scans

Book / image mode:
- Standard book: `GET /quran/pages/:pageNumber?mushaf=10` (full sync — do **not** clone from mushaf 1)
- Classic 1405: `GET /quran/pages/:pageNumber?mushaf=1405` once assets + pages are in place

**Enable Classic Medina 1405:**

1. Upload `1.webp`…`604.webp` to `uploads/mushaf/1405/`
2. Run `./scripts/deploy.sh` or `./scripts/update.sh` (auto-sets `PUBLIC_API_ORIGIN` / `QF_MUSHAF_1405_IMAGE_BASE` and syncs page rows)
3. `GET /quran/mushafs` then includes id **1405** (`key: madina-1405`)

`GET /quran/mushafs` includes `isStandard` — use the `true` entry (id **10**) as the FE book-mode default. API omit-`mushaf=` still defaults to **1** (QCF V2 text).

404 = pages not synced → backend needs `./scripts/sync-qf.sh` or `npm run qf:sync-pages`.

### 3. Page body (Arabic + optional tajweed)

`GET /quran/pages/:pageNumber/verses?mushaf=1&per_page=50`

Optional query (snake_case, QF names):

- `fields=text_uthmani_tajweed` (merged with defaults)
- `translations=<id>`
- `tafsirs=<id>`
- `audio=<recitationId>`
- `words=true` (default on)

Response:

```json
{
  "page": { },
  "verses": [ ],
  "pagination": {
    "per_page": 50,
    "total_records": 15,
    "complete": true,
    "next_page": null
  }
}
```

**Verse wire fields (snake_case from QF):**  
`verse_key`, `chapter_id`, `verse_number`, `text_uthmani`, optional `text_uthmani_tajweed`, `page_number`, `juz_number`, `hizb_number`, `rub_el_hizb_number`, `sajdah_number` / `sajdah_type`, `words[]`.

**FE rule:** if `page.verseCount` is set and `verses.length !== verseCount`, treat as error (incomplete page). Prefer `pagination.complete === true`.

Alias: `GET /quran/ayahs/by-page/:page` → same payload.

### 4. Open from surah/ayah

`GET /quran/pages/lookup?mushaf=1&chapter_number=112`  
(optional `from` / `to` / `page_number` / `juz_number`)

Returns QF lookup JSON (pass-through). Use to resolve Madani page number.

---

## Other Quran endpoints FE already uses

| Need | Endpoint | Notes |
| --- | --- | --- |
| Surah list / names / `bismillah_pre` | `GET /quran/surahs?language=` | Live QF snake_case |
| Surah stream mode | `GET /quran/ayahs/by-surah/:id` | Same verse query params |
| Single ayah | `GET /quran/ayahs/by-key/:key` | Also records reading progress |
| Translations catalog | `GET /quran/translations` | **Local** active catalog. Optional `?language=` accepts ISO 639-1 (`kk`, `tg`, `ky`, `tk`) **and** app chip aliases (`kz`→`kk`, `kg`/`kgz`→`ky`). Kyrgyz (`ky`) is QuranEnc (`id: "kyrgyz_hakimov"`, `provider: "quranenc"`) — string id, not a QF number. |
| Reciters | `GET /quran/audio/chapter-reciters` | **Local** active catalog |
| Chapter audio | `GET /quran/audio/chapter-reciters/:id/:chapter` | Live QF |
| Mushaf picker | `GET /quran/mushafs` | **Static** catalog; image **10** (`isStandard`) + **1405**; glyph ids 1, 2, 4, 5, 19, … |
| Tajweed script bulk | `GET /quran/scripts/uthmani_tajweed` | Optional; page verses + `fields=` is enough |

---

## Important FE rules

1. **Never invent** which ayahs sit on a page — only use `/pages/:n/verses`.
2. **Page meta** (`juz`, `surahIds`) comes from `/pages/:n`; verse Arabic from `/pages/:n/verses`.
3. Responses may be wrapped in the app envelope (`data` / success) — unwrap as today.
4. Mixed casing: page DTOs = **camelCase**; verse bodies = **snake_case** QF (your mappers already handle both).
5. Default **API** mushaf id = **1** (QCF V2) when `mushaf=` omitted. Book-mode FE default = catalog entry with `isStandard: true` (**10**). Pass `mushaf=10` or `mushaf=1405` for page images; handle `<img onError>` — do not show a silent broken `?`.
6. Empty DB → 404 with message to run sync — show sync/retry UI, not fake Madani tables.
7. Do **not** use verse-level QF `image_url` (e.g. `91_1.png` ~675×52) as full-page art.
8. **Central Asian translation chips:** prefer ISO codes `kk` (Kazakh), `tg` (Tajik), `ky` (Kyrgyz), `tk` (Turkmen). Country chips `KZ`/`KG` are accepted as aliases for `kk`/`ky`. Kazakh (`222`, `113`) and Tajik (`139`, `223`, `74`) sync from Quran Foundation. **Kyrgyz** is served from **QuranEnc** (not QF): catalog id / `translations=` value is the string **`kyrgyz_hakimov`** (`provider: quranenc`). Pass `translations=kyrgyz_hakimov` (alone or mixed with QF numeric ids, e.g. `55,kyrgyz_hakimov`). Arabic always comes from Quran Foundation. Attribution: “Kyrgyz translation by Shamsuddin Hakimov. Source: QuranEnc / Encyclopedia of the Noble Quran”. Turkmen remains unavailable until a licensed source is added. UI language and Quran translation language are separate — selecting Kyrgyz does not require changing the app locale.

---

## Quick test

```bash
# list
curl -H "Authorization: Bearer $TOKEN" "$API/api/v1/quran/pages?mushaf=1"

# page 604 meta + 15 ayahs
curl -H "Authorization: Bearer $TOKEN" "$API/api/v1/quran/pages/604"
curl -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/quran/pages/604/verses?per_page=50&fields=text_uthmani,text_uthmani_tajweed"
```

Expected for 604: `surahIds: [112,113,114]`, `verseCount: 15`, `verses.length === 15`, `firstVerseKey: "112:1"`, `lastVerseKey: "114:6"`.

---

## Out of product scope (do not expect from Nest yet)

Hadith, Answers, Quran Reflect, verses-by-range, random verse (use Daily Ayah instead).

Related docs: [mushaf-pages.md](./mushaf-pages.md), [rest-api.md](./rest-api.md), [quran-foundation.md](./quran-foundation.md).
