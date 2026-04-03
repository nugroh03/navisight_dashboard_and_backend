# Changelog

## [0.8.0] - 2026-04-03

### Added
- Halaman **Storage** untuk melihat rekaman video dari Google Drive
- Navigasi folder multi-level (Folder Kamera > Folder Tanggal > File Video)
- Breadcrumb navigasi dengan klik untuk berpindah antar level
- Video player modal dengan dukungan streaming dan seek (HTTP Range)
- Proxy streaming video via `/api/storage/stream/[fileId]` (kredensial tidak terekspos ke browser)
- Pencarian dan sorting video (terbaru, terlama, terbesar, terkecil)
- Folder tanggal diurutkan dari yang terbaru
- Menu Storage pada sidebar (hanya untuk role ADMINISTRATOR dan CLIENT)
- Konfigurasi Google Service Account dan Drive Folder ID via environment variable
- Penambahan env Storage pada docker-compose

### Fixed
- Perbaikan urutan React hooks pada halaman Storage (rules of hooks)
- Perbaikan TypeScript type error pada API storage route saat build
- Perbaikan type casting GaxiosResponse pada streaming endpoint

---

## [0.7.17] dan sebelumnya

Riwayat versi sebelumnya tidak dicatat dalam changelog ini.
