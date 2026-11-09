import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireBackupAdmin } from '@/lib/backup-auth';
import { BackupKeyMissingError, encryptSecret, isBackupKeyConfigured } from '@/lib/backup-crypto';
import { prisma } from '@/lib/prisma';
import {
  TelegramError,
  decryptTelegramToken,
  detectTelegramChats,
  formatTime,
  readMonitoringSettings,
  sendTelegramMessage,
} from '@/lib/monitoring-alerts';

const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,64}$/;
const tokenSchema = z
  .string()
  .trim()
  .regex(TOKEN_RE, 'Format token bot tidak valid (contoh 123456789:AAH...)');
const chatIdSchema = z
  .string()
  .trim()
  .regex(/^(-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/, 'Chat ID tidak valid');

const saveSchema = z.object({
  enabled: z.boolean(),
  token: z.union([tokenSchema, z.literal('')]).optional(),
  chatId: z.union([chatIdSchema, z.literal('')]),
  alertDelayMin: z.number().int().min(1).max(120),
  notifyRecovery: z.boolean(),
});

const actionSchema = z.object({
  action: z.enum(['test', 'detect']),
  token: z.union([tokenSchema, z.literal('')]).optional(),
  chatId: z.union([chatIdSchema, z.literal('')]).optional(),
});

const fail = (message: string, status = 400) => NextResponse.json({ message }, { status });

/** Token dari form; bila kosong pakai token tersimpan. */
async function resolveToken(token?: string) {
  if (token) return token;
  const settings = await readMonitoringSettings();
  return decryptTelegramToken(settings.telegramTokenEnc);
}

// GET /api/monitoring/telegram — pengaturan notifikasi (token tidak pernah dikirim)
export async function GET() {
  const auth = await requireBackupAdmin();
  if (auth.error) return auth.error;
  const s = await readMonitoringSettings();
  return NextResponse.json({
    enabled: s.telegramEnabled,
    hasToken: !!s.telegramTokenEnc,
    chatId: s.telegramChatId ?? '',
    alertDelayMin: s.alertDelayMin,
    notifyRecovery: s.notifyRecovery,
    lastError: s.lastError,
    lastSentAt: s.lastSentAt,
    encryptionReady: isBackupKeyConfigured(),
  });
}

// PUT /api/monitoring/telegram — simpan pengaturan
export async function PUT(request: NextRequest) {
  const auth = await requireBackupAdmin();
  if (auth.error) return auth.error;
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  const { enabled, token, chatId, alertDelayMin, notifyRecovery } = parsed.data;

  const current = await readMonitoringSettings();
  let tokenEnc = current.telegramTokenEnc;
  if (token) {
    try {
      tokenEnc = encryptSecret(token);
    } catch (error) {
      if (error instanceof BackupKeyMissingError) return fail(error.message);
      throw error;
    }
  }
  if (enabled && (!tokenEnc || !chatId)) {
    return fail('Isi token bot dan chat ID sebelum mengaktifkan notifikasi');
  }

  const data = {
    telegramEnabled: enabled,
    telegramTokenEnc: tokenEnc,
    telegramChatId: chatId || null,
    alertDelayMin,
    notifyRecovery,
    lastError: null,
  };
  await prisma.monitoringSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}

// POST /api/monitoring/telegram — { action: 'test' | 'detect' }
export async function POST(request: NextRequest) {
  const auth = await requireBackupAdmin();
  if (auth.error) return auth.error;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  const { action, chatId } = parsed.data;

  const token = await resolveToken(parsed.data.token);
  if (!token) return fail('Isi token bot terlebih dahulu');

  try {
    if (action === 'detect') {
      const chats = await detectTelegramChats(token);
      return NextResponse.json({ chats });
    }
    const target = chatId || (await readMonitoringSettings()).telegramChatId;
    if (!target) return fail('Isi chat ID terlebih dahulu');
    await sendTelegramMessage(
      token,
      target,
      `✅ Tes notifikasi Riwayat Perangkat berhasil (${formatTime(new Date())}).`
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TelegramError) return fail(error.message, 502);
    throw error;
  }
}
