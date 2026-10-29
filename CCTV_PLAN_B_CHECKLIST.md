# Checklist Progress — CCTV Plan B (Live View + PTZ + Mic di Dashboard)

Arsitektur: Browser → Dashboard (Dokploy/VPS) + go2rtc (VPS) → Tailscale → PC lokal (subnet router) → 8 kamera Hikvision.

**Aturan:** rekaman Shinobi (channel 102) tidak boleh terganggu. Channel 101 & 102 tidak diubah.
Item hanya dicentang setelah hasilnya diverifikasi (bukti singkat ditulis di kolom catatan).

Legenda: `[ ]` belum · `[~]` sedang dikerjakan · `[x]` selesai & terverifikasi

---

## Persiapan

| | Item | Kriteria lulus | Catatan |
|---|---|---|---|
| [x] | Identifikasi perekam | Diketahui Shinobi merekam channel apa | Shinobi di PC lokal, merekam channel 102 (2026-10-28) |
| [x] | Daftar IP 8 kamera | 8 IP diketahui | 192.168.1.34 .43 .51 .102 .106 .130 .141 .170 (2026-10-28). Catatan: .43 sedang mati, perlu dites saat menyala |
| [x] | Update `CAM_IP` di `.env` | `CAM_IP=192.168.1.141` | Dilakukan user; login ISAPI OK (HTTP 200, MAC 80:9d:65:e5:04:0a) — 2026-10-28 |
| [x] | Spesifikasi & lokasi server Dokploy | CPU/RAM dan lokasi (satu jaringan dengan kamera atau tidak) diketahui | VPS: 2 vCPU, 7,7 GB RAM, disk 65 GB kosong, IP publik di luar jaringan Starlink → Tailscale diperlukan (IP di `.env` `IP_VPS`). PC lokal (Shinobi): i5-10400, 16 GB, iGPU UHD 630, /video 752 GB |

## Rilis 1 — Live video di dashboard

### Tahap 1: Tailscale
| | Item | Kriteria lulus | Catatan |
|---|---|---|---|
| [x] | Akun Tailscale dibuat | Bisa login ke admin console | Dilakukan user — 2026-10-28 |
| [x] | Tailscale di PC lokal | `tailscale status` online, advertise route hanya IP kamera (/32), IP forwarding aktif | v1.104.4, node `trans-laut-jatim-h510m-k-v2` (100.89.88.78), 8 route /32, DNS tidak diubah, `ip_forward=1` (persisten via /etc/sysctl.d/99-tailscale.conf), health check bersih — 2026-10-28. UFW aktif (forward DROP) — cek saat tes dari VPS |
| [x] | Route disetujui di admin console | Route kamera tampil "approved" | 8 route tampil di PrimaryRoutes — 2026-10-28 |
| [x] | Tailscale di VPS | VPS tampil online di tailnet | Node `vps-dokploy` (100.122.221.32), `--accept-routes --accept-dns=false`; pra-cek rute & jaringan Docker aman. Koneksi langsung (bukan relay), ping 51 ms — 2026-10-28 |
| [x] | ACL dibatasi | VPS hanya bisa akses kamera port 80 & 554 | Grants: `tag:vps` → 8 IP kamera tcp:80,554 dan → `tag:cctv-router` tcp:8554. Tag terpasang. Uji: 7/7 kamera OK; VPS→SSH PC lokal & kamera:8000 ditolak; PC lokal→VPS:22/443/3000 ditolak — 2026-10-28 |
| [x] | Tes koneksi VPS → kamera | RTSP 102 & ISAPI terjangkau dari VPS untuk 8 kamera | 7/7 kamera aktif `web=200 rtsp=OK` (UFW tidak menghalangi). .43 mati, dites saat menyala — 2026-10-28 |
| [x] | Rekaman Shinobi tetap normal | File rekaman baru terus terbentuk untuk semua kamera | 7 perekam jalan, ketujuh kamera punya file .mp4 baru (12:25) setelah Tailscale terpasang — 2026-10-28 |

### Tahap 2: go2rtc di VPS
| | Item | Kriteria lulus | Catatan |
|---|---|---|---|
| [x] | 2A: go2rtc lokal terpasang | Service systemd aktif & enabled, user `go2rtc` (grup render/video), API hanya 127.0.0.1:1984 | v1.9.14 (sha256 dicek), file di `deploy/go2rtc-local/` — 2026-10-29 |
| [x] | 2A: transcode GPU | Stream keluar H.264 768×432 dari channel 102 | cam141: H.264 Main 768×432; ffmpeg ~9% 1 core; go2rtc 0,1%; on-demand (ffmpeg berhenti setelah penonton pergi) — 2026-10-29 |
| [x] | 2A: RTSP terlindungi | Tanpa auth ditolak; localhost tanpa auth (untuk exec internal) | 401 tanpa auth via LAN & Tailscale IP — 2026-10-29 |
| [~] | 2A: uji 8 kamera | Semua stream cam* keluar H.264 | cam141 OK. Lainnya ditunda sampai monitor Shinobi stabil |
| [x] | 2A: VPS → go2rtc lokal 8554 | Terjangkau dari VPS lewat Tailscale | `100.89.88.78:8554` OK dari VPS (ACL tag:vps → tag:cctv-router tcp:8554) — 2026-10-29 |
| [x] | 2B: Service go2rtc di Dokploy | Container berjalan, restart otomatis | Proyek `cctv-gateway`, Compose (Raw) dari `deploy/go2rtc-vps/docker-compose.yml`, image `alexxit/go2rtc:1.9.14`, `restart: unless-stopped`, gabung `dokploy-network` — 2026-10-29 |
| [x] | Kredensial di env | Tidak ada password tertulis di file konfigurasi/repo | Lokal: `/etc/go2rtc/go2rtc.env` (600). VPS: tab Environment Dokploy. GO2RTC_API_PASS sempat bocor ke chat 2× → sudah dirotasi user (2026-10-29); hapus juga dari history bash VPS |
| [x] | Jalur VPS → lokal → kamera | Snapshot cam141 dari API go2rtc VPS | `frame.jpeg?src=cam141` HTTP 200, 46 KB — 2026-10-29 |
| [~] | Port WebRTC 8555 | Video WebRTC tersambung dari browser luar jaringan | 8555/tcp terbuka dari internet (dites). Tes browser via SSH tunnel Termius gagal (`ERR_TOO_MANY_RETRIES` di Chrome/Edge, padahal curl via tunnel dapat 401 dari go2rtc) → **ditunda, dites langsung di dashboard (Tahap 4)** |
| [x] | API 1984 tidak publik | Tidak bisa diakses tanpa melalui dashboard/proxy | Port 1984 hanya `127.0.0.1` di VPS (tertutup dari internet) + basic auth (tanpa password → 401) — 2026-10-29 |
| [ ] | Beban CPU VPS wajar | CPU saat 8 kamera ditonton bersamaan tercatat & aman | |

### Tahap 3: Database & form kamera
| | Item | Kriteria lulus | Catatan |
|---|---|---|---|
| [x] | Migrasi Prisma | Kolom `go2rtcStream`, `isapiHost`, `ptzEnabled`, `audioEnabled` (opsional) ditambahkan, data lama aman | `prisma/migrations/20261029090000_add_camera_live_fields` (hanya ADD COLUMN), `prisma validate` OK. Diterapkan ke DB production oleh user (`migrate deploy` dari PC lokal) — 2026-10-29 |
| [~] | Form create/edit kamera | Kolom baru bisa diisi & disimpan | Bagian "Live View (go2rtc)" khusus ADMINISTRATOR (UI + API mengabaikan field dari non-admin; `isapiHost` hanya dikirim ke admin). tsc OK, `next build` OK, uji validasi OK — 2026-10-29. **Belum di-deploy** |
| [ ] | Data 8 kamera diisi | Semua kamera punya `go2rtcStream` | SQL siap: `deploy/sql/2026-10-29_camera_live_fields_data.sql` (cocokkan ID monitor Shinobi di `ulr_camera`; pratinjau dulu) |

### Tahap 4a: Viewer video
| | Item | Kriteria lulus | Catatan |
|---|---|---|---|
| [ ] | Tipe stream `webrtc` di halaman view | Video live tampil di Chrome & Firefox (Linux) | |
| [ ] | Fallback MSE/HLS | Jika WebRTC gagal, video tetap tampil | |
| [ ] | Latensi | Delay terukur ≤ ~2 detik | |
| [ ] | Deploy Rilis 1 | Berjalan di production, rekaman Shinobi tetap normal | |

## Rilis 2 — PTZ

| | Item | Kriteria lulus | Catatan |
|---|---|---|---|
| [ ] | Helper Digest Auth ISAPI | Request ISAPI dari server berhasil | |
| [ ] | API `POST /api/cctv/[id]/ptz` | Wajib login; tanpa sesi ditolak (401) | |
| [ ] | Gerak pan/tilt/zoom | Kamera bergerak saat tombol ditekan, berhenti saat dilepas | |
| [ ] | Preset | Daftar preset tampil & goto preset berfungsi | |
| [ ] | UI kontrol PTZ | Tombol arah, zoom, preset di halaman view | |
| [ ] | Uji 8 kamera | PTZ berfungsi di semua kamera | |
| [ ] | Deploy Rilis 2 | Berjalan di production | |

## Rilis 3 — Mic / audio dua arah

| | Item | Kriteria lulus | Catatan |
|---|---|---|---|
| [ ] | Tahap 0: aktifkan TwoWayAudio di 8 kamera | `enabled=true`, video & rekaman tidak terganggu | Perlu izin user per kamera |
| [ ] | Sumber `isapi://` di go2rtc | Audio dua arah terdaftar per kamera | |
| [ ] | Audio dari kamera ke browser | Suara lokasi terdengar di dashboard | |
| [ ] | Push-to-talk | Suara dari browser keluar di speaker kamera | |
| [ ] | HTTPS & izin mic | Browser meminta izin mic & berfungsi di domain production | |
| [ ] | Uji 8 kamera | Mic berfungsi di semua kamera | |
| [ ] | Deploy Rilis 3 | Berjalan di production | |

## Rapikan & keamanan

| | Item | Kriteria lulus | Catatan |
|---|---|---|---|
| [ ] | Batas akses per role | Hanya role tertentu yang bisa PTZ & mic | |
| [ ] | Logging | Tercatat siapa menggerakkan PTZ / bicara, kapan, kamera mana | |
| [ ] | Status kamera offline | Dashboard menampilkan status jelas saat kamera/tunnel putus | |
| [ ] | Ganti password kamera (bertahap) | Password baru di kamera, Shinobi & go2rtc; rekaman putus hanya sesaat per kamera | Dijadwalkan di waktu aman |
| [ ] | Dokumentasi | Cara tambah kamera baru & troubleshooting tertulis | |
| [ ] | Pantau perekam Shinobi | Ada peringatan bila monitor berhenti merekam > 10 menit | Usulan: 2026-10-28 monitor .170 berhenti ±12:39–13:28 tanpa auto-restart, baru jalan lagi setelah di-restart manual |
