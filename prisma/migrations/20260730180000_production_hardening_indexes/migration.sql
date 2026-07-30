-- Bookmark active list: matches deleted_at IS NULL + order by created_at, id
CREATE INDEX IF NOT EXISTS "bookmarks_user_id_created_at_id_active_idx"
ON "bookmarks" ("user_id", "created_at" DESC, "id" DESC)
WHERE "deleted_at" IS NULL;

-- Reading verse progress cursor: order by last_read_at, id
DROP INDEX IF EXISTS "reading_verse_progress_user_id_last_read_at_chapter_number_verse_number_idx";
CREATE INDEX IF NOT EXISTS "reading_verse_progress_user_id_last_read_at_id_idx"
ON "reading_verse_progress" ("user_id", "last_read_at" DESC, "id" DESC);

-- Active reading days for streak/date scans
CREATE INDEX IF NOT EXISTS "reading_days_user_id_local_date_active_idx"
ON "reading_days" ("user_id", "local_date" DESC)
WHERE "verses_read" > 0;
