-- CreateEnum
CREATE TYPE "UserNotificationType" AS ENUM ('DAILY_REMINDER');

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "UserNotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "payload" JSONB,
    "dedupe_key" VARCHAR(64) NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_notifications_user_id_created_at_id_idx" ON "user_notifications"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "user_notifications_user_id_read_at_idx" ON "user_notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_user_id_type_dedupe_key_key" ON "user_notifications"("user_id", "type", "dedupe_key");

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
