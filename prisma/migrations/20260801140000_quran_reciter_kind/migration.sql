-- CreateEnum
CREATE TYPE "quran_reciter_kind" AS ENUM ('AYAH', 'CHAPTER');

-- AlterTable: add kind with backfill as AYAH for existing rows
ALTER TABLE "quran_reciters" ADD COLUMN "kind" "quran_reciter_kind" NOT NULL DEFAULT 'AYAH';

-- DropIndex
DROP INDEX IF EXISTS "quran_reciters_provider_external_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "quran_reciters_provider_external_id_kind_key" ON "quran_reciters"("provider", "external_id", "kind");

-- CreateIndex
CREATE INDEX "quran_reciters_kind_idx" ON "quran_reciters"("kind");

-- AlterTable: chapter reciter preference on user settings
ALTER TABLE "user_settings" ADD COLUMN "default_chapter_reciter_id" UUID;

-- CreateIndex
CREATE INDEX "user_settings_default_chapter_reciter_id_idx" ON "user_settings"("default_chapter_reciter_id");

-- AddForeignKey
ALTER TABLE "user_settings"
  ADD CONSTRAINT "user_settings_default_chapter_reciter_id_fkey"
  FOREIGN KEY ("default_chapter_reciter_id")
  REFERENCES "quran_reciters"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
