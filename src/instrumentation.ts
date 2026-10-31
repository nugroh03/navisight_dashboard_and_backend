export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackupScheduler } = await import('@/lib/db-backup');
    startBackupScheduler();
  }
}
