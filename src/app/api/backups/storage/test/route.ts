import { NextRequest, NextResponse } from 'next/server';
import { requireBackupAdmin } from '@/lib/backup-auth';
import { BackupKeyMissingError } from '@/lib/backup-crypto';
import { getSavedCredentials, testR2Connection } from '@/lib/db-backup';
import { storageSchema } from '../schema';

// POST /api/backups/storage/test - Tes isi form tanpa menyimpannya
export async function POST(request: NextRequest) {
  const auth = await requireBackupAdmin();
  if (auth.error) return auth.error;

  const parsed = storageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
      { status: 400 }
    );
  }

  try {
    const secretAccessKey =
      parsed.data.secretAccessKey ||
      (await getSavedCredentials())?.secretAccessKey;
    if (!secretAccessKey) {
      return NextResponse.json(
        { message: 'Secret Access Key wajib diisi' },
        { status: 400 }
      );
    }
    await testR2Connection({ ...parsed.data, secretAccessKey });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BackupKeyMissingError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }
    console.error('[BACKUP] Tes koneksi R2 gagal:', error);
    const name = error instanceof Error ? error.name : 'Error';
    return NextResponse.json(
      { message: `Koneksi ke R2 gagal (${name})` },
      { status: 502 }
    );
  }
}
