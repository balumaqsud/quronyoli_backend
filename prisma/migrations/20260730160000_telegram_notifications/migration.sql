-- CreateEnum
CREATE TYPE "NotificationDeliveryType" AS ENUM ('DAILY_REMINDER');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "telegram_reminder_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "local_time" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_reminder_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationDeliveryType" NOT NULL,
    "local_date" DATE NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "telegram_message_id" VARCHAR(64),
    "error_message" VARCHAR(512),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_reminder_preferences_user_id_key" ON "telegram_reminder_preferences"("user_id");

-- CreateIndex
CREATE INDEX "telegram_reminder_preferences_enabled_local_time_idx" ON "telegram_reminder_preferences"("enabled", "local_time");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_local_date_idx" ON "notification_deliveries"("status", "local_date");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_user_id_type_local_date_key" ON "notification_deliveries"("user_id", "type", "local_date");

-- AddForeignKey
ALTER TABLE "telegram_reminder_preferences" ADD CONSTRAINT "telegram_reminder_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Constraints
ALTER TABLE "telegram_reminder_preferences"
  ADD CONSTRAINT "telegram_reminder_preferences_local_time_check"
  CHECK ("local_time" ~ '^(?:[01]\\d|2[0-3]):[0-5]\\d$');
