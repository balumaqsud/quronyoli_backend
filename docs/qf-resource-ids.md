# Quran.Foundation curated resource IDs

Catalog snapshot used for Quron Yo'li product languages (`uz`, `en`, `ar`, `ru`).

**Source:** public Content catalog at `api.quran.com/api/v4` (2026-07-30), plus IDs cited in official QF OpenAPI examples. Re-verify with authenticated `GET /content/api/v4/resources/*` after OAuth credentials work against `apis.quran.foundation`.

**Do not hardcode these into Nest runtime yet** — settings already store user-selected IDs validated against a local catalog sync.

Full dump: [`qf-discovery-samples.json`](./qf-discovery-samples.json).

## Recommended defaults (settings)

| Setting | Language | Resource ID | Name |
| --- | --- | --- | --- |
| `defaultTranslationId` | uz | **55** | Muhammad Sodiq Muhammad Yusuf (Latin) |
| `defaultTranslationId` | en | **20** | Saheeh International |
| `defaultTranslationId` | en (alt) | **131** | Clear Quran (QF docs; confirm on live QF catalog) |
| `defaultTranslationId` | ru | **45** | Elmir Kuliev |
| `defaultTranslationId` | ar | — | Use verse `textUthmani` / mushaf fields; no Arabic “translation” catalog entry |
| `defaultTafsirId` | en | **169** | Ibn Kathir (Abridged) |
| `defaultTafsirId` | ar | **16** | Tafsir Muyassar |
| `defaultTafsirId` | ru | **170** | Al-Sa'di |
| `defaultReciterId` (ayah audio) | — | **7** | Mishari Rashid al-`Afasy |

## Translations (uz / en / ru)

### Uzbek

| ID | Name | Author | Slug |
| --- | ---: | --- | --- |
| 55 | Muhammad Sodiq Muhammad Yusuf (Latin) | Muhammad Sodiq Muhammad Yusuf | `quran.uz.sodik` |
| 101 | Alauddin Mansour | Alauddin Mansour | — |
| 127 | Muhammad Sodik Muhammad Yusuf | Muhammad Sodik Muhammad Yusuf | — |

### English (selected)

| ID | Name | Author | Slug |
| --- | ---: | --- | --- |
| 20 | Saheeh International | Saheeh International | `en-sahih-international` |
| 85 | M.A.S. Abdel Haleem | Abdul Haleem | `en-haleem` |
| 19 | M. Pickthall | Mohammed Marmaduke William Pickthall | `quran.en.pickthall` |
| 22 | A. Yusuf Ali | Abdullah Yusuf Ali | `quran.en.yusufali` |
| 203 | Al-Hilali & Khan | al-Hilali & Muhsin Khan | — |
| 131\* | Dr. Mustafa Khattab, the Clear Quran | Dr. Mustafa Khattab | `clearquran-with-tafsir` |

\*Cited in QF OpenAPI verse examples; absent from public `api.quran.com` list at snapshot time.

### Russian

| ID | Name | Author | Slug |
| --- | ---: | --- | --- |
| 45 | Russian Translation (Elmir Kuliev) | Elmir Kuliev | `quran.ru.kuliev` |
| 78 | Ministry of Awqaf, Egypt | Ministry of Awqaf, Egypt | `ru-ministry-of-awqaf` |
| 79 | Abu Adel | Abu Adel | `ru-abu-adel` |

### Kazakh (`kk`) / Tajik (`tg`)

Present in Content API (`language_name: kazakh|tajik`). Stored as ISO `kk` / `tg` after catalog sync.

| ID | Lang | Name | Author | Curated active |
| --- | ---: | --- | --- | --- |
| 222 | kk | Khalifa Altay | Khalifa Altay | yes |
| 113 | kk | Khalifah Altai | Khalifah Altai | yes |
| 139 | tg | Khawaja Mirof & Khawaja Mir | Khawaja Mirof & Khawaja Mir | yes |
| 223 | tg | Pioneers of Translation Center | Pioneers of Translation Center | yes |
| 74 | tg | Tajik | AbdolMohammad Ayati | yes |

### Kyrgyz (`ky`) — QuranEnc

Not in Quran Foundation Content API. Backend seeds catalog metadata and fetches bodies from QuranEnc:

| Field | Value |
| --- | --- |
| Provider | `quranenc` |
| External / resource id | `kyrgyz_hakimov` (string) |
| Translator | Shamsuddin Hakimov |
| Name | Kyrgyz — Shamsuddin Hakimov |
| Source | https://quranenc.com/en/browse/kyrgyz_hakimov |

Use `GET /quran/translations?language=ky` and `translations=kyrgyz_hakimov` on verse endpoints. Do not claim this edition is from Quran Foundation.

### Turkmen (`tk`)

**Not** in `GET /resources/translations` or `/resources/languages` on the Content API (as of 2026-08). Out of scope until a licensed source is added.

### Arabic

No translation resources with `language_name: arabic` in the public catalog. Arabic text is delivered on verse payloads (`text_uthmani`, `text_imlaei`, etc.).

## Tafsirs

| ID | Language | Name | Author |
| --- | ---: | --- | --- |
| 169 | english | Ibn Kathir (Abridged) | Hafiz Ibn Kathir |
| 168 | english | Ma'arif al-Qur'an | Mufti Muhammad Shafi |
| 16 | arabic | Tafsir Muyassar | المیسر |
| 14 | arabic | Tafsir Ibn Kathir | Hafiz Ibn Kathir |
| 15 | arabic | Tafsir al-Tabari | Tabari |
| 91 | arabic | Al-Sa'di | Saddi |
| 170 | russian | Al-Sa'di | Saddi |

No Uzbek tafsir in the public catalog snapshot (20 total tafsirs).

## Recitations (ayah-by-ayah)

| ID | Reciter | Style |
| --- | ---: | --- |
| 7 | Mishari Rashid al-`Afasy | — |
| 2 | AbdulBaset AbdulSamad | Murattal |
| 1 | AbdulBaset AbdulSamad | Mujawwad |
| 3 | Abdur-Rahman as-Sudais | — |
| 4 | Abu Bakr al-Shatri | — |
| 5 | Hani ar-Rifai | — |
| 6 | Mahmoud Khalil Al-Husary | — |
| 12 | Mahmoud Khalil Al-Husary | Muallim |
| 9 | Mohamed Siddiq al-Minshawi | Murattal |
| 8 | Mohamed Siddiq al-Minshawi | Mujawwad |
| 10 | Sa`ud ash-Shuraym | — |
| 11 | Mohamed al-Tablawi | — |

Chapter-level reciters (`/resources/chapter_reciters`) are a separate catalog; re-fetch when QF auth works (public endpoint returned 503 during discovery).
