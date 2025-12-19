# Implementasi Fitur CCTV - NaviSight Dashboard

## Overview
Fitur CCTV telah berhasil diimplementasikan dengan fungsi lengkap untuk Create, Read, Update, Delete (CRUD) dan viewing camera streams.

## Struktur File yang Dibuat

### 1. Types & Interfaces (`src/types/index.ts`)
- Definisi type untuk CCTV, User, dan Props components
- Interface untuk CCTV operations

### 2. Hooks (`src/hooks/`)
- `use-cctv.ts` - Hooks untuk CRUD operations CCTV
- `use-projects.ts` - Hook untuk fetch project options

### 3. Validations (`src/lib/validations.ts`)
- Schema validasi dengan Zod untuk create dan update CCTV
- Input validation untuk semua form fields

### 4. API Routes (`src/app/api/cctv/`)
- `route.ts` - GET all cameras, POST create camera
- `[id]/route.ts` - GET, PATCH, DELETE single camera

### 5. UI Components (`src/components/`)
- `ui/` - Reusable UI components (Button, Input, Card, Badge, Label)
- `cctv/cctv-card.tsx` - Card component untuk menampilkan camera
- `cctv/cctv-delete-modal.tsx` - Modal konfirmasi delete

### 6. Pages (`src/app/dashboard/cctv/`)
- `page.tsx` - Halaman utama list cameras dengan filter & search
- `create/page.tsx` - Form create camera baru
- `[id]/edit/page.tsx` - Form edit camera existing
- `[id]/view/page.tsx` - Viewer untuk live stream camera

### 7. Database Schema
- Updated `prisma/schema.prisma` dengan field:
  - `description` (String, optional)
  - `location` (String, optional)
  - `status` (String, default "OFFLINE")

## Fitur yang Tersedia

### 1. List & Filter Cameras
- Search berdasarkan nama atau lokasi
- Filter berdasarkan status (Online, Offline, Maintenance)
- Display statistics (total, online, offline, maintenance)
- Grid layout dengan camera cards

### 2. Create Camera
- Form validasi lengkap
- Field: Name, Description, Location, Project, Stream URL, Status
- Toast notification untuk success/error

### 3. Edit Camera
- Pre-populated form dengan data existing
- Update semua field camera
- Option untuk delete langsung dari edit page

### 4. Delete Camera
- Confirmation modal dengan detail camera
- Soft delete dengan feedback

### 5. View Camera Stream
- Full-screen support
- Refresh stream functionality
- Error handling dengan retry option
- Display camera information & stream details

## Cara Menggunakan

### 1. Setup Database
Migration sudah dijalankan. Jika perlu manual:
```bash
npx prisma migrate dev
```

### 2. Install Dependencies
Dependencies sudah ditambahkan ke package.json:
- react-hook-form
- @hookform/resolvers
- sonner (toast notifications)
- lucide-react (icons)
- clsx & tailwind-merge (utility)

Install dengan:
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Access CCTV Features
- List Cameras: `/dashboard/cctv`
- Create Camera: `/dashboard/cctv/create`
- Edit Camera: `/dashboard/cctv/[id]/edit`
- View Camera: `/dashboard/cctv/[id]/view`

## Permission & Role
- **ADMINISTRATOR**: Full access (Create, Edit, Delete, View)
- **CLIENT & WORKER**: View only

## Field Descriptions

### Camera Model
- **name**: Nama camera (required)
- **description**: Deskripsi camera (optional)
- **location**: Lokasi fisik camera (optional)
- **projectId**: ID project terkait (required)
- **streamUrl**: URL stream camera (required, validated as URL)
- **status**: Status camera (ONLINE, OFFLINE, MAINTENANCE)

## Next Steps (Optional Improvements)

1. **Real-time Status Updates**
   - Implementasi WebSocket untuk update status real-time
   - Auto-refresh camera preview

2. **Recording & Playback**
   - Save recordings
   - Playback history

3. **Alerts & Notifications**
   - Email/push notification saat camera offline
   - Motion detection alerts

4. **Advanced Streaming**
   - Support untuk RTSP streams dengan HLS conversion
   - Multiple quality options
   - Snapshot capture

5. **Camera Groups**
   - Group cameras berdasarkan location atau project
   - Multi-camera view grid

## Troubleshooting

### Stream tidak muncul
- Pastikan streamUrl valid dan accessible
- Check CORS policy jika external URL
- Verify camera status is ONLINE

### Form validation error
- Check semua required fields terisi
- Stream URL harus format URL valid
- Project harus dipilih

### Dependencies error
- Jalankan `npm install --legacy-peer-deps` jika ada peer dependency issues dengan React 19

## File Reference untuk Development

File example di `src/app/dashboard/cctv/example/` bisa dijadikan referensi untuk:
- Advanced features (troubleshooting, MJPEG handling)
- Additional UI patterns
- Error handling examples
