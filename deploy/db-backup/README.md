# Backup database dashboard

Halaman: **Dashboard → Backup** (khusus ADMINISTRATOR). `pg_dump` format custom dikirim ke Cloudflare R2, folder `navisight/` di dalam bucket. File hanya ada di folder sementara container selama proses.

## Pemasangan

1. Cloudflare → **R2** → buat bucket, misalnya `navisight-backup`.
2. **Manage R2 API Tokens** → buat token dengan izin **Object Read & Write**, hanya untuk bucket itu. Catat Access Key ID dan Secret Access Key.
3. Buat kunci enkripsi: `openssl rand -hex 32`. Isi di Dokploy → aplikasi dashboard → Environment sebagai `BACKUP_ENCRYPTION_KEY`, lalu deploy ulang. Simpan salinannya di tempat aman; kalau hilang, credential R2 cukup dimasukkan ulang.
4. Isi form di halaman Backup, klik **Tes koneksi**, lalu **Simpan**.

## Memulihkan

Menimpa data, jadi uji dulu ke database kosong. Versi `pg_restore` harus sama atau lebih baru dari yang membuat file.

```bash
createdb -h HOST -p PORT -U USER navisight_uji
pg_restore -h HOST -p PORT -U USER -d navisight_uji --no-owner --no-privileges NAMA_FILE.dump
```

File backup berisi seluruh data termasuk data pengguna.
