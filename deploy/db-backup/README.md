# Backup database dashboard

Halaman: **Dashboard → Backup** (khusus ADMINISTRATOR). File `.sql` dari `pg_dump` dikirim ke Cloudflare R2, folder `navisight/` di dalam bucket. File hanya ada di folder sementara container selama proses.

## Pemasangan

1. Cloudflare → **R2** → buat bucket, misalnya `navisight-backup`.
2. **Manage R2 API Tokens** → buat token dengan izin **Object Read & Write**, hanya untuk bucket itu. Catat Access Key ID dan Secret Access Key.
3. Buat kunci enkripsi: `openssl rand -hex 32`. Isi di Dokploy → aplikasi dashboard → Environment sebagai `BACKUP_ENCRYPTION_KEY`, lalu deploy ulang. Simpan salinannya di tempat aman; kalau hilang, credential R2 cukup dimasukkan ulang.
4. Isi form di halaman Backup, klik **Tes koneksi**, lalu **Simpan**.

## Memulihkan

Menimpa data, jadi uji dulu ke database kosong. Pakai `psql` versi 17 terbaru, karena file bisa berisi perintah `\restrict` yang tidak dikenal versi lama.

```bash
createdb -h HOST -p PORT -U USER navisight_uji
psql -h HOST -p PORT -U USER -d navisight_uji -v ON_ERROR_STOP=1 -f NAMA_FILE.sql
```

File `.dump` lama dipulihkan dengan `pg_restore --no-owner --no-privileges -d navisight_uji NAMA_FILE.dump`.

File backup berisi seluruh data termasuk data pengguna.
