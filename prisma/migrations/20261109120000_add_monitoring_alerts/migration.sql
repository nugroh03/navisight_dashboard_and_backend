-- AlterTable
ALTER TABLE "monitor_agents" ADD COLUMN "alert_sent_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "monitored_devices" ADD COLUMN "alert_sent_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "monitoring_settings" (
    "id" VARCHAR(20) NOT NULL DEFAULT 'default',
    "telegram_enabled" BOOLEAN NOT NULL DEFAULT false,
    "telegram_token_enc" TEXT,
    "telegram_chat_id" VARCHAR(64),
    "alert_delay_min" INTEGER NOT NULL DEFAULT 5,
    "notify_recovery" BOOLEAN NOT NULL DEFAULT true,
    "last_error" TEXT,
    "last_sent_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monitoring_settings_pkey" PRIMARY KEY ("id")
);
