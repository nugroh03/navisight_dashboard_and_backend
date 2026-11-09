import { createHash } from 'crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Riwayat hidup/mati perangkat (PC lokal, kamera, internet Starlink).
 *
 * Agent di PC lokal mengirim laporan berkala ke /api/monitoring/report. Laporan
 * sekaligus menjadi heartbeat. Status disimpan sebagai periode (device_status_logs):
 * setiap perubahan menutup periode lama dan membuka periode baru.
 *
 * PC yang kehilangan listrik tidak bisa melapor. Saat heartbeat hilang, VPS menandai
 * semua perangkat agent "UNKNOWN" secara provisional (markLostAgents). Ketika agent
 * kembali, tanda provisional itu dibuang lalu diganti data asli:
 * - boot_id sama  → PC tetap hidup (mis. internet putus); antrean event agent mengisi
 *   apa yang sebenarnya terjadi.
 * - boot_id beda  → PC menyala ulang; PC dicatat OFFLINE sejak waktu hidup terakhir
 *   boot sebelumnya (dari journal agent), lalu ONLINE sejak waktu boot.
 */

export const DEVICE_KINDS = ['PC', 'CAMERA', 'INTERNET'] as const;
export const DEVICE_STATUSES = ['ONLINE', 'OFFLINE', 'UNKNOWN'] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const PC_DEVICE_KEY = 'pc';
// Penyebab PC mati: dimatikan normal, restart, atau listrik putus/hang (tanpa jejak shutdown).
export const PC_END_REASONS = ['SHUTDOWN', 'REBOOT', 'POWER_LOSS'] as const;
const MAX_FUTURE_SKEW_MS = 5 * 60_000;

type Tx = Prisma.TransactionClient;
type DeviceState = {
  id: string;
  kind: string;
  key: string;
  currentStatus: string;
  statusSince: Date | null;
};

export const hashAgentToken = (token: string) =>
  createHash('sha256').update(token, 'utf8').digest('hex');

export async function findAgentByToken(token: string) {
  if (!token || token.length < 32) return null;
  return prisma.monitorAgent.findUnique({
    where: { tokenHash: hashAgentToken(token) },
  });
}

const isoDate = z.coerce.date();

export const reportSchema = z.object({
  // /proc/sys/kernel/random/boot_id
  bootId: z.string().min(1).max(64),
  bootedAt: isoDate,
  // Dari journal boot sebelumnya; dikirim agent pada laporan pertama setelah boot.
  previousBoot: z
    .object({
      lastSeenAt: isoDate,
      endReason: z.enum(PC_END_REASONS),
    })
    .nullish(),
  // Riwayat boot lama dari journal; dikirim sekali saat agent baru dipasang.
  bootHistory: z
    .array(
      z.object({
        bootId: z.string().min(1).max(64),
        bootedAt: isoDate,
        lastSeenAt: isoDate,
        endReason: z.enum(PC_END_REASONS),
      })
    )
    .max(1000)
    .nullish(),
  devices: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        kind: z.enum(DEVICE_KINDS),
        name: z.string().min(1).max(255),
      })
    )
    .max(50),
  // Perubahan status (termasuk yang tertunda saat internet putus), jam asli agent.
  events: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        status: z.enum(DEVICE_STATUSES),
        reason: z.string().max(40).nullish(),
        at: isoDate,
      })
    )
    .max(5000),
});

export type MonitoringReport = z.infer<typeof reportSchema>;

/**
 * Ubah status satu perangkat pada waktu `at`. Tidak berbuat apa-apa jika status sama.
 * Waktu tidak boleh mundur dari awal periode berjalan (dijepit ke statusSince).
 */
async function setStatus(
  tx: Tx,
  device: DeviceState,
  status: DeviceStatus,
  reason: string | null,
  at: Date,
  provisional = false
): Promise<DeviceState> {
  if (device.currentStatus === status && device.statusSince) return device;

  const startedAt =
    device.statusSince && at < device.statusSince ? device.statusSince : at;

  await tx.deviceStatusLog.updateMany({
    where: { deviceId: device.id, endedAt: null },
    data: { endedAt: startedAt },
  });
  await tx.deviceStatusLog.create({
    data: { deviceId: device.id, status, reason, startedAt, provisional },
  });
  await tx.monitoredDevice.update({
    where: { id: device.id },
    data: { currentStatus: status, statusSince: startedAt },
  });

  device.currentStatus = status;
  device.statusSince = startedAt;
  return device;
}

/** PC mati → kamera & internet tidak bisa dipantau sejak saat yang sama. */
async function setPcStatus(
  tx: Tx,
  devices: Map<string, DeviceState>,
  status: DeviceStatus,
  reason: string | null,
  at: Date
) {
  const pc = devices.get(PC_DEVICE_KEY)!;
  await setStatus(tx, pc, status, reason, at);
  if (status === 'OFFLINE') {
    for (const device of devices.values()) {
      if (device.key === PC_DEVICE_KEY) continue;
      await setStatus(tx, device, 'UNKNOWN', 'PC_OFF', pc.statusSince ?? at);
    }
  }
}

/** Buang periode provisional milik agent dan buka kembali periode asli terakhir. */
async function rollbackProvisional(tx: Tx, devices: Map<string, DeviceState>) {
  for (const device of devices.values()) {
    const removed = await tx.deviceStatusLog.deleteMany({
      where: { deviceId: device.id, provisional: true },
    });
    if (removed.count === 0) continue;

    const last = await tx.deviceStatusLog.findFirst({
      where: { deviceId: device.id },
      orderBy: { startedAt: 'desc' },
    });
    if (last) {
      await tx.deviceStatusLog.update({
        where: { id: last.id },
        data: { endedAt: null },
      });
    }
    device.currentStatus = last?.status ?? 'UNKNOWN';
    device.statusSince = last?.startedAt ?? null;
    await tx.monitoredDevice.update({
      where: { id: device.id },
      data: {
        currentStatus: device.currentStatus,
        statusSince: device.statusSince,
      },
    });
  }
}

async function ensureDevices(
  tx: Tx,
  agentId: string,
  report: MonitoringReport
): Promise<Map<string, DeviceState>> {
  const declared = new Map(report.devices.map((d) => [d.key, d]));
  if (!declared.has(PC_DEVICE_KEY)) {
    declared.set(PC_DEVICE_KEY, {
      key: PC_DEVICE_KEY,
      kind: 'PC',
      name: 'PC lokal',
    });
  }

  const cameraHosts = [...declared.values()]
    .filter((d) => d.kind === 'CAMERA')
    .map((d) => d.key);
  const cameras = cameraHosts.length
    ? await tx.camera.findMany({
        where: { isapiHost: { in: cameraHosts } },
        select: { id: true, isapiHost: true },
      })
    : [];
  const cameraByHost = new Map(cameras.map((c) => [c.isapiHost!, c.id]));

  for (const d of declared.values()) {
    const cameraId = d.kind === 'CAMERA' ? (cameraByHost.get(d.key) ?? null) : null;
    await tx.monitoredDevice.upsert({
      where: { agentId_key: { agentId, key: d.key } },
      create: { agentId, key: d.key, kind: d.kind, name: d.name, cameraId },
      update: { kind: d.kind, name: d.name, cameraId },
    });
  }

  const rows = await tx.monitoredDevice.findMany({
    where: { agentId },
    select: {
      id: true,
      kind: true,
      key: true,
      currentStatus: true,
      statusSince: true,
    },
  });
  return new Map(rows.map((r) => [r.key, r]));
}

export async function ingestReport(
  agentId: string,
  report: MonitoringReport,
  now = new Date()
) {
  const latestAllowed = new Date(now.getTime() + MAX_FUTURE_SKEW_MS);
  const events = report.events
    .filter((e) => e.at <= latestAllowed)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  return prisma.$transaction(
    async (tx) => {
      // Kunci baris agent: laporan dari agent yang sama diproses berurutan.
      await tx.$queryRaw`SELECT id FROM monitor_agents WHERE id = ${agentId}::uuid FOR UPDATE`;
      const agent = await tx.monitorAgent.findUniqueOrThrow({
        where: { id: agentId },
      });

      const devices = await ensureDevices(tx, agentId, report);
      await rollbackProvisional(tx, devices);

      const firstReport = agent.lastBootId === null;
      const newBoot = !firstReport && agent.lastBootId !== report.bootId;

      // Event dari boot sebelumnya (antrean yang belum terkirim) diterapkan dulu,
      // agar urutan waktunya benar sebelum PC dicatat mati lalu menyala.
      const beforeBoot = newBoot ? events.filter((e) => e.at < report.bootedAt) : [];
      const afterBoot = newBoot ? events.filter((e) => e.at >= report.bootedAt) : events;

      let applied = 0;
      const apply = async (list: typeof events) => {
        for (const e of list) {
          const device = devices.get(e.key);
          if (!device) continue;
          // Event lama yang terkirim ulang tidak boleh menimpa status yang lebih baru.
          if (device.statusSince && e.at < device.statusSince) continue;
          if (device.key === PC_DEVICE_KEY) {
            await setPcStatus(tx, devices, e.status, e.reason ?? null, e.at);
          } else {
            await setStatus(tx, device, e.status, e.reason ?? null, e.at);
          }
          applied++;
        }
      };

      await apply(beforeBoot);

      const pc = devices.get(PC_DEVICE_KEY)!;
      if (newBoot) {
        if (pc.currentStatus !== 'OFFLINE') {
          const candidate =
            report.previousBoot?.lastSeenAt ?? agent.lastSeenAt ?? report.bootedAt;
          const downAt = candidate > report.bootedAt ? report.bootedAt : candidate;
          await setPcStatus(
            tx,
            devices,
            'OFFLINE',
            report.previousBoot?.endReason ?? 'POWER_LOSS',
            downAt
          );
        }
        await setPcStatus(tx, devices, 'ONLINE', 'BOOT', report.bootedAt);
      } else if (firstReport) {
        await setPcStatus(tx, devices, 'ONLINE', 'BOOT', report.bootedAt);
      } else if (pc.currentStatus !== 'ONLINE') {
        // Boot sama tetapi PC tercatat mati (mis. shutdown dibatalkan).
        await setPcStatus(tx, devices, 'ONLINE', 'RECOVERED', events[0]?.at ?? now);
      }

      await apply(afterBoot);

      const imported = report.bootHistory?.length
        ? await importBootHistory(tx, devices.get(PC_DEVICE_KEY)!, report)
        : 0;

      await tx.monitoredDevice.updateMany({
        where: { agentId, key: { in: report.devices.map((d) => d.key) } },
        data: { lastCheckedAt: now },
      });
      await tx.monitorAgent.update({
        where: { id: agentId },
        data: { lastSeenAt: now, lastBootId: report.bootId, lostAt: null },
      });

      return { applied, newBoot, firstReport, imported };
    },
    { timeout: 30_000 }
  );
}

/**
 * Isi riwayat PC sebelum periode tercatat pertama, dari daftar boot di journal.
 * Hanya boot yang selesai sebelum periode pertama yang dipakai, sehingga aman
 * dikirim ulang (idempoten) dan tidak menimpa data yang sudah ada.
 */
async function importBootHistory(tx: Tx, pc: DeviceState, report: MonitoringReport) {
  const earliest = await tx.deviceStatusLog.findFirst({
    where: { deviceId: pc.id },
    orderBy: { startedAt: 'asc' },
  });
  if (!earliest) return 0;

  const boots = (report.bootHistory ?? [])
    .filter(
      (b) =>
        b.bootId !== report.bootId &&
        b.bootedAt < b.lastSeenAt &&
        b.lastSeenAt <= earliest.startedAt
    )
    .sort((a, b) => a.bootedAt.getTime() - b.bootedAt.getTime());

  // Buang boot yang tumpang tindih (jam sistem sempat salah).
  const clean: typeof boots = [];
  for (const b of boots) {
    const prev = clean.at(-1);
    if (!prev || b.bootedAt >= prev.lastSeenAt) clean.push(b);
  }
  if (clean.length === 0) return 0;

  const rows: Prisma.DeviceStatusLogCreateManyInput[] = [];
  clean.forEach((b, i) => {
    const nextStart = clean[i + 1]?.bootedAt ?? earliest.startedAt;
    rows.push({
      deviceId: pc.id,
      status: 'ONLINE',
      reason: 'BOOT',
      startedAt: b.bootedAt,
      endedAt: b.lastSeenAt,
    });
    if (i < clean.length - 1 || earliest.status !== 'OFFLINE') {
      rows.push({
        deviceId: pc.id,
        status: 'OFFLINE',
        reason: b.endReason,
        startedAt: b.lastSeenAt,
        endedAt: nextStart,
      });
    }
  });

  const last = clean.at(-1)!;
  if (earliest.status === 'OFFLINE') {
    // Periode pertama sudah OFFLINE: perpanjang ke belakang, jangan dobel.
    await tx.deviceStatusLog.update({
      where: { id: earliest.id },
      data: { startedAt: last.lastSeenAt, reason: last.endReason },
    });
  }
  await tx.deviceStatusLog.createMany({ data: rows });
  return clean.length;
}

/**
 * Tandai agent yang berhenti melapor: semua perangkatnya UNKNOWN (provisional) sejak
 * laporan terakhir. Dipanggil berkala oleh pengecek di VPS (tahap 3).
 */
export async function markLostAgents(now = new Date()) {
  const agents = await prisma.monitorAgent.findMany({
    where: { lostAt: null, lastSeenAt: { not: null } },
  });
  let marked = 0;

  for (const candidate of agents) {
    if (now.getTime() - candidate.lastSeenAt!.getTime() < candidate.timeoutSec * 1000) {
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM monitor_agents WHERE id = ${candidate.id}::uuid FOR UPDATE`;
      // Baca ulang setelah dikunci: laporan bisa saja masuk di antara pengecekan.
      const agent = await tx.monitorAgent.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      if (
        agent.lostAt ||
        !agent.lastSeenAt ||
        now.getTime() - agent.lastSeenAt.getTime() < agent.timeoutSec * 1000
      ) {
        return;
      }
      const devices = await tx.monitoredDevice.findMany({
        where: { agentId: agent.id },
        select: { id: true, kind: true, key: true, currentStatus: true, statusSince: true },
      });
      for (const device of devices) {
        if (device.currentStatus === 'UNKNOWN') continue;
        await setStatus(tx, device, 'UNKNOWN', 'NO_HEARTBEAT', agent.lastSeenAt, true);
      }
      await tx.monitorAgent.update({
        where: { id: agent.id },
        data: { lostAt: now },
      });
      marked++;
    });
  }
  return marked;
}

const checkerState = globalThis as typeof globalThis & {
  __deviceMonitorTimer?: ReturnType<typeof setInterval>;
  __deviceMonitorBusy?: boolean;
};

// Pengecek di server: tandai agent yang berhenti melapor (> timeoutSec) sebagai hilang.
// Perangkatnya menjadi UNKNOWN/NO_HEARTBEAT sementara (provisional) sampai agent melapor lagi.
export function startMonitoringChecker(intervalMs = 30_000) {
  if (checkerState.__deviceMonitorTimer) return;
  checkerState.__deviceMonitorTimer = setInterval(async () => {
    if (checkerState.__deviceMonitorBusy) return;
    checkerState.__deviceMonitorBusy = true;
    try {
      const marked = await markLostAgents();
      if (marked > 0) console.warn(`[MONITORING] ${marked} agent berhenti melapor`);
    } catch (error) {
      console.error('[MONITORING] Pengecekan gagal:', error);
    } finally {
      checkerState.__deviceMonitorBusy = false;
    }
  }, intervalMs);
  checkerState.__deviceMonitorTimer.unref?.();
}
