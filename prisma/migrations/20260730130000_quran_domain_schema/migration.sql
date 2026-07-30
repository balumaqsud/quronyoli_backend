
-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "DailyGoalMetric" AS ENUM ('VERSES', 'MINUTES');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" UUID NOT NULL,
    "locale" VARCHAR(16) NOT NULL DEFAULT 'uz',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Tashkent',
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "arabic_font_size" INTEGER NOT NULL DEFAULT 24,
    "translation_font_size" INTEGER NOT NULL DEFAULT 16,
    "playback_rate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "auto_play_next" BOOLEAN NOT NULL DEFAULT false,
    "repeat_verse" BOOLEAN NOT NULL DEFAULT false,
    "default_translation_id" UUID,
    "default_tafsir_id" UUID,
    "default_reciter_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "quran_translations" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL DEFAULT 'quran.foundation',
    "external_id" VARCHAR(128) NOT NULL,
    "language_code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "author_name" VARCHAR(255),
    "slug" VARCHAR(128),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quran_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quran_tafsirs" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL DEFAULT 'quran.foundation',
    "external_id" VARCHAR(128) NOT NULL,
    "language_code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "author_name" VARCHAR(255),
    "slug" VARCHAR(128),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quran_tafsirs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quran_reciters" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(64) NOT NULL DEFAULT 'quran.foundation',
    "external_id" VARCHAR(128) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "arabic_name" VARCHAR(255),
    "style" VARCHAR(128),
    "slug" VARCHAR(128),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quran_reciters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chapter_number" INTEGER NOT NULL,
    "verse_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chapter_number" INTEGER NOT NULL,
    "verse_number" INTEGER NOT NULL,
    "word_number" INTEGER,
    "audio_offset_ms" INTEGER,
    "label" VARCHAR(120),
    "note" VARCHAR(2000),
    "color" VARCHAR(32),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "user_id" UUID NOT NULL,
    "chapter_number" INTEGER NOT NULL,
    "verse_number" INTEGER NOT NULL,
    "word_number" INTEGER,
    "last_translation_id" UUID,
    "last_tafsir_id" UUID,
    "last_reciter_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "reading_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "start_chapter_number" INTEGER NOT NULL,
    "start_verse_number" INTEGER NOT NULL,
    "end_chapter_number" INTEGER,
    "end_verse_number" INTEGER,
    "verses_read" INTEGER NOT NULL DEFAULT 0,
    "active_seconds" INTEGER NOT NULL DEFAULT 0,
    "client_session_key" VARCHAR(128),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_days" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "verses_read" INTEGER NOT NULL DEFAULT 0,
    "active_seconds" INTEGER NOT NULL DEFAULT 0,
    "sessions_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "metric" "DailyGoalMetric" NOT NULL,
    "target_value" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_goal_results" (
    "id" UUID NOT NULL,
    "daily_goal_id" UUID NOT NULL,
    "local_date" DATE NOT NULL,
    "actual_value" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_goal_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "event_name" VARCHAR(128) NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anonymous_id" VARCHAR(128),
    "device_id" VARCHAR(128),
    "session_id" VARCHAR(128),
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "properties" JSONB,
    "idempotency_key" VARCHAR(128),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_settings_default_translation_id_idx" ON "user_settings"("default_translation_id");

-- CreateIndex
CREATE INDEX "user_settings_default_tafsir_id_idx" ON "user_settings"("default_tafsir_id");

-- CreateIndex
CREATE INDEX "user_settings_default_reciter_id_idx" ON "user_settings"("default_reciter_id");

-- CreateIndex
CREATE INDEX "quran_translations_language_code_idx" ON "quran_translations"("language_code");

-- CreateIndex
CREATE INDEX "quran_translations_is_active_idx" ON "quran_translations"("is_active");

-- CreateIndex
CREATE INDEX "quran_translations_deleted_at_idx" ON "quran_translations"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "quran_translations_provider_external_id_key" ON "quran_translations"("provider", "external_id");

-- CreateIndex
CREATE INDEX "quran_tafsirs_language_code_idx" ON "quran_tafsirs"("language_code");

-- CreateIndex
CREATE INDEX "quran_tafsirs_is_active_idx" ON "quran_tafsirs"("is_active");

-- CreateIndex
CREATE INDEX "quran_tafsirs_deleted_at_idx" ON "quran_tafsirs"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "quran_tafsirs_provider_external_id_key" ON "quran_tafsirs"("provider", "external_id");

-- CreateIndex
CREATE INDEX "quran_reciters_is_active_idx" ON "quran_reciters"("is_active");

-- CreateIndex
CREATE INDEX "quran_reciters_deleted_at_idx" ON "quran_reciters"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "quran_reciters_provider_external_id_key" ON "quran_reciters"("provider", "external_id");

-- CreateIndex
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_chapter_number_verse_number_key" ON "favorites"("user_id", "chapter_number", "verse_number");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_created_at_idx" ON "bookmarks"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_chapter_number_verse_number_idx" ON "bookmarks"("user_id", "chapter_number", "verse_number");

-- CreateIndex
CREATE INDEX "bookmarks_deleted_at_idx" ON "bookmarks"("deleted_at");

-- CreateIndex
CREATE INDEX "reading_progress_last_translation_id_idx" ON "reading_progress"("last_translation_id");

-- CreateIndex
CREATE INDEX "reading_progress_last_tafsir_id_idx" ON "reading_progress"("last_tafsir_id");

-- CreateIndex
CREATE INDEX "reading_progress_last_reciter_id_idx" ON "reading_progress"("last_reciter_id");

-- CreateIndex
CREATE INDEX "reading_histories_user_id_started_at_idx" ON "reading_histories"("user_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "reading_histories_user_id_client_session_key_key" ON "reading_histories"("user_id", "client_session_key");

-- CreateIndex
CREATE INDEX "reading_days_user_id_local_date_idx" ON "reading_days"("user_id", "local_date");

-- CreateIndex
CREATE UNIQUE INDEX "reading_days_user_id_local_date_key" ON "reading_days"("user_id", "local_date");

-- CreateIndex
CREATE INDEX "daily_goals_user_id_is_enabled_deleted_at_idx" ON "daily_goals"("user_id", "is_enabled", "deleted_at");

-- CreateIndex
CREATE INDEX "daily_goals_user_id_metric_effective_from_idx" ON "daily_goals"("user_id", "metric", "effective_from");

-- CreateIndex
CREATE INDEX "daily_goal_results_local_date_idx" ON "daily_goal_results"("local_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_goal_results_daily_goal_id_local_date_key" ON "daily_goal_results"("daily_goal_id", "local_date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_events_idempotency_key_key" ON "analytics_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "analytics_events_user_id_occurred_at_idx" ON "analytics_events"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_event_name_occurred_at_idx" ON "analytics_events"("event_name", "occurred_at");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_default_translation_id_fkey" FOREIGN KEY ("default_translation_id") REFERENCES "quran_translations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_default_tafsir_id_fkey" FOREIGN KEY ("default_tafsir_id") REFERENCES "quran_tafsirs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_default_reciter_id_fkey" FOREIGN KEY ("default_reciter_id") REFERENCES "quran_reciters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_last_translation_id_fkey" FOREIGN KEY ("last_translation_id") REFERENCES "quran_translations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_last_tafsir_id_fkey" FOREIGN KEY ("last_tafsir_id") REFERENCES "quran_tafsirs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_last_reciter_id_fkey" FOREIGN KEY ("last_reciter_id") REFERENCES "quran_reciters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_histories" ADD CONSTRAINT "reading_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_days" ADD CONSTRAINT "reading_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_goals" ADD CONSTRAINT "daily_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_goal_results" ADD CONSTRAINT "daily_goal_results_daily_goal_id_fkey" FOREIGN KEY ("daily_goal_id") REFERENCES "daily_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Check constraints for Quran location coordinates and non-negative metrics
ALTER TABLE "user_settings"
  ADD CONSTRAINT "user_settings_arabic_font_size_check" CHECK ("arabic_font_size" > 0),
  ADD CONSTRAINT "user_settings_translation_font_size_check" CHECK ("translation_font_size" > 0),
  ADD CONSTRAINT "user_settings_playback_rate_check" CHECK ("playback_rate" > 0);

ALTER TABLE "favorites"
  ADD CONSTRAINT "favorites_chapter_number_check" CHECK ("chapter_number" BETWEEN 1 AND 114),
  ADD CONSTRAINT "favorites_verse_number_check" CHECK ("verse_number" >= 1);

ALTER TABLE "bookmarks"
  ADD CONSTRAINT "bookmarks_chapter_number_check" CHECK ("chapter_number" BETWEEN 1 AND 114),
  ADD CONSTRAINT "bookmarks_verse_number_check" CHECK ("verse_number" >= 1),
  ADD CONSTRAINT "bookmarks_word_number_check" CHECK ("word_number" IS NULL OR "word_number" >= 1),
  ADD CONSTRAINT "bookmarks_audio_offset_ms_check" CHECK ("audio_offset_ms" IS NULL OR "audio_offset_ms" >= 0);

ALTER TABLE "reading_progress"
  ADD CONSTRAINT "reading_progress_chapter_number_check" CHECK ("chapter_number" BETWEEN 1 AND 114),
  ADD CONSTRAINT "reading_progress_verse_number_check" CHECK ("verse_number" >= 1),
  ADD CONSTRAINT "reading_progress_word_number_check" CHECK ("word_number" IS NULL OR "word_number" >= 1);

ALTER TABLE "reading_histories"
  ADD CONSTRAINT "reading_histories_start_chapter_number_check" CHECK ("start_chapter_number" BETWEEN 1 AND 114),
  ADD CONSTRAINT "reading_histories_start_verse_number_check" CHECK ("start_verse_number" >= 1),
  ADD CONSTRAINT "reading_histories_end_chapter_number_check" CHECK ("end_chapter_number" IS NULL OR "end_chapter_number" BETWEEN 1 AND 114),
  ADD CONSTRAINT "reading_histories_end_verse_number_check" CHECK ("end_verse_number" IS NULL OR "end_verse_number" >= 1),
  ADD CONSTRAINT "reading_histories_verses_read_check" CHECK ("verses_read" >= 0),
  ADD CONSTRAINT "reading_histories_active_seconds_check" CHECK ("active_seconds" >= 0),
  ADD CONSTRAINT "reading_histories_time_range_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");

ALTER TABLE "reading_days"
  ADD CONSTRAINT "reading_days_verses_read_check" CHECK ("verses_read" >= 0),
  ADD CONSTRAINT "reading_days_active_seconds_check" CHECK ("active_seconds" >= 0),
  ADD CONSTRAINT "reading_days_sessions_count_check" CHECK ("sessions_count" >= 0);

ALTER TABLE "daily_goals"
  ADD CONSTRAINT "daily_goals_target_value_check" CHECK ("target_value" > 0),
  ADD CONSTRAINT "daily_goals_effective_range_check" CHECK ("effective_to" IS NULL OR "effective_to" >= "effective_from");

ALTER TABLE "daily_goal_results"
  ADD CONSTRAINT "daily_goal_results_actual_value_check" CHECK ("actual_value" >= 0);

-- Soft-delete-aware uniqueness: one active goal per user/metric without an end date
CREATE UNIQUE INDEX "daily_goals_user_metric_active_uidx"
  ON "daily_goals" ("user_id", "metric")
  WHERE "is_enabled" = true AND "deleted_at" IS NULL AND "effective_to" IS NULL;
