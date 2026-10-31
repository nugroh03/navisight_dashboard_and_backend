import { NextRequest, NextResponse } from 'next/server';
import { requireBackupAdmin } from '@/lib/backup-auth';
import {
  BackupKeyMissingError,
  encryptSecret,
} from '@/lib/backup-crypto';
import { readBackupSettings, updateBackupStorage } from '@/lib/db-backup';
import { storageSchema } from './schema';

// PUT /api/backups/storage - Simpan credential R2
export async function PUT(request: NextRequest) {
  const auth = await requireBackupAdmin();
  if (auth.error) return auth.error;

  const parsed = storageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
      { status: 400 }
    );
  }
  const { secretAccessKey, ...fields } = parsed.data;
  if (!secretAccessKey && !(await readBackupSettings()).secretEnc) {
    return NextResponse.json(
      { message: 'Secret Access Key wajib diisi' },
      { status: 400 }
    );
  }

  try {
    await updateBackupStorage({
      ...fields,
      ...(secretAccessKey ? { secretEnc: encryptSecret(secretAccessKey) } : {}),
    });
  } catch (error) {
    if (error instanceof BackupKeyMissingError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }
    throw error;
  }
  console.info(
    `[BACKUP] ${auth.email} mengubah penyimpanan R2: bucket=${fields.bucket}`
  );
  return NextResponse.json({ ok: true });
}
