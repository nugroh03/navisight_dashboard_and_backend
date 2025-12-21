# Deployment Guide untuk Dokploy

## 🐳 Pull dari GitHub Container Registry (GHCR)

Image Docker sudah di-build otomatis dan tersedia di GHCR. Anda bisa langsung pull tanpa perlu build ulang.

### Quick Deploy di Dokploy

1. **Set Image Source**: Gunakan pre-built image dari GHCR
   ```
   ghcr.io/OWNER/REPO:latest
   ```
   Ganti `OWNER/REPO` dengan nama repository GitHub Anda
   
2. **Set Environment Variables** (lihat di bawah)

3. **Deploy** - Dokploy akan pull image dan running

### Available Tags
- `latest` - Latest dari branch main/master
- `v1.0.0` - Specific version (jika menggunakan tags)
- `main-sha-xxxxx` - Specific commit

## Setup di Dokploy

### 1. Environment Variables
Set environment variables berikut di Dokploy dashboard:

```bash
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=generate_random_secret_here
NEXT_PUBLIC_APP_NAME=NAVISIGHT
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 2. Deploy Settings
**Opsi 1: Pull dari GHCR (Recommended)**
- **Image**: `ghcr.io/OWNER/REPO:latest`
- **Port**: 3000
- **Health Check Path**: `/api/health`

**Opsi 2: Build dari Source**
- **Build Command**: Otomatis menggunakan Dockerfile
- **Port**: 3000
- **Health Check Path**: `/api/health`

### 3. Database Migration
Setelah deployment pertama kali, jalankan migration:

```bash
# SSH ke container atau gunakan Dokploy console
npx prisma migrate deploy
npx prisma db seed
```

## Optimisasi Dockerfile

Dockerfile ini menggunakan **multi-stage build** dengan 3 stage:

1. **deps**: Install dependencies dan generate Prisma client
2. **builder**: Build aplikasi Next.js
3. **runner**: Image final yang ringan untuk production

### Fitur Optimisasi:
- ✅ Alpine Linux (image lebih kecil ~50MB)
- ✅ Multi-stage build (mengurangi ukuran final image)
- ✅ Next.js standalone output (hanya file yang diperlukan)
- ✅ Layer caching untuk build lebih cepat
### Pull dari GHCR
```bash
# Pull image dari GHCR
docker pull ghcr.io/OWNER/REPO:latest

# Run dengan environment variables
docker run -p 3000:3000 \
  -e DATABASE_URL="your_database_url" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET="your_secret" \
  -e NEXT_PUBLIC_APP_NAME="NAVISIGHT" \
  ghcr.io/OWNER/REPO:latest
```

### Build Lokal
- ✅ Non-root user untuk security
- ✅ Prisma client pre-generated
- ✅ Production-ready configuration

## Testing Lokal dengan Docker

```bash
# Build image
docker build -t navisight .

# Run dengan environment variables
docker run -p 3000:3000 \
  -e DATABASE_URL="your_database_url" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET="your_secret" \
  -e NEXT_PUBLIC_APP_NAME="NAVISIGHT" \
  navisight

# Atau gunakan docker-compose
docker-compose up -d
```

## Troubleshooting

### Build Error
```bash
# Clear Docker cache
docker builder prune -a

# Rebuild without cache
doc🔄 GitHub Actions - Auto Build & Push

Setiap push ke branch `main`/`master` atau create tag `v*` akan otomatis:
1. Build Docker image
2. Push ke GitHub Container Registry
3. Tag dengan `latest` dan version (jika ada)

### Setup GHCR (One-time)

1. **Enable Package Permissions**
   - Go to: `Settings` → `Actions` → `General`
   - Scroll ke `Workflow permissions`
   - Select: `Read and write permissions`
   - Save

2. **Make Package Public (Optional)**
   - Go to package di GitHub
   - `Package settings` → `Change visibility` → `Public`

3. **Create Release Tag** (untuk versioning)
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

### Manual Build & Push ke GHCR

```bash
# Login ke GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Build
docker build -t ghcr.io/OWNER/REPO:latest .

# Push
docker push ghcr.io/OWNER/REPO:latest
```

## 📋 Deployment Checklist

- [ ] Push code ke GitHub
- [ ] Pastikan GitHub Actions berhasil build
- [ ] Verify image tersedia di GHCR
- [ ] Set environment variables di Dokploy
- [ ] Deploy dengan pull image dari GHCR
- [ ] Run database migration
- [ ] Run database seed (optional)
- [ ] Test application

## Notes
- File `.env` tidak akan ter-copy ke Docker image (ada di `.dockerignore`)
- Environment variables harus di-set di Dokploy dashboard
- Port default adalah 3000, bisa diubah dengan env variable `PORT`
- Image di GHCR akan auto-update setiap push ke main branch
- Gunakan tag version (`v1.0.0`) untuk production stability
Pastikan DATABASE_URL:
- Menggunakan format yang benar
- Database dapat diakses dari container
- SSL mode sesuai dengan database provider

### Prisma Issues
```bash
# Regenerate Prisma client di container
docker exec -it <container_id> npx prisma generate
```

## Notes
- File `.env` tidak akan ter-copy ke Docker image (ada di `.dockerignore`)
- Environment variables harus di-set di Dokploy dashboard
- Port default adalah 3000, bisa diubah dengan env variable `PORT`
