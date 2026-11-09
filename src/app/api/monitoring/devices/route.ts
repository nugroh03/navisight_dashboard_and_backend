import { NextRequest, NextResponse } from 'next/server';
import { requireBackupAdmin } from '@/lib/backup-auth';
import { prisma } from '@/lib/prisma';

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 92;
const MAX_LOGS = 20_000;
const KIND_ORDER: Record<string, number> = { PC: 0, INTERNET: 1, CAMERA: 2, RECORDING: 3 };

const parseDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// GET /api/monitoring/devices?from=ISO&to=ISO — status sekarang + riwayat periode (khusus ADMINISTRATOR)
export async function GET(request: NextRequest) {
  const auth = await requireBackupAdmin();
  if (auth.error) return auth.error;

  const now = new Date();
  const params = request.nextUrl.searchParams;
  let to = parseDate(params.get('to')) ?? now;
  if (to > now) to = now;
  const from = parseDate(params.get('from')) ?? new Date(to.getTime() - DAY_MS);
  if (from >= to) {
    return NextResponse.json({ message: 'Rentang waktu tidak valid' }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    return NextResponse.json(
      { message: `Rentang maksimal ${MAX_RANGE_DAYS} hari` },
      { status: 400 }
    );
  }

  const [agents, devices, logs] = await Promise.all([
    prisma.monitorAgent.findMany({
      select: { id: true, name: true, lastSeenAt: true, lostAt: true, timeoutSec: true },
      orderBy: { name: 'asc' },
    }),
    prisma.monitoredDevice.findMany({
      select: {
        id: true,
        agentId: true,
        kind: true,
        key: true,
        name: true,
        currentStatus: true,
        statusSince: true,
        lastCheckedAt: true,
        camera: { select: { id: true, name: true, location: true } },
      },
    }),
    prisma.deviceStatusLog.findMany({
      where: {
        startedAt: { lt: to },
        OR: [{ endedAt: null }, { endedAt: { gt: from } }],
      },
      select: {
        deviceId: true,
        status: true,
        reason: true,
        startedAt: true,
        endedAt: true,
        provisional: true,
      },
      orderBy: { startedAt: 'asc' },
      take: MAX_LOGS + 1,
    }),
  ]);

  const truncated = logs.length > MAX_LOGS;
  const byDevice = new Map<string, typeof logs>();
  for (const log of logs.slice(0, MAX_LOGS)) {
    const list = byDevice.get(log.deviceId) ?? [];
    list.push(log);
    byDevice.set(log.deviceId, list);
  }

  const result = devices
    .map((device) => {
      const periods = (byDevice.get(device.id) ?? []).map((log) => ({
        status: log.status,
        reason: log.reason,
        startedAt: log.startedAt,
        endedAt: log.endedAt,
        provisional: log.provisional,
      }));
      const totals = { ONLINE: 0, OFFLINE: 0, UNKNOWN: 0 } as Record<string, number>;
      let outages = 0;
      for (const p of periods) {
        const start = Math.max(p.startedAt.getTime(), from.getTime());
        const end = Math.min((p.endedAt ?? to).getTime(), to.getTime());
        if (end > start) totals[p.status] = (totals[p.status] ?? 0) + (end - start);
        if (p.status === 'OFFLINE' && p.startedAt >= from) outages++;
      }
      const observed = totals.ONLINE + totals.OFFLINE;
      return {
        id: device.id,
        agentId: device.agentId,
        kind: device.kind,
        key: device.key,
        name:
          device.kind === 'RECORDING'
            ? `Rekaman ${device.camera?.name || device.key.replace(/^rec:/, '')}`
            : device.camera?.name || device.name,
        location: device.camera?.location ?? null,
        currentStatus: device.currentStatus,
        statusSince: device.statusSince,
        lastCheckedAt: device.lastCheckedAt,
        stats: {
          onlineMs: totals.ONLINE,
          offlineMs: totals.OFFLINE,
          unknownMs: totals.UNKNOWN,
          uptimePct: observed > 0 ? (totals.ONLINE / observed) * 100 : null,
          outages,
        },
        periods,
      };
    })
    .sort(
      (a, b) =>
        (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) ||
        a.name.localeCompare(b.name, 'id')
    );

  return NextResponse.json({
    from,
    to,
    now,
    truncated,
    agents: agents.map((agent) => ({
      ...agent,
      online:
        !agent.lostAt &&
        !!agent.lastSeenAt &&
        now.getTime() - agent.lastSeenAt.getTime() < agent.timeoutSec * 1000,
    })),
    devices: result,
  });
}
