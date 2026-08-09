-- Seed Kyrgyz (Shamsuddin Hakimov) as a QuranEnc catalog metadata row.
-- Ayah text is NOT stored; bodies are fetched live from QuranEnc.

INSERT INTO "quran_translations" (
  "id",
  "provider",
  "external_id",
  "language_code",
  "name",
  "author_name",
  "slug",
  "is_active",
  "is_default",
  "sort_order",
  "metadata",
  "created_at",
  "updated_at"
)
VALUES (
  gen_random_uuid(),
  'quranenc',
  'kyrgyz_hakimov',
  'ky',
  'Kyrgyz — Shamsuddin Hakimov',
  'Shamsuddin Hakimov',
  'kyrgyz_hakimov',
  true,
  false,
  0,
  jsonb_build_object(
    'id', 'kyrgyz_hakimov',
    'name', 'Kyrgyz — Shamsuddin Hakimov',
    'author_name', 'Shamsuddin Hakimov',
    'language_name', 'Kyrgyz',
    'slug', 'kyrgyz_hakimov',
    'provider', 'quranenc',
    'attribution', 'Kyrgyz translation by Shamsuddin Hakimov. Source: QuranEnc / Encyclopedia of the Noble Quran',
    'source_url', 'https://quranenc.com/en/browse/kyrgyz_hakimov',
    'quranenc_key', 'kyrgyz_hakimov'
  ),
  NOW(),
  NOW()
)
ON CONFLICT ("provider", "external_id") DO UPDATE SET
  "language_code" = EXCLUDED."language_code",
  "name" = EXCLUDED."name",
  "author_name" = EXCLUDED."author_name",
  "slug" = EXCLUDED."slug",
  "metadata" = EXCLUDED."metadata",
  "deleted_at" = NULL,
  "updated_at" = NOW();
