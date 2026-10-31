import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireBackupAdmin } from '@/lib/backup-auth';
import { isBackupKeyConfigured } from '@/lib/backup-crypto';
import {
  createBackup,
  isBackupRunning,
  lastBackupFailure,
  listBackups,
  readBackupSettings,
  updateBackupSchedule,
} from '@/lib/db-backup';

const scheduleSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam tidak valid'),
  keep: z.number().int().min(1).max(365),
});

// GET /api/backups - Daftar backup dan pengaturan (secret tidak pernah dikirim)
export async function GET() {
  const auth = await requireBackupAdmin();
  if (auth.error) return auth.error;

  const settings = await readBackupSettings();
  const configured = !!settings.secretEnc;
  let backups: Awaited<ReturnType<typeof listBackups>> = [];
  let listError: string | null = null;
  if (configured) {
    try {
      backups = await listBackups();
    } catch (error) {
      console.error('[BACKUP] Gagal membaca daftar:', error);
      listError = 'Tidak bisa membaca daftar backup dari R2';
    }
  }

  return NextResponse.json({
    backups,
    listError,
    schedule: {
      enabled: settings.enabled,
      time: settings.time,
      keep: settings.keep,
      lastError: settings.lastError,
    },
    storage: {
      accountId: settings.accountId ?? '',
      bucket: settings.bucket ?? '',
      accessKeyId: settings.accessKeyId ?? '',
      hasSecret: configured,
    },
    encryptionReady: isBackupKeyConfigured(),
    running: isBackupRunning(),
    lastFailure: lastBackupFailure(),
  });
}

// POST /api/backups - Backup manual, berjalan di latar belakang
export async function POST() {
  const auth = await requireBackupAdmin();
  if (auth.error) return auth.error;

  if (isBackupRunning()) {
    return NextResponse.json(
      { message: 'Backup lain sedang berjalan' },
      { status: 409 }
    );
  }
  if (!(await readBackupSettings()).secretEnc) {
    return NextResponse.json(
      { message: 'Penyimpanan R2 belum diatur' },
      { status: 400 }
    );
  }

  console.info(`[BACKUP] ${auth.email} memulai backup manual`);
  createBackup('manual').catch((error) =>
    console.error('[BACKUP] Backup manual gagal:', error.message)
  );
  return NextResponse.json({ ok: true }, { status: 202 });
}

// PATCH /api/backups - Ubah jadwal
export async function PATCH(request: NextRequest) {
  const auth = await requireBackupAdmin();
  if (auth.error) return auth.error;

  const parsed = scheduleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation error', errors: parsed.error.issues },
      { status: 400 }
    );
  }
  const settings = await updateBackupSchedule(parsed.data);
  console.info(
    `[BACKUP] ${auth.email} mengubah jadwal: enabled=${settings.enabled} time=${settings.time} keep=${settings.keep}`
  );
  return NextResponse.json({ ok: true });
}
