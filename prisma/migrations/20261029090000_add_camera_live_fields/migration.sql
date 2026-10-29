-- Live view via go2rtc + kontrol ISAPI. Hanya menambah kolom; data lama tidak berubah.
ALTER TABLE "cameras" ADD COLUMN "go2rtcStream" VARCHAR(64);
ALTER TABLE "cameras" ADD COLUMN "isapiHost" VARCHAR(255);
ALTER TABLE "cameras" ADD COLUMN "ptzEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cameras" ADD COLUMN "audioEnabled" BOOLEAN NOT NULL DEFAULT false;
