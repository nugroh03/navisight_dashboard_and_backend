import { NextRequest, NextResponse } from 'next/server';
import { requireBackupAdmin } from '@/lib/backup-auth';
import {
  deleteBackup,
  getBackupDownloadUrl,
  isBackupFileName,
} from '@/lib/db-backup';

// GET /api/backups/[name] - Alihkan ke link download R2 yang berlaku sebentar
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  const auth = await requireBackupAdmin();
  if (auth.error) return auth.error;

  const { name } = await context.params;
  if (!isBackupFileName(name)) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  console.info(`[BACKUP] ${auth.email} mengunduh ${name}`);
  const response = NextResponse.redirect(await getBackupDownloadUrl(name));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

// DELETE /api/backups/[name] - Hapus backup
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  const auth = await requireBackupAdmin();
  if (auth.error) return auth.error;

  const { name } = await context.params;
  if (!isBackupFileName(name)) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  await deleteBackup(name);
  console.info(`[BACKUP] ${auth.email} menghapus ${name}`);
  return NextResponse.json({ ok: true });
}
