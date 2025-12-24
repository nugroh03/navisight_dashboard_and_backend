# 🔐 Multi-Platform Login System Documentation

## 📋 Overview

Sistem login multi-platform yang aman dan scalable untuk aplikasi Navisight, mendukung:
- **Dashboard (Web)**: Untuk internal staff (admin, worker)
- **Mobile App**: Untuk internal staff + external customers

## 🎯 Desain Database

### Enum AccountType
```prisma
enum AccountType {
  INTERNAL_STAFF    // Staff internal perusahaan
  EXTERNAL_CUSTOMER // Customer eksternal (mobile only)
}
```

### User Model Fields
```prisma
model User {
  // ... existing fields
  accountType        AccountType @default(INTERNAL_STAFF)
  canAccessDashboard Boolean     @default(true)
  canAccessMobile    Boolean     @default(true)
}
```

### Security Features
✅ Unique index pada email (otomatis dari Prisma `@unique`)
✅ Default values untuk backward compatibility
✅ Database-level comments untuk dokumentasi
✅ Soft delete support (deletedAt field)

## 🔒 Aturan Akses Platform

### Dashboard Login (`/api/auth/login/dashboard`)
**Diizinkan:**
- ✅ INTERNAL_STAFF dengan `canAccessDashboard = true`

**Diblokir:**
- ❌ EXTERNAL_CUSTOMER (customer mobile)
- ❌ User dengan `canAccessDashboard = false`
- ❌ User dengan `deletedAt != null`

### Mobile Login (`/api/auth/login/mobile`)
**Diizinkan:**
- ✅ INTERNAL_STAFF dengan `canAccessMobile = true`
- ✅ EXTERNAL_CUSTOMER dengan `canAccessMobile = true`

**Diblokir:**
- ❌ User dengan `canAccessMobile = false`
- ❌ User dengan `deletedAt != null`

## 📡 API Endpoints

### 1. Dashboard Login
```typescript
POST /api/auth/login/dashboard
Content-Type: application/json

Request:
{
  "email": "admin@example.com",
  "password": "password123"
}

Response (Success - 200):
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "ADMINISTRATOR",
    "accountType": "INTERNAL_STAFF"
  },
  "message": "Dashboard login successful"
}

Response (Blocked Customer - 403):
{
  "error": "Access denied",
  "message": "Customer accounts cannot access the dashboard. Please use the mobile app."
}

Response (Access Disabled - 403):
{
  "error": "Access denied",
  "message": "Dashboard access is disabled for this account. Contact administrator."
}
```

### 2. Mobile Login
```typescript
POST /api/auth/login/mobile
Content-Type: application/json

Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response (Success - 200):
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "Mobile User",
    "email": "user@example.com",
    "role": "CLIENT",
    "accountType": "EXTERNAL_CUSTOMER"
  },
  "message": "Mobile login successful"
}

Response (Access Disabled - 403):
{
  "error": "Access denied",
  "message": "Mobile access is disabled for this account. Contact administrator."
}
```

## 🔄 Migration Applied

File: `prisma/migrations/20251224075141_add_account_type_and_platform_access/migration.sql`

**Changes:**
1. Created `AccountType` enum
2. Added 3 new columns to users table:
   - `accountType` (default: INTERNAL_STAFF)
   - `canAccessDashboard` (default: true)
   - `canAccessMobile` (default: true)
3. Added database comments for documentation

**Backward Compatibility:**
- ✅ All existing users default to `INTERNAL_STAFF`
- ✅ All existing users can access both platforms
- ✅ No breaking changes to existing functionality

## 🏭 Auto-Configuration saat User Dibuat

### Endpoint: `/api/users` (Dashboard - Admin/Client)

**Logic otomatis berdasarkan role:**

| Role   | accountType         | canAccessDashboard | canAccessMobile | Keterangan |
|--------|--------------------|--------------------|-----------------|------------|
| WORKER | INTERNAL_STAFF     | ✅ true            | ✅ true         | Staff bisa akses dashboard & mobile |
| CLIENT | EXTERNAL_CUSTOMER  | ❌ false           | ✅ true         | Customer hanya mobile |

**Contoh request:**
```typescript
// Create WORKER (staff)
POST /api/users
{
  "email": "worker@company.com",
  "password": "password123",
  "name": "Worker User",
  "role": "WORKER",
  "projectIds": ["project-uuid"]
}
// → accountType: INTERNAL_STAFF
// → canAccessDashboard: true
// → canAccessMobile: true

// Create CLIENT (customer)
POST /api/users
{
  "email": "customer@external.com",
  "password": "password123",
  "name": "Customer User",
  "role": "CLIENT",
  "projectIds": ["project-uuid"]
}
// → accountType: EXTERNAL_CUSTOMER
// → canAccessDashboard: false
// → canAccessMobile: true ✅ OTOMATIS BISA MOBILE!
```

### Endpoint: `/api/auth/register` (Public Register)

**Default values untuk semua user baru:**
- `accountType`: INTERNAL_STAFF
- `canAccessDashboard`: true
- `canAccessMobile`: true

```typescript
POST /api/auth/register
{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User"
}
// → Otomatis dapat akses dashboard & mobile
```

## 💡 Use Cases Manual (via Prisma)

### Use Case 1: Create Internal Staff
```typescript
await prisma.user.create({
  data: {
    email: "staff@company.com",
    passwordHash: await hash("password", 10),
    name: "Staff Member",
    accountType: "INTERNAL_STAFF",
    canAccessDashboard: true,
    canAccessMobile: true,
    roleId: adminRoleId
  }
});
// ✅ Can login to both dashboard and mobile
```

### Use Case 2: Create Mobile-Only Customer
```typescript
await prisma.user.create({
  data: {
    email: "customer@external.com",
    passwordHash: await hash("password", 10),
    name: "External Customer",
    accountType: "EXTERNAL_CUSTOMER",
    canAccessDashboard: false,
    canAccessMobile: true,
    roleId: clientRoleId
  }
});
// ✅ Can login to mobile
// ❌ Cannot login to dashboard
```

### Use Case 3: Temporarily Disable Access
```typescript
// Disable dashboard access for specific user
await prisma.user.update({
  where: { id: userId },
  data: { canAccessDashboard: false }
});

// Disable all access (keep account for audit)
await prisma.user.update({
  where: { id: userId },
  data: {
    canAccessDashboard: false,
    canAccessMobile: false
  }
});
```

## 🛡️ Security Features

### 1. Multi-Layer Validation
- ✅ **Database level**: Enum constraints + NOT NULL
- ✅ **Application level**: Platform validation function
- ✅ **API level**: Dedicated endpoints per platform

### 2. Password Security
- ✅ Bcrypt hashing
- ✅ Minimum 6 characters
- ✅ No password in response

### 3. Audit Trail
- ✅ Soft delete (deletedAt)
- ✅ Login attempts logged to console
- ✅ Timestamps (createdAt, updatedAt)

### 4. Type Safety
- ✅ Zod validation for input
- ✅ TypeScript types exported
- ✅ Prisma type generation

## 📊 Database Indexes

Automatically created by Prisma:
- `users_email_key` UNIQUE INDEX on email
- Primary keys on all tables
- Foreign key indexes

## 🔧 Configuration

### Environment Variables
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

### NextAuth Integration
File: `src/auth/config.ts`

The existing NextAuth configuration has been enhanced with:
- Platform validation function
- Extended credentials schema with optional `platform` field
- Platform access checks in `authorize` callback

## 📝 Admin Tasks

### Query Users by Platform Access
```sql
-- All users who can access dashboard
SELECT id, email, name, accountType 
FROM users 
WHERE canAccessDashboard = true 
  AND deletedAt IS NULL;

-- All mobile-only customers
SELECT id, email, name, accountType 
FROM users 
WHERE accountType = 'EXTERNAL_CUSTOMER' 
  AND canAccessMobile = true 
  AND deletedAt IS NULL;

-- Users with no access
SELECT id, email, name, accountType 
FROM users 
WHERE canAccessDashboard = false 
  AND canAccessMobile = false 
  AND deletedAt IS NULL;
```

### Update User Platform Access
```sql
-- Convert user to mobile-only customer
UPDATE users 
SET accountType = 'EXTERNAL_CUSTOMER',
    canAccessDashboard = false,
    canAccessMobile = true
WHERE email = 'customer@example.com';

-- Grant dashboard access to staff
UPDATE users 
SET accountType = 'INTERNAL_STAFF',
    canAccessDashboard = true
WHERE email = 'staff@example.com';
```

## 🚀 Scalability

This design supports future expansion:
- ✅ Easy to add new account types (modify enum)
- ✅ Easy to add new platforms (add new boolean flags)
- ✅ Independent access control per platform
- ✅ No migration needed for existing users
- ✅ Type-safe with Prisma and TypeScript

## 📚 TypeScript Types

Available in `src/types/index.ts`:
```typescript
import { AccountType } from '@prisma/client';
import { Platform, PlatformLoginRequest, PlatformLoginResponse } from '@/types';
```

## ✅ Testing Checklist

- [ ] Existing users can still login
- [ ] Dashboard blocks EXTERNAL_CUSTOMER
- [ ] Mobile allows both account types
- [ ] Validation errors return 400
- [ ] Invalid credentials return 401
- [ ] Access denied returns 403
- [ ] Passwords are hashed
- [ ] Deleted users cannot login
- [ ] Email uniqueness enforced
- [ ] TypeScript types compile

## 🎉 Summary

✅ **Secure**: Multi-layer validation + platform isolation
✅ **Scalable**: Easy to extend with new types/platforms
✅ **Backward Compatible**: All existing users work
✅ **Type Safe**: Full TypeScript + Prisma support
✅ **Well Documented**: Code comments + this guide
