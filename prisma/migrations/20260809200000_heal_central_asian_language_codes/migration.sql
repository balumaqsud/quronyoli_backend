-- Remap legacy full-name language_code values to ISO 639-1 so app filters
-- (kk/tg/ky/tk and KZ/KG aliases) match catalog rows after Central Asian mapping.

UPDATE "quran_translations"
SET "language_code" = 'kk'
WHERE "language_code" = 'kazakh';

UPDATE "quran_translations"
SET "language_code" = 'tg'
WHERE "language_code" = 'tajik';

UPDATE "quran_translations"
SET "language_code" = 'ky'
WHERE "language_code" = 'kyrgyz';

UPDATE "quran_translations"
SET "language_code" = 'tk'
WHERE "language_code" = 'turkmen';

-- Curated Central Asian editions (Kazakh + Tajik) stay/become active.
UPDATE "quran_translations"
SET "is_active" = true
WHERE "provider" = 'quran.foundation'
  AND "deleted_at" IS NULL
  AND "external_id" IN ('222', '113', '139', '223', '74');
