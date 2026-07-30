-- CreateTable
CREATE TABLE "reading_ayah_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chapter_number" INTEGER NOT NULL,
    "verse_number" INTEGER NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_ayah_histories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reading_ayah_histories_chapter_check" CHECK ("chapter_number" >= 1 AND "chapter_number" <= 114),
    CONSTRAINT "reading_ayah_histories_verse_check" CHECK ("verse_number" >= 1)
);

-- CreateTable
CREATE TABLE "reading_verse_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chapter_number" INTEGER NOT NULL,
    "verse_number" INTEGER NOT NULL,
    "first_read_at" TIMESTAMP(3) NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL,
    "read_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_verse_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reading_verse_progress_chapter_check" CHECK ("chapter_number" >= 1 AND "chapter_number" <= 114),
    CONSTRAINT "reading_verse_progress_verse_check" CHECK ("verse_number" >= 1),
    CONSTRAINT "reading_verse_progress_read_count_check" CHECK ("read_count" >= 1)
);

-- CreateIndex
CREATE INDEX "reading_ayah_histories_user_id_opened_at_id_idx" ON "reading_ayah_histories"("user_id", "opened_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "reading_ayah_histories_user_id_chapter_number_verse_number_opened_at_idx" ON "reading_ayah_histories"("user_id", "chapter_number", "verse_number", "opened_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reading_verse_progress_user_id_chapter_number_verse_number_key" ON "reading_verse_progress"("user_id", "chapter_number", "verse_number");

-- CreateIndex
CREATE INDEX "reading_verse_progress_user_id_last_read_at_chapter_number_verse_number_idx" ON "reading_verse_progress"("user_id", "last_read_at" DESC, "chapter_number", "verse_number");

-- CreateIndex
CREATE INDEX "reading_verse_progress_user_id_chapter_number_idx" ON "reading_verse_progress"("user_id", "chapter_number");

-- Drop redundant ascending reading_days index and replace with DESC for range scans
DROP INDEX IF EXISTS "reading_days_user_id_local_date_idx";

-- CreateIndex
CREATE INDEX "reading_days_user_id_local_date_idx" ON "reading_days"("user_id", "local_date" DESC);

-- AddForeignKey
ALTER TABLE "reading_ayah_histories" ADD CONSTRAINT "reading_ayah_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_verse_progress" ADD CONSTRAINT "reading_verse_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
