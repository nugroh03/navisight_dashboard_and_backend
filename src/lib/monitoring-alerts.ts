import { prisma } from '@/lib/prisma';
import { decryptSecret, isBackupKeyConfigured } from '@/lib/backup-crypto';
import { PC_DEVICE_KEY } from '@/lib/device-monitoring';

/**
 * Notifikasi Telegram riwayat perangkat. Dipanggil pengecek berkala (tiap 30 detik).
 *
 * - Gangguan dikirim bila sudah berlangsung >= alertDelayMin menit (kedipan singkat diabaikan).
 * - Pesan "pulih" dikirim hanya untuk gangguan yang sebelumnya sudah dinotifikasi.
 * - alertSentAt baru diisi setelah Telegram menerima pesan, jadi kegagalan dicoba lagi.
 */

const SETTINGS_ID = 'default';
const TZ = 'Asia/Jakarta';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const formatTime = (date: Date) =>
  date.toLocaleString('id-ID', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';

export const formatDuration = (ms: number) => {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return '< 1 menit';
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam ${minutes % 60} menit`;
  return `${Math.floor(hours / 24)} hari ${hours % 24} jam`;
};

const REASON_TEXT: Record<string, string> = {
  POWER_LOSS: 'mati mendadak, listrik/hang',
  REBOOT: 'restart',
  SHUTDOWN: 'dimatikan normal',
  UNREACHABLE: 'tidak terjangkau di jaringan',
  NO_INTERNET: 'internet putus',
  ROUTER_DOWN: 'router tidak terjangkau',
  NOT_RECORDING: 'kamera hidup tapi tidak merekam',
};

export async function readMonitoringSettings() {
  return (
    (await prisma.monitoringSettings.findUnique({ where: { id: SETTINGS_ID } })) ?? {
      id: SETTINGS_ID,
      telegramEnabled: false,
      telegramTokenEnc: null,
      telegramChatId: null,
      alertDelayMin: 5,
      notifyRecovery: true,
      lastError: null,
      lastSentAt: null,
      updatedAt: new Date(0),
    }
  );
}

export function decryptTelegramToken(tokenEnc: string | null) {
  if (!tokenEnc || !isBackupKeyConfigured()) return null;
  try {
    return decryptSecret(tokenEnc);
  } catch {
    return null;
  }
}

export class TelegramError extends Error {}

async function telegramCall<T>(token: string, method: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new TelegramError('Tidak bisa menghubungi Telegram');
  }
  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
    result?: T;
    description?: string;
  } | null;
  if (!data?.ok) {
    if (response.status === 401) throw new TelegramError('Token bot tidak valid');
    if (response.status === 400 && /chat not found/i.test(data?.description ?? '')) {
      throw new TelegramError('Chat tidak ditemukan: kirim pesan ke bot dulu, lalu cek chat ID');
    }
    if (response.status === 403) {
      throw new TelegramError('Bot diblokir atau belum dimasukkan ke grup');
    }
    throw new TelegramError(`Telegram menolak: ${data?.description ?? response.status}`);
  }
  return data.result as T;
}

export const sendTelegramMessage = (token: string, chatId: string, html: string) =>
  telegramCall(token, 'sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });

/** Chat terbaru yang mengirim pesan ke bot (untuk mengisi chat ID otomatis). */
export async function detectTelegramChats(token: string) {
  type Update = {
    message?: { chat: { id: number; type: string; title?: string; first_name?: string; username?: string } };
    my_chat_member?: { chat: { id: number; type: string; title?: string; first_name?: string; username?: string } };
  };
  const updates = await telegramCall<Update[]>(token, 'getUpdates');
  const chats = new Map<string, { id: string; name: string; type: string }>();
  for (const u of updates.reverse()) {
    const chat = u.message?.chat ?? u.my_chat_member?.chat;
    if (!chat || chats.has(String(chat.id))) continue;
    chats.set(String(chat.id), {
      id: String(chat.id),
      type: chat.type,
      name: chat.title ?? chat.first_name ?? chat.username ?? String(chat.id),
    });
  }
  return [...chats.values()];
}

type DeviceRow = {
  id: string;
  kind: string;
  key: string;
  name: string;
  currentStatus: string;
  statusSince: Date | null;
  alertSentAt: Date | null;
  camera: { name: string | null } | null;
};

const deviceLabel = (d: DeviceRow) => {
  const name = escapeHtml(d.camera?.name || d.name);
  if (d.kind === 'CAMERA') return `Kamera <b>${name}</b> (${escapeHtml(d.key)})`;
  if (d.kind === 'RECORDING') return `Rekaman <b>${escapeHtml(d.camera?.name || d.key)}</b>`;
  return `<b>${name}</b>`;
};

async function lastReason(deviceId: string) {
  const log = await prisma.deviceStatusLog.findFirst({
    where: { deviceId, endedAt: null },
    select: { reason: true },
  });
  return log?.reason ?? null;
}

/** Susun pesan agent/perangkat yang perlu dikirim; kembalikan juga penanda yang diperbarui setelah terkirim. */
async function collectAlerts(now: Date, delayMs: number, notifyRecovery: boolean) {
  const lines: string[] = [];
  const agentUpdates: { id: string; alertSentAt: Date | null }[] = [];
  const deviceUpdates: { id: string; alertSentAt: Date | null }[] = [];

  const agents = await prisma.monitorAgent.findMany({
    include: {
      devices: {
        select: {
          id: true,
          kind: true,
          key: true,
          name: true,
          currentStatus: true,
          statusSince: true,
          alertSentAt: true,
          camera: { select: { name: true } },
        },
      },
    },
  });

  for (const agent of agents) {
    const agentName = escapeHtml(agent.name);

    // PC berhenti melapor (listrik mati / internet putus / PC hang).
    if (agent.lostAt && agent.lastSeenAt && !agent.alertSentAt) {
      if (now.getTime() - agent.lastSeenAt.getTime() >= delayMs) {
        lines.push(
          `🔴 <b>${agentName}</b> tidak melapor sejak ${formatTime(agent.lastSeenAt)}. ` +
            'Kemungkinan listrik mati atau internet putus; kamera tidak terpantau.'
        );
        agentUpdates.push({ id: agent.id, alertSentAt: now });
      }
    } else if (!agent.lostAt && agent.alertSentAt) {
      if (notifyRecovery) {
        lines.push(await agentRecoveryText(agent.id, agentName, agent.alertSentAt, delayMs));
      }
      agentUpdates.push({ id: agent.id, alertSentAt: null });
    }

    // Saat PC tidak melapor, status perangkat lain tidak bisa dinilai.
    if (agent.lostAt) continue;

    for (const d of agent.devices) {
      if (d.key === PC_DEVICE_KEY) continue;
      if (d.currentStatus === 'OFFLINE' && !d.alertSentAt && d.statusSince) {
        if (now.getTime() - d.statusSince.getTime() < delayMs) continue;
        const reason = await lastReason(d.id);
        const what =
          d.kind === 'RECORDING'
            ? `⚠️ ${deviceLabel(d)} berhenti: kamera hidup tapi tidak merekam`
            : d.kind === 'INTERNET'
              ? `🔴 ${deviceLabel(d)} putus${reason === 'ROUTER_DOWN' ? ' (router tidak terjangkau)' : ''}`
              : `🔴 ${deviceLabel(d)} mati${reason && REASON_TEXT[reason] ? ` (${REASON_TEXT[reason]})` : ''}`;
        lines.push(`${what} sejak ${formatTime(d.statusSince)}.`);
        deviceUpdates.push({ id: d.id, alertSentAt: now });
      } else if (d.currentStatus === 'ONLINE' && d.alertSentAt) {
        if (notifyRecovery) {
          const down = await prisma.deviceStatusLog.findFirst({
            where: { deviceId: d.id, status: 'OFFLINE', endedAt: { not: null } },
            orderBy: { startedAt: 'desc' },
            select: { startedAt: true, endedAt: true },
          });
          const duration = down?.endedAt
            ? ` (${formatDuration(down.endedAt.getTime() - down.startedAt.getTime())})`
            : '';
          lines.push(
            d.kind === 'RECORDING'
              ? `🟢 ${deviceLabel(d)} berjalan lagi${duration}.`
              : `🟢 ${deviceLabel(d)} ${d.kind === 'INTERNET' ? 'tersambung' : 'hidup'} lagi${duration}.`
          );
        }
        deviceUpdates.push({ id: d.id, alertSentAt: null });
      }
    }
  }

  return { lines, agentUpdates, deviceUpdates };
}

async function agentRecoveryText(agentId: string, agentName: string, alertSentAt: Date, delayMs: number) {
  // Gangguan yang memicu notifikasi: dimulai sebelum notifikasi terkirim dan baru berakhir
  // setelahnya (PC/internet belum pulih saat notifikasi dikirim).
  const windowStart = new Date(alertSentAt.getTime() - delayMs - 24 * 3_600_000);
  const endedAfter = new Date(alertSentAt.getTime() - 2 * 60_000);
  const pcOff = await prisma.deviceStatusLog.findFirst({
    where: {
      device: { agentId, key: PC_DEVICE_KEY },
      status: 'OFFLINE',
      provisional: false,
      startedAt: { gte: windowStart, lte: alertSentAt },
      endedAt: { gte: endedAfter },
    },
    orderBy: { startedAt: 'desc' },
  });
  if (pcOff?.endedAt) {
    const reason = pcOff.reason ? REASON_TEXT[pcOff.reason] ?? pcOff.reason : 'mati';
    return (
      `🟢 <b>${agentName}</b> menyala lagi pukul ${formatTime(pcOff.endedAt)}. ` +
      `Mati ${formatDuration(pcOff.endedAt.getTime() - pcOff.startedAt.getTime())} (${reason}).`
    );
  }
  const net = await prisma.deviceStatusLog.findFirst({
    where: {
      device: { agentId, kind: 'INTERNET' },
      status: 'OFFLINE',
      startedAt: { gte: windowStart, lte: alertSentAt },
      endedAt: { gte: endedAfter },
    },
    orderBy: { startedAt: 'desc' },
  });
  if (net?.endedAt) {
    return (
      `🟢 <b>${agentName}</b> melapor lagi. PC tetap hidup; internet putus ` +
      `${formatDuration(net.endedAt.getTime() - net.startedAt.getTime())}.`
    );
  }
  return `🟢 <b>${agentName}</b> melapor lagi. PC tetap hidup selama tidak melapor.`;
}

let running = false;

export async function runMonitoringAlerts(now = new Date()) {
  if (running) return 0;
  running = true;
  try {
    const settings = await readMonitoringSettings();
    if (!settings.telegramEnabled || !settings.telegramChatId) return 0;
    const token = decryptTelegramToken(settings.telegramTokenEnc);
    if (!token) return 0;

    const delayMs = Math.max(1, settings.alertDelayMin) * 60_000;
    const { lines, agentUpdates, deviceUpdates } = await collectAlerts(
      now,
      delayMs,
      settings.notifyRecovery
    );
    if (agentUpdates.length === 0 && deviceUpdates.length === 0) return 0;

    if (lines.length > 0) {
      // Batas pesan Telegram 4096 karakter.
      let text = lines.join('\n');
      if (text.length > 3900) text = text.slice(0, 3900) + '\n…';
      try {
        await sendTelegramMessage(token, settings.telegramChatId, text);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.monitoringSettings.update({
          where: { id: SETTINGS_ID },
          data: { lastError: `${formatTime(now)}: ${message}` },
        });
        return 0;
      }
    }

    await prisma.$transaction([
      ...agentUpdates.map((u) =>
        prisma.monitorAgent.update({ where: { id: u.id }, data: { alertSentAt: u.alertSentAt } })
      ),
      ...deviceUpdates.map((u) =>
        prisma.monitoredDevice.update({ where: { id: u.id }, data: { alertSentAt: u.alertSentAt } })
      ),
      prisma.monitoringSettings.update({
        where: { id: SETTINGS_ID },
        data: lines.length ? { lastError: null, lastSentAt: now } : {},
      }),
    ]);
    return lines.length;
  } finally {
    running = false;
  }
}
