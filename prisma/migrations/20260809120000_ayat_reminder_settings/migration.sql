-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN "ayat_reminders_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_settings" ADD COLUMN "last_ayat_reminder_at" TIMESTAMP(3);

-- Backfill from existing daily reminder preferences so opted-in users keep receiving
UPDATE "user_settings" AS us
SET "ayat_reminders_enabled" = true
FROM "telegram_reminder_preferences" AS trp
WHERE us."user_id" = trp."user_id"
  AND trp."enabled" = true;
