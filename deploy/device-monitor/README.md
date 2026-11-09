# device-monitor — agent riwayat hidup/mati perangkat

Agent kecil di **PC lokal** yang melapor ke dashboard (`POST /api/monitoring/report`) tiap 30 detik:

| Perangkat | Cara cek | Status yang dicatat |
|---|---|---|
| PC lokal | laporan itu sendiri = heartbeat; journal untuk riwayat boot | ONLINE / OFFLINE (`SHUTDOWN`, `REBOOT`, `POWER_LOSS`) |
| Internet Starlink | TCP ke `1.1.1.1:443`, `8.8.8.8:443`; router `192.168.1.1` | ONLINE / OFFLINE (`NO_INTERNET`, `ROUTER_DOWN`) |
| Kamera | TCP ke port 80 kamera di LAN | ONLINE / OFFLINE (`UNREACHABLE`) / UNKNOWN (`LAN_DOWN`) |
| Rekaman Shinobi | waktu ubah file `.mp4` terbaru per monitor (`SHINOBI_VIDEOS`, `RECORDINGS`) | ONLINE / OFFLINE (`NOT_RECORDING`: kamera hidup tapi tidak ada file baru > 12 menit) / UNKNOWN (`CAMERA_OFF`) |

- Gagal **2 kali berturut-turut** baru dicatat mati (gangguan sesaat Starlink diabaikan); waktu yang dicatat = saat gagal pertama.
- Internet putus: event disimpan di `/var/lib/device-monitor/state.json` lalu dikirim belakangan dengan **jam asli**.
- Saat menyala: agent melapor jam hidup terakhir boot sebelumnya + penyebabnya (dari journal: `plymouth-reboot` → REBOOT, shutdown normal → SHUTDOWN, tanpa jejak → POWER_LOSS).
- Pemasangan pertama: riwayat boot lama dari journal ikut diimpor sekali.
- Rekaman tidak dinilai 10 menit pertama setelah PC menyala, dan baru dinilai 12 menit setelah kamera tersambung lagi.
- Notifikasi Telegram dikirim dari server (bukan agent); atur di Dashboard → Riwayat Perangkat.
- **Hanya membaca.** Tidak menyentuh Shinobi, go2rtc, rekaman, maupun kamera. Berjalan sebagai user `trans-laut-jatim` (grup `adm` untuk baca journal).

## Pasang (pertama kali)

1. Buat token & daftarkan agent di database (hanya hash yang disimpan):
   ```bash
   node scripts/create-monitor-agent.mjs "PC lokal"
   # TOKEN=...       -> simpan ke file env (langkah 2)
   # INSERT INTO ... -> jalankan di database produksi
   ```
2. Buat file env (izin 600) dari `device-monitor.env.example`, isi `MONITOR_TOKEN`.
3. Pasang service:
   ```bash
   sudo bash deploy/device-monitor/install.sh /path/ke/file.env
   ```

## Perbarui agent

```bash
sudo bash deploy/device-monitor/install.sh   # env lama dipakai
```

Untuk menambah variabel baru (mis. `SHINOBI_VIDEOS`, `RECORDINGS`) tambahkan barisnya ke
`/opt/device-monitor/.env` (lihat `device-monitor.env.example`) lalu jalankan perintah di atas.

## Cek & uji

```bash
systemctl status device-monitor
journalctl -u device-monitor -f
# uji tanpa mengirim:
MONITOR_TOKEN=x STATE_DIR=/tmp/dm CAMERAS=192.168.1.34 node deploy/device-monitor/agent.mjs --once --dry-run
```
