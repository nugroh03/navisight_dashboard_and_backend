# CCTV Plan B — Dokumentasi Progress

Live view + PTZ + mic untuk 8 kamera Hikvision di dashboard NaviSight (cloud), tanpa plugin browser.
Checklist status: [`CCTV_PLAN_B_CHECKLIST.md`](./CCTV_PLAN_B_CHECKLIST.md).

> Dokumen ini tidak berisi password, kredensial, atau IP publik VPS. Kredensial kamera dan IP VPS ada di `.env` (diabaikan git).

**Status per 2026-10-28:** Persiapan ✅ · Tahap 1 (Tailscale) ✅ · Tahap 2 (go2rtc) ⏭️ dilanjutkan 2026-10-29.

---

## 1. Latar belakang & keputusan

| Masalah | Keputusan |
|---|---|
| Plugin web Hikvision hanya untuk Windows/macOS, tidak jalan di Linux | Video, PTZ, dan mic dibuat langsung di dashboard (WebRTC + ISAPI) |
| Kamera di belakang CGNAT Starlink, tidak bisa dijangkau VPS | Tailscale: PC lokal jadi subnet router hanya untuk 8 IP kamera |
| Opsi web/API lokal + tunnel | **Ditolak**: duplikasi aplikasi & login, Cloudflare Tunnel tidak mendukung WebRTC (UDP), boros upload Starlink |
| Tailscale di docker-compose dashboard | **Ditolak**: dashboard di-deploy Dokploy sebagai Application dari image GHCR; routing Traefik jadi rumit; tunnel putus tiap redeploy |
| VPS hanya 2 vCPU | Transcode H.265→H.264 dilakukan di **PC lokal pakai GPU Intel UHD 630 (VAAPI)**; VPS hanya meneruskan |
| Shinobi merekam channel 102 terus-menerus | **Channel 101 & 102 tidak boleh diubah**. Dashboard membaca 102 lalu ditranscode |

### Arsitektur

```
Browser ──WebRTC (video+mic)──▶ go2rtc (VPS, relay) ┐
Browser ──HTTPS (PTZ)──▶ Next.js dashboard (VPS)    ┘  Dokploy
                                   │
                         Tailscale (tag:vps → tag:cctv-router / IP kamera)
                                   │
              PC lokal (subnet router + go2rtc lokal, transcode GPU)  ← Shinobi juga di sini
                                   │
                         8 kamera Hikvision (192.168.1.x)
```

---

## 2. Inventaris

### Kamera (semua DS-2DE2C400MWG/W: PTZ + two-way audio G.711ulaw)

| # | IP | Monitor Shinobi | Catatan |
|---|---|---|---|
| 1 | 192.168.1.34 | `cSLk5GJCDC` | |
| 2 | 192.168.1.43 | `IWZbQL1uJm` (dugaan) | Kamera sedang mati per 2026-10-28 |
| 3 | 192.168.1.51 | `lvWkO76ScO` | |
| 4 | 192.168.1.102 | `jzPE6pDnUs` | |
| 5 | 192.168.1.106 | `L1czXsWT8h` | |
| 6 | 192.168.1.130 | `5IlPRRxheX` | |
| 7 | 192.168.1.141 | `f960kt4AKJ` | Kamera WiFi, IP diubah dari .140 (lihat §5) |
| 8 | 192.168.1.170 | `LQIwuTCf5g` | |

Stream: **101** main H.265 2560×1440 15 fps · **102** sub H.265 768×432 10 fps (direkam Shinobi) · 103 ada tetapi hasil probe tidak konsisten.
Two-way audio di kamera saat ini `enabled=false` (diaktifkan di Rilis 3).

### Mesin

| Mesin | Spesifikasi | Peran |
|---|---|---|
| PC lokal `trans-laut-jatim-h510m-k-v2` | i5-10400 (12 thread), 16 GB RAM, iGPU UHD 630, disk rekaman `/video` 752 GB, UFW aktif | Shinobi (`/home/Shinobi`, PM2 milik root), subnet router Tailscale, nanti go2rtc lokal |
| VPS `vps-dokploy` | 2 vCPU, 7,7 GB RAM, disk kosong 65 GB, IP publik (di `.env` sebagai `IP_VPS`) | Dokploy: dashboard (image GHCR) + nanti go2rtc relay |

Jaringan Docker VPS: 172.17.0.0/16, 172.18.0.0/16, 10.0.0.0/24 (ingress), 10.0.1.0/24 (dokploy-network). Tidak bentrok dengan 192.168.1.x maupun 100.64.0.0/10.

---

## 3. Yang sudah dikerjakan

### Persiapan (2026-10-28)
- Perekam diidentifikasi: Shinobi merekam channel 102 dengan `-c:v copy` ke `/video/shinobi/videos/WL3ksOMv0g/<monitor>/`.
- Daftar IP 8 kamera dikumpulkan.
- Spesifikasi & lokasi VPS diketahui: di luar jaringan Starlink, jadi Tailscale diperlukan.
- Benchmark transcode 1 stream 102 selama 20 detik di PC lokal:
  - GPU (VAAPI): **~2% dari 1 core**
  - CPU (libx264 veryfast): ~25% dari 1 core
  - Perkiraan 8 stream lewat GPU: ~16% dari 1 core. Shinobi tetap 7/7 merekam selama tes.
  - Catatan: driver VAAPI hanya mendukung rate control **CQP**. Pakai `-rc_mode CQP -qp 26`, bukan `-b:v`.

### Tahap 1: Tailscale (2026-10-28) ✅

**PC lokal** (dijalankan user):
```bash
curl -fsSL https://tailscale.com/install.sh | sh
echo 'net.ipv4.ip_forward = 1' | sudo tee /etc/sysctl.d/99-tailscale.conf
sudo sysctl -p /etc/sysctl.d/99-tailscale.conf      # harus dari terminal biasa (butuh password sudo)
sudo tailscale up --advertise-routes=192.168.1.34/32,192.168.1.43/32,192.168.1.51/32,192.168.1.102/32,192.168.1.106/32,192.168.1.130/32,192.168.1.141/32,192.168.1.170/32 --accept-dns=false
```
Lalu 8 route disetujui di admin console (Machines → Edit route settings).
Hasil: Tailscale v1.104.4, node 100.89.88.78, `ip_forward=1` persisten, DNS PC tidak diubah.

**VPS** (dijalankan user sebagai root). Pra-cek tidak ada rute 192.168.1.x / 100.64–127.x:
```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --accept-routes --accept-dns=false --hostname=vps-dokploy
```
Hasil: node 100.122.221.32. Koneksi ke PC lokal **langsung (bukan relay DERP), ~51 ms**.

**ACL** (admin console → Access controls → JSON editor, isi diganti seluruhnya):
```json
{
  "tagOwners": {
    "tag:vps":         ["autogroup:admin"],
    "tag:cctv-router": ["autogroup:admin"]
  },
  "grants": [
    {
      "src": ["tag:vps"],
      "dst": [
        "192.168.1.34/32", "192.168.1.43/32", "192.168.1.51/32", "192.168.1.102/32",
        "192.168.1.106/32", "192.168.1.130/32", "192.168.1.141/32", "192.168.1.170/32"
      ],
      "ip": ["tcp:80", "tcp:554"]
    },
    {
      "src": ["tag:vps"],
      "dst": ["tag:cctv-router"],
      "ip": ["tcp:8554"]
    }
  ]
}
```
Tag: `vps-dokploy` → `tag:vps`, PC lokal → `tag:cctv-router`. Dengan tag, masa berlaku login perangkat otomatis nonaktif.
Port `tcp:8554` disiapkan untuk RTSP go2rtc lokal (Tahap 2).

**Verifikasi akhir Tahap 1:**

| Tes | Hasil |
|---|---|
| VPS → 7 kamera aktif (HTTP 80 & RTSP 554) | 7/7 OK |
| VPS → SSH PC lokal (100.89.88.78:22) | Ditolak ✅ |
| VPS → kamera port 8000 | Ditolak ✅ |
| PC lokal → VPS 22/443/3000 via Tailscale | Ditolak ✅ |
| Shinobi selama & sesudah pemasangan | 7/7 merekam, file .mp4 baru terbentuk |

Tes yang dipakai di VPS:
```bash
for ip in 34 51 102 106 130 141 170; do
  h=$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://192.168.1.$ip/)
  r=$(timeout 4 bash -c "echo > /dev/tcp/192.168.1.$ip/554" 2>/dev/null && echo OK || echo GAGAL)
  echo "192.168.1.$ip  web=$h  rtsp=$r"
done
```

**Rollback Tahap 1** (jika diperlukan):
```bash
# VPS
tailscale down          # atau: apt remove tailscale
# PC lokal
sudo tailscale down     # atau: sudo apt remove tailscale
sudo rm /etc/sysctl.d/99-tailscale.conf && sudo sysctl -w net.ipv4.ip_forward=0
```

---

## 4. Insiden & temuan

| Tanggal | Kejadian | Tindakan / status |
|---|---|---|
| 2026-10-28 | Monitor Shinobi .170 berhenti ±12:39–13:28 dan tidak restart otomatis (rekaman ±50 menit hilang). Kamera sehat; Shinobi mengakses kamera lewat `enp5s0`, bukan Tailscale | User restart monitor dari web Shinobi; 7/7 merekam lagi. Usulan: alert bila perekam berhenti > 10 menit |
| 2026-10-28 | Rekaman .141 sempat terputus saat kamera di-restart & IP dipindah (troubleshooting Hik-Connect) | Monitor Shinobi kini memakai .141 |
| 2026-10-28 | Password kamera terlihat di daftar proses (`ps`), karena Shinobi menulis URL RTSP lengkap di argumen ffmpeg | Ganti password bertahap di waktu aman (update Shinobi juga) |
| 2026-10-28 | Port 3000 di VPS terbuka publik lewat HTTP. **Koreksi 2026-10-29:** itu panel admin **Dokploy**, bukan dashboard NaviSight; firewall VPS (ufw) tidak aktif | Belum diubah; usulan: akses panel Dokploy lewat domain HTTPS atau batasi port 3000 |
| 2026-10-28 | `.env` proyek milik root, izin 644 (bisa dibaca semua user) | Usulan: `sudo chown $USER .env && chmod 600 .env` |

**Catatan operasional:**
- Jangan jalankan `pm2` sebagai user biasa, karena perintah itu membuat daemon PM2 baru di `~/.pm2`. Shinobi berjalan di PM2 milik root.
- `sudo` lewat prompt `!` di Claude Code tidak bisa meminta password, jadi jalankan dari terminal biasa.

---

## 5. Perubahan pada kamera 192.168.1.141 (troubleshooting Hik-Connect)

Masalah: Hik-Connect online lewat LAN, tetapi offline lewat WiFi (router Starlink yang sama).

| Perubahan | Sebelum | Sesudah |
|---|---|---|
| IP WLAN | 192.168.1.140 statis | **192.168.1.141 statis** (.140 sudah diambil perangkat lain) |
| DNS WLAN | 8.8.8.8 / 8.8.4.4 | **192.168.1.1** / 8.8.4.4 |
| Zeroconf port LAN | aktif | nonaktif |
| Server Hik-Connect | `litedev.sgp.hik-connect.com` | sama (`dev.ind` sempat dicoba; `ind` = India) |

Temuan: lewat WiFi, DNS kamera sebelumnya gagal (tes NTP pakai nama gagal, pakai IP berhasil). Setelah DNS diganti, DNS beres, tetapi `registerStatus` Hik-Connect **tetap false**.
Belum dicoba: tes hotspot HP, cek blokir perangkat di aplikasi Starlink, tanya support Hikvision.

---

## 6. Optimasi latensi (2026-10-29)

Metode: ambil 60 frame berturut-turut, potong area jam OSD kamera, tempelkan waktu terima frame (ms) dari jam PC. Jam kamera dan PC sama-sama NTP (dicek identik). Jeda = waktu terima frame pertama dengan detik OSD baru − pergantian detik.

| Titik ukur | Sebelum | Sesudah |
|---|---|---|
| RTSP langsung dari kamera (ch 102) | ≈0,2 s | ≈0,2 s |
| Output go2rtc lokal (`cam141`) | ≈1,6 s | **≈0,23 s** |
| Dashboard (WebRTC via VPS, dicek user) | ±4 s | **±1 s** |

Penyebab: decoder H.265 ffmpeg default memakai frame-threading (menahan beberapa frame, ±1,4 s pada 10 fps).
Perbaikan di `deploy/go2rtc-local/go2rtc.yaml`: input `-flags low_delay -threads 1`, encoder `-async_depth 1`. Dipasang ke `/etc/go2rtc/go2rtc.yaml` + `systemctl restart go2rtc` (Shinobi tidak terpengaruh).

## 6b. Rilis 2: PTZ (2026-10-29) ✅

- Jalur: browser → `POST /api/cctv/[id]/ptz` (Next.js, khusus ADMINISTRATOR + anggota project) → ISAPI Digest ke `isapiHost` kamera lewat Tailscale. Kredensial di env Dokploy `CAM_ISAPI_USER`/`CAM_ISAPI_PASS`.
- Kamera hanya mendukung PTZ continuous. Browser mengirim `move` tiap 400 ms selama tombol ditahan; server mengirim `stop` sendiri bila 1,5 s tanpa `move` (tab ditutup/koneksi putus).
- Aktifkan per kamera: centang "Kontrol PTZ" + isi "Host ISAPI" di form edit.
- Preset: .141 punya preset 1 = posisi standar rekaman (goto kembali, selisih ±5 px). 7 kamera lain belum punya preset.
- Uji: tes lokal (move/stop/auto-stop/goto) OK; user menguji dari UI production (Ruang VIP) — normal. Shinobi tidak terganggu.
- Ikut di PR #2: dropdown nama stream go2rtc di form, WebRTC 404 langsung fallback ke HLS tanpa retry.

## 6c. Rilis 3: bicara ke kamera (2026-10-31) — .141 berhasil

Status: PR #3 merge ke `main` (`321c991`). User memastikan suara dari dashboard keluar di speaker .141. Baru .141 yang punya stream `_talk`.

- `enabled` di TwoWayAudio hanya menandai sesi terbuka; tidak ada pengaturan kamera yang perlu diubah.
- go2rtc `IsConsumer` menganggap peer yang hanya mengirim sebagai producer, jadi offer perlu transceiver `recvonly` tambahan.
- go2rtc VPS: compose sumber **Raw**. `cam141_talk` ditambahkan di `streams:`; `CAM_USER`/`CAM_PASS` di Environment service go2rtc, bukan di dalam YAML.
- Tambah kamera: satu baris `camX_talk: isapi://...` per kamera, lalu centang "Mic / audio dua arah".
- Belum: suara kamera ke browser (go2rtc lokal masih `-an`).

## 6d. Insiden Shinobi tidak start (2026-10-31)

- Override `pm2-root` menunggu ping 192.168.1.140 (IP lama kamera). Perangkat di .140 mati, Shinobi tidak start. Diganti ke router 192.168.1.1.
- Watchdog `shinobi-health.sh` (cron root) me-reboot PC pukul 18:10 & 18:24 karena Shinobi mati.
- Cron root `30 19 * * * shutdown -h now` dinonaktifkan user (dijadikan komentar, baris 27), PC kini menyala 24 jam.
- Belum terjawab: PC berkali-kali mati tanpa catatan shutdown (14:44, 17:59, 18:18, 18:37; hari-hari sebelumnya sering ±15:15). Celah rekaman 14:44–18:33 dan ±18:37–18:39.

## 6e. Sambung ulang & pemulihan rekaman (2026-10-31)

- Tombol "Sambung ulang" di `webrtc-player.tsx`: membuat ulang koneksi WebRTC di browser, tidak menyentuh rekaman.
- `deploy/shinobi-watch/shinobi-watch.sh`: berjalan di **PC lokal** tiap menit (cron.d), bukan di VPS. Kamera online tanpa file baru 12 menit → restart monitor itu saja lewat API Shinobi lokal (`record?reset=1`). Kamera mati dan monitor bukan mode `record` dilewati. Jeda 15 menit, maksimal 4 restart per 6 jam. Tidak me-reboot PC. API key di `/etc/shinobi-watch.env` (600), log `/var/log/shinobi-watch.log`.
- Diuji dengan server tiruan; API Shinobi asli diuji saat dipasang.

## 7. Catatan lama — rencana Tahap 2 (sudah dikerjakan)

Rencana awal (dijelaskan & disetujui dulu sebelum dipasang):
1. **go2rtc lokal** di PC lokal: baca RTSP channel 102 tiap kamera, transcode H.265→H.264 dengan VAAPI (`/dev/dri/renderD128`, CQP), sajikan RTSP di port 8554 hanya untuk Tailscale. Hanya menarik stream saat ada penonton.
2. **go2rtc relay** di VPS (service Dokploy): ambil stream dari go2rtc lokal via Tailscale, sajikan WebRTC ke browser (port 8555 UDP/TCP). API 1984 tidak dibuka publik.
3. Kredensial kamera lewat environment variable, tidak ditulis di file konfigurasi atau repo.
4. Verifikasi: Shinobi tetap 7/7, CPU PC lokal & VPS tercatat, video tampil dari luar jaringan.
5. Belum pasti: meneruskan audio dua arah lewat dua go2rtc berantai. Diuji di Rilis 3, dengan jalur alternatif bila gagal.
