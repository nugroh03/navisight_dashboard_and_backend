-- Riwayat hidup/mati perangkat (PC lokal, kamera, internet Starlink). Hanya menambah tabel baru.
-- CreateTable
CREATE TABLE "monitor_agents" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "timeout_sec" INTEGER NOT NULL DEFAULT 180,
    "last_seen_at" TIMESTAMPTZ(6),
    "last_boot_id" VARCHAR(64),
    "lost_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monitor_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitored_devices" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "camera_id" UUID,
    "current_status" VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    "status_since" TIMESTAMPTZ(6),
    "last_checked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "monitored_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_status_logs" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(40),
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "provisional" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monitor_agents_token_hash_key" ON "monitor_agents"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "monitored_devices_agent_id_key_key" ON "monitored_devices"("agent_id", "key");

-- CreateIndex
CREATE INDEX "device_status_logs_device_id_started_at_idx" ON "device_status_logs"("device_id", "started_at");

-- CreateIndex
CREATE INDEX "device_status_logs_started_at_idx" ON "device_status_logs"("started_at");

-- AddForeignKey
ALTER TABLE "monitored_devices" ADD CONSTRAINT "monitored_devices_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "monitor_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitored_devices" ADD CONSTRAINT "monitored_devices_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_status_logs" ADD CONSTRAINT "device_status_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "monitored_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Satu perangkat hanya boleh punya satu periode yang masih berjalan (ended_at kosong).
-- Tidak bisa dinyatakan di schema.prisma, jadi ditulis manual.
CREATE UNIQUE INDEX "device_status_logs_one_open_per_device" ON "device_status_logs"("device_id") WHERE "ended_at" IS NULL;
