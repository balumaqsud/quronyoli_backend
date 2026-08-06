-- AlterTable quran_tafsirs: admin reorder support
ALTER TABLE "quran_tafsirs" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "quran_tafsirs_sort_order_idx" ON "quran_tafsirs"("sort_order");
