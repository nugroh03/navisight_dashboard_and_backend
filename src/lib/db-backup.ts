import { spawn } from 'child_process';
import { createReadStream, promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { decryptSecret } from '@/lib/backup-crypto';
import { prisma } from '@/lib/prisma';

// Backup database dengan pg_dump ke Cloudflare R2. File hanya berada di folder
// sementara selama proses. Dashboard berjalan sebagai satu proses Node.
const SETTINGS_ID = 'default';
const PREFIX = 'navisight/';
const TIME_ZONE = 'Asia/Jakarta';
const DUMP_TIMEOUT_MS = 30 * 60_000;
const MIN_FREE_BYTES = 1024 ** 3;
const RETRY_AFTER_MS = 30 * 60_000;
const DOWNLOAD_LINK_SECONDS = 300;
const FILE_PATTERN =
  /^navisight-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(auto|manual)\.(sql|dump)$/;

export type R2Credentials = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

// globalThis: route API dan jadwal bisa berada di bundle Next yang berbeda.
const state = globalThis as typeof globalThis & {
  __dbBackupRunning?: boolean;
  __dbBackupLastFailure?: string | null;
  __dbBackupTimer?: ReturnType<typeof setInterval>;
};

export const isBackupRunning = () => !!state.__dbBackupRunning;
export const lastBackupFailure = () => state.__dbBackupLastFailure ?? null;
export const isBackupFileName = (name: string) => FILE_PATTERN.test(name);

const zonedNow = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    stamp: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}-${parts.minute}-${parts.second}`,
  };
};

export const readBackupSettings = () =>
  prisma.backupSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });

export async function updateBackupSchedule(update: {
  enabled: boolean;
  time: string;
  keep: number;
}) {
  const current = await readBackupSettings();
  return prisma.backupSettings.update({
    where: { id: SETTINGS_ID },
    data: {
      ...update,
      lastError: null,
      lastAttemptAt: null,
      // Jam dimajukan ke nanti hari ini: jadwal baru tetap berjalan hari ini.
      ...(update.time !== current.time && update.time > zonedNow().time
        ? { lastAutoDate: null }
        : {}),
    },
  });
}

export async function updateBackupStorage(update: {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretEnc?: string;
}) {
  await readBackupSettings();
  return prisma.backupSettings.update({
    where: { id: SETTINGS_ID },
    data: { ...update, lastError: null, lastAttemptAt: null },
  });
}

const createClient = (credentials: R2Credentials) =>
  new S3Client({
    region: 'auto',
    endpoint:
      process.env.BACKUP_S3_ENDPOINT ||
      `https://${credentials.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
    // R2 tidak mendukung checksum bawaan SDK untuk unggahan stream.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

export async function getSavedCredentials(): Promise<R2Credentials | null> {
  const settings = await readBackupSettings();
  if (
    !settings.accountId ||
    !settings.bucket ||
    !settings.accessKeyId ||
    !settings.secretEnc
  ) {
    return null;
  }
  return {
    accountId: settings.accountId,
    bucket: settings.bucket,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: decryptSecret(settings.secretEnc),
  };
}

const requireCredentials = async () => {
  const credentials = await getSavedCredentials();
  if (!credentials) throw new Error('Penyimpanan R2 belum diatur');
  return credentials;
};

// Membuktikan token bisa menulis, membaca daftar, dan menghapus di bucket ini.
export async function testR2Connection(credentials: R2Credentials) {
  const client = createClient(credentials);
  const Key = `${PREFIX}.tes-koneksi-${Date.now()}`;
  await client.send(
    new PutObjectCommand({ Bucket: credentials.bucket, Key, Body: 'ok' })
  );
  try {
    await client.send(
      new ListObjectsV2Command({
        Bucket: credentials.bucket,
        Prefix: PREFIX,
        MaxKeys: 1,
      })
    );
  } finally {
    await client.send(
      new DeleteObjectCommand({ Bucket: credentials.bucket, Key })
    );
  }
}

async function listFrom(credentials: R2Credentials) {
  const client = createClient(credentials);
  const backups: {
    name: string;
    size: number;
    createdAt: string;
    type: 'auto' | 'manual';
  }[] = [];
  let ContinuationToken: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: credentials.bucket,
        Prefix: PREFIX,
        ContinuationToken,
      })
    );
    for (const item of page.Contents ?? []) {
      const name = (item.Key ?? '').slice(PREFIX.length);
      if (!isBackupFileName(name)) continue;
      backups.push({
        name,
        size: item.Size ?? 0,
        createdAt: (item.LastModified ?? new Date()).toISOString(),
        type: name.includes('-auto.') ? 'auto' : 'manual',
      });
    }
    ContinuationToken = page.NextContinuationToken;
  } while (ContinuationToken);
  return backups.sort((a, b) => b.name.localeCompare(a.name));
}

export const listBackups = async () => listFrom(await requireCredentials());

export async function deleteBackup(name: string) {
  const credentials = await requireCredentials();
  await createClient(credentials).send(
    new DeleteObjectCommand({
      Bucket: credentials.bucket,
      Key: `${PREFIX}${name}`,
    })
  );
}

export async function getBackupDownloadUrl(name: string) {
  const credentials = await requireCredentials();
  return getSignedUrl(
    createClient(credentials),
    new GetObjectCommand({
      Bucket: credentials.bucket,
      Key: `${PREFIX}${name}`,
      ResponseContentDisposition: `attachment; filename="${name}"`,
    }),
    { expiresIn: DOWNLOAD_LINK_SECONDS }
  );
}

function dumpEnv() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL belum diatur');
  const url = new URL(raw);
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    // Lewat env agar password tidak terlihat di daftar proses.
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    ...(url.searchParams.get('sslmode')
      ? { PGSSLMODE: url.searchParams.get('sslmode') as string }
      : {}),
  };
}

const runPgDump = (file: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(
      'pg_dump',
      ['--format=plain', '--no-owner', '--no-privileges', '--file', file],
      { env: dumpEnv(), stdio: ['ignore', 'ignore', 'pipe'] }
    );
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), DUMP_TIMEOUT_MS);
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-500);
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `pg_dump keluar dengan kode ${code}`));
    });
  });

export async function createBackup(type: 'auto' | 'manual') {
  if (state.__dbBackupRunning) throw new Error('Backup lain sedang berjalan');
  state.__dbBackupRunning = true;
  const name = `navisight-${zonedNow().stamp}-${type}.sql`;
  const temp = path.join(tmpdir(), name);
  try {
    const credentials = await requireCredentials();
    const stats = await fs.statfs(tmpdir());
    if (stats.bavail * stats.bsize < MIN_FREE_BYTES) {
      throw new Error('Ruang disk sementara kurang dari 1 GB');
    }
    await runPgDump(temp);
    // File SQL yang utuh selalu ditutup penanda ini di bagian akhir.
    const { size } = await fs.stat(temp);
    const handle = await fs.open(temp, 'r');
    const tail = Buffer.alloc(Math.min(size, 512));
    await handle.read(tail, 0, tail.length, size - tail.length);
    await handle.close();
    if (!tail.toString().includes('PostgreSQL database dump complete')) {
      throw new Error('Hasil pg_dump tidak utuh');
    }

    await createClient(credentials).send(
      new PutObjectCommand({
        Bucket: credentials.bucket,
        Key: `${PREFIX}${name}`,
        Body: createReadStream(temp),
        ContentLength: size,
      })
    );

    // Hanya backup otomatis yang dibatasi jumlahnya; backup manual tidak dihapus.
    const { keep } = await readBackupSettings();
    const autos = (await listFrom(credentials)).filter(
      (item) => item.type === 'auto'
    );
    for (const item of autos.slice(keep)) await deleteBackup(item.name);

    state.__dbBackupLastFailure = null;
    console.info(`[BACKUP] ${type} selesai: ${name} (${size} byte)`);
    return name;
  } catch (error) {
    state.__dbBackupLastFailure =
      error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await fs.unlink(temp).catch(() => undefined);
    state.__dbBackupRunning = false;
  }
}

async function runScheduledBackup() {
  const settings = await readBackupSettings();
  const now = zonedNow();
  if (
    !settings.enabled ||
    !settings.secretEnc ||
    state.__dbBackupRunning ||
    settings.lastAutoDate === now.date ||
    now.time < settings.time ||
    (settings.lastAttemptAt &&
      Date.now() - settings.lastAttemptAt.getTime() < RETRY_AFTER_MS)
  ) {
    return;
  }

  await prisma.backupSettings.update({
    where: { id: SETTINGS_ID },
    data: { lastAttemptAt: new Date() },
  });
  try {
    await createBackup('auto');
    await prisma.backupSettings.update({
      where: { id: SETTINGS_ID },
      data: { lastAutoDate: now.date, lastError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[BACKUP] Backup otomatis gagal:', message);
    await prisma.backupSettings.update({
      where: { id: SETTINGS_ID },
      data: { lastError: message },
    });
  }
}

export function startBackupScheduler() {
  if (state.__dbBackupTimer) return;
  state.__dbBackupTimer = setInterval(() => {
    runScheduledBackup().catch((error) =>
      console.error('[BACKUP] Jadwal gagal:', error)
    );
  }, 60_000);
}
