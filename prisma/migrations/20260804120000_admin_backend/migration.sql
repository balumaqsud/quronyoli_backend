-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- AlterTable users
ALTER TABLE "users" ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "users_is_banned_idx" ON "users"("is_banned");
CREATE INDEX "users_last_login_at_idx" ON "users"("last_login_at");
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- AlterTable quran_translations
ALTER TABLE "quran_translations" ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quran_translations" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "quran_translations_is_default_idx" ON "quran_translations"("is_default");
CREATE INDEX "quran_translations_sort_order_idx" ON "quran_translations"("sort_order");

-- AlterTable quran_reciters
ALTER TABLE "quran_reciters" ADD COLUMN "is_popular" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quran_reciters" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "quran_reciters_is_popular_idx" ON "quran_reciters"("is_popular");
CREATE INDEX "quran_reciters_sort_order_idx" ON "quran_reciters"("sort_order");

-- CreateTable admins
CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "admin_role" NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admins_user_id_key" ON "admins"("user_id");
CREATE INDEX "admins_role_idx" ON "admins"("role");

ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admins" ADD CONSTRAINT "admins_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable admin_logs
CREATE TABLE "admin_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "entity" VARCHAR(64) NOT NULL,
    "entity_id" UUID,
    "description" VARCHAR(1000),
    "ip_address" VARCHAR(128),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_logs_admin_id_created_at_idx" ON "admin_logs"("admin_id", "created_at" DESC);
CREATE INDEX "admin_logs_entity_entity_id_idx" ON "admin_logs"("entity", "entity_id");
CREATE INDEX "admin_logs_created_at_idx" ON "admin_logs"("created_at" DESC);

ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
