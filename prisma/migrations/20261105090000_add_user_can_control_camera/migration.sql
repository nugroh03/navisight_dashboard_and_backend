-- Izin kontrol kamera (PTZ, mic, dengarkan) per user; default tidak boleh.
ALTER TABLE "users" ADD COLUMN "canControlCamera" BOOLEAN NOT NULL DEFAULT false;
