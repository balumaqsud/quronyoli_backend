-- Madani Mushaf page metadata (coordinates only; no verse text bodies).
CREATE TABLE "mushaf_pages" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL DEFAULT 'quran.foundation',
    "mushaf_id" INTEGER NOT NULL DEFAULT 1,
    "page_number" INTEGER NOT NULL,
    "first_verse_key" VARCHAR(16) NOT NULL,
    "last_verse_key" VARCHAR(16) NOT NULL,
    "verse_keys" TEXT[] NOT NULL,
    "surah_ids" INTEGER[] NOT NULL,
    "juz_number" INTEGER NOT NULL,
    "hizb_number" INTEGER NOT NULL,
    "rub_el_hizb_number" INTEGER NOT NULL,
    "juz_numbers" INTEGER[] NOT NULL,
    "hizb_numbers" INTEGER[] NOT NULL,
    "rub_el_hizb_numbers" INTEGER[] NOT NULL,
    "verse_count" INTEGER NOT NULL,
    "image_url" VARCHAR(512),
    "image_width" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mushaf_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mushaf_pages_provider_mushaf_id_page_number_key"
  ON "mushaf_pages"("provider", "mushaf_id", "page_number");

CREATE INDEX "mushaf_pages_mushaf_id_page_number_idx"
  ON "mushaf_pages"("mushaf_id", "page_number");

CREATE INDEX "mushaf_pages_is_active_idx" ON "mushaf_pages"("is_active");

ALTER TABLE "mushaf_pages"
  ADD CONSTRAINT "mushaf_pages_page_number_check"
  CHECK ("page_number" >= 1 AND "page_number" <= 604);

ALTER TABLE "mushaf_pages"
  ADD CONSTRAINT "mushaf_pages_verse_count_check"
  CHECK ("verse_count" >= 0);
