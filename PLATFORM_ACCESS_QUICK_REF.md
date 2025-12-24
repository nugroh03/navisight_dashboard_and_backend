# 🚀 Quick Reference - Platform Access Configuration

## Otomatis saat User Dibuat dari Dashboard

### Via `/api/users` (Admin/Client membuat user)

```typescript
// CREATE WORKER → OTOMATIS SETTING:
{
  role: "WORKER",
  accountType: "INTERNAL_STAFF",     // ← Otomatis
  canAccessDashboard: true,          // ← Otomatis (bisa dashboard)
  canAccessMobile: true              // ← Otomatis (bisa mobile) ✅
}

// CREATE CLIENT → OTOMATIS SETTING:
{
  role: "CLIENT",
  accountType: "EXTERNAL_CUSTOMER",  // ← Otomatis
  canAccessDashboard: false,         // ← Otomatis (tidak bisa dashboard)
  canAccessMobile: true              // ← Otomatis (bisa mobile) ✅
}
```

### Via `/api/auth/register` (Public register)

```typescript
// REGISTER BARU → OTOMATIS SETTING:
{
  accountType: "INTERNAL_STAFF",     // ← Default
  canAccessDashboard: true,          // ← Default
  canAccessMobile: true              // ← Default ✅
}
```

## 🔐 Login Rules

| User Type | Dashboard Login | Mobile Login |
|-----------|----------------|--------------|
| ADMINISTRATOR (INTERNAL_STAFF) | ✅ Allowed | ✅ Allowed |
| WORKER (INTERNAL_STAFF) | ✅ Allowed | ✅ Allowed |
| CLIENT (EXTERNAL_CUSTOMER) | ❌ **BLOCKED** | ✅ Allowed |

## 📝 Summary

✅ **Semua user yang dibuat dari dashboard otomatis bisa login mobile**
✅ **WORKER dapat akses dashboard + mobile**
✅ **CLIENT hanya dapat akses mobile (dashboard diblokir)**
✅ **Public register dapat akses keduanya**

## 🔧 Manual Override (jika diperlukan)

```sql
-- Disable mobile access untuk user tertentu
UPDATE users 
SET canAccessMobile = false 
WHERE email = 'user@example.com';

-- Enable dashboard untuk customer (special case)
UPDATE users 
SET canAccessDashboard = true 
WHERE email = 'special-customer@example.com';
```

## 🎯 Test Scenarios

```bash
# Test 1: Create WORKER dari dashboard
POST /api/users
{ "email": "worker@test.com", "password": "pass", "role": "WORKER" }

# Test login mobile → Should SUCCESS ✅
POST /api/auth/login/mobile
{ "email": "worker@test.com", "password": "pass" }

# Test login dashboard → Should SUCCESS ✅
POST /api/auth/login/dashboard
{ "email": "worker@test.com", "password": "pass" }

---

# Test 2: Create CLIENT dari dashboard
POST /api/users
{ "email": "client@test.com", "password": "pass", "role": "CLIENT" }

# Test login mobile → Should SUCCESS ✅
POST /api/auth/login/mobile
{ "email": "client@test.com", "password": "pass" }

# Test login dashboard → Should FAIL ❌ (403 Access Denied)
POST /api/auth/login/dashboard
{ "email": "client@test.com", "password": "pass" }
```
