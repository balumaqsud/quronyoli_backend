-- Favorites: newest-first keyset list
DROP INDEX IF EXISTS "favorites_user_id_created_at_idx";
CREATE INDEX "favorites_user_id_created_at_id_idx"
  ON "favorites" ("user_id", "created_at" DESC, "id" DESC);

-- Bookmarks: active list keyset
DROP INDEX IF EXISTS "bookmarks_user_id_created_at_idx";
CREATE INDEX "bookmarks_user_id_created_at_id_idx"
  ON "bookmarks" ("user_id", "created_at" DESC, "id" DESC);

-- Bookmarks: active location lookup / uniqueness
DROP INDEX IF EXISTS "bookmarks_user_id_chapter_number_verse_number_idx";
CREATE INDEX "bookmarks_user_id_chapter_number_verse_number_idx"
  ON "bookmarks" ("user_id", "chapter_number", "verse_number");

CREATE UNIQUE INDEX "bookmarks_user_chapter_verse_active_uidx"
  ON "bookmarks" ("user_id", "chapter_number", "verse_number")
  WHERE "deleted_at" IS NULL;

-- Bookmarks: color filter among all rows (service filters deletedAt)
CREATE INDEX "bookmarks_user_id_color_idx"
  ON "bookmarks" ("user_id", "color");

-- Bookmarks: soft-delete / trash scoped by user
DROP INDEX IF EXISTS "bookmarks_deleted_at_idx";
CREATE INDEX "bookmarks_user_id_deleted_at_id_idx"
  ON "bookmarks" ("user_id", "deleted_at" DESC, "id" DESC);
