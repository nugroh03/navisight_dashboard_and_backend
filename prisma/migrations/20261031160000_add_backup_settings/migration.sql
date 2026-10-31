-- CreateTable
CREATE TABLE "backup_settings" (
    "id" VARCHAR(20) NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "time" VARCHAR(5) NOT NULL DEFAULT '02:00',
    "keep" INTEGER NOT NULL DEFAULT 14,
    "last_auto_date" VARCHAR(10),
    "last_attempt_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "account_id" VARCHAR(64),
    "bucket" VARCHAR(63),
    "access_key_id" VARCHAR(128),
    "secret_enc" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "backup_settings_pkey" PRIMARY KEY ("id")
);

