'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle,
  Camera,
  Cpu,
  Loader2,
  RefreshCw,
  Satellite,
} from 'lucide-react';

type Status = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

type Period = {
  status: Status;
  reason: string | null;
  startedAt: string;
  endedAt: string | null;
  provisional: boolean;
};

type Device = {
  id: string;
  kind: 'PC' | 'CAMERA' | 'INTERNET';
  key: string;
  name: string;
  location: string | null;
  currentStatus: Status;
  statusSince: string | null;
  lastCheckedAt: string | null;
  stats: {
    onlineMs: number;
    offlineMs: number;
    unknownMs: number;
    uptimePct: number | null;
    outages: number;
  };
  periods: Period[];
};

type Agent = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  lostAt: string | null;
  online: boolean;
};

type DevicesData = {
  from: string;
  to: string;
  now: string;
  truncated: boolean;
  agents: Agent[];
  devices: Device[];
};

type RangeKey = '24h' | '7d' | '30d' | 'custom';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const PRESETS: { key: Exclude<RangeKey, 'custom'>; label: string; ms: number }[] = [
  { key: '24h', label: '24 jam', ms: DAY_MS },
  { key: '7d', label: '7 hari', ms: 7 * DAY_MS },
  { key: '30d', label: '30 hari', ms: 30 * DAY_MS },
];

const STATUS_LABEL: Record<Status, string> = {
  ONLINE: 'Hidup',
  OFFLINE: 'Mati',
  UNKNOWN: 'Tidak terpantau',
};
const STATUS_BADGE: Record<Status, string> = {
  ONLINE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  OFFLINE: 'bg-red-50 text-red-700 ring-red-200',
  UNKNOWN: 'bg-slate-100 text-slate-600 ring-slate-200',
};
const STATUS_BAR: Record<Status, string> = {
  ONLINE: 'bg-emerald-500',
  OFFLINE: 'bg-red-500',
  UNKNOWN: 'bg-slate-300',
};
const REASON_LABEL: Record<string, string> = {
  BOOT: 'PC menyala',
  POWER_LOSS: 'Mati mendadak (listrik/hang)',
  REBOOT: 'Restart',
  SHUTDOWN: 'Dimatikan normal',
  NO_HEARTBEAT: 'PC tidak melapor',
  PC_OFF: 'PC mati, tidak bisa dicek',
  NO_INTERNET: 'Internet putus',
  ROUTER_DOWN: 'Router tidak terjangkau',
  UNREACHABLE: 'Tidak terjangkau di jaringan',
  LAN_DOWN: 'Jaringan lokal putus',
  RECOVERED: 'Pulih',
};
const KIND_ICON = { PC: Cpu, CAMERA: Camera, INTERNET: Satellite };

const TZ = 'Asia/Jakarta';
const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString('id-ID', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
const formatDuration = (ms: number) => {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return '< 1 menit';
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam ${minutes % 60} menit`;
  return `${Math.floor(hours / 24)} hari ${hours % 24} jam`;
};
// Tanggal (YYYY-MM-DD) dalam WIB untuk input type=date.
const toDateInput = (date: Date) =>
  new Date(date.getTime() + 7 * HOUR_MS).toISOString().slice(0, 10);
const fromDateInput = (value: string, endOfDay: boolean) =>
  new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}+07:00`);

const reasonText = (p: Period) =>
  p.provisional
    ? 'Menunggu laporan PC'
    : (p.reason && REASON_LABEL[p.reason]) || STATUS_LABEL[p.status];

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_BADGE[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_BAR[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function Banner({ children }: { children: ReactNode }) {
  return (
    <div className='flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
      <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
      <span>{children}</span>
    </div>
  );
}

function Timeline({ device, from, to }: { device: Device; from: number; to: number }) {
  const span = to - from;
  return (
    <div className='relative h-6 w-full overflow-hidden rounded-md bg-slate-100'>
      {device.periods.map((p, i) => {
        const start = Math.max(new Date(p.startedAt).getTime(), from);
        const end = Math.min(p.endedAt ? new Date(p.endedAt).getTime() : to, to);
        if (end <= start) return null;
        return (
          <div
            key={i}
            title={`${STATUS_LABEL[p.status]} · ${reasonText(p)}\n${formatDateTime(p.startedAt)} – ${
              p.endedAt ? formatDateTime(p.endedAt) : 'sekarang'
            } (${formatDuration(end - start)})`}
            className={`absolute inset-y-0 ${STATUS_BAR[p.status]} ${p.provisional ? 'opacity-50' : ''}`}
            style={{
              left: `${((start - from) / span) * 100}%`,
              // Minimal 2px agar gangguan singkat tetap terlihat.
              width: `max(2px, ${((end - start) / span) * 100}%)`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function DevicesPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'ADMINISTRATOR';
  const [range, setRange] = useState<RangeKey>('24h');
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date(Date.now() - 7 * DAY_MS)));
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()));
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);
  const [limit, setLimit] = useState(50);

  const query = useMemo(() => {
    if (range === 'custom') {
      return `from=${fromDateInput(customFrom, false).toISOString()}&to=${fromDateInput(customTo, true).toISOString()}`;
    }
    const preset = PRESETS.find((p) => p.key === range)!;
    return `span=${preset.ms}`;
  }, [range, customFrom, customTo]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['monitoring-devices', query],
    queryFn: async () => {
      let qs = query;
      if (qs.startsWith('span=')) {
        const span = Number(qs.slice(5));
        qs = `from=${new Date(Date.now() - span).toISOString()}`;
      }
      const response = await fetch(`/api/monitoring/devices?${qs}`);
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? 'Gagal memuat riwayat perangkat');
      return body as DevicesData;
    },
    enabled: isAdmin,
    refetchInterval: range === 'custom' ? false : 30_000,
  });

  const events = useMemo(() => {
    if (!data) return [];
    const rows = data.devices
      .filter((d) => deviceFilter === 'all' || d.id === deviceFilter)
      .flatMap((d) => d.periods.map((p) => ({ device: d, period: p })))
      .filter(({ period }) => showAll || period.status !== 'ONLINE');
    rows.sort(
      (a, b) =>
        new Date(b.period.startedAt).getTime() - new Date(a.period.startedAt).getTime()
    );
    return rows;
  }, [data, deviceFilter, showAll]);

  if (status === 'loading' || (isAdmin && isLoading)) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-[var(--color-primary)]' />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <p className='py-12 text-center text-red-600'>Halaman ini khusus ADMINISTRATOR.</p>
    );
  }

  const from = data ? new Date(data.from).getTime() : 0;
  const to = data ? new Date(data.to).getTime() : 0;
  const now = data ? new Date(data.now).getTime() : 0;
  const lostAgents = data?.agents.filter((a) => !a.online) ?? [];

  return (
    <div className='mx-auto max-w-6xl space-y-6'>
      <header className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-[var(--color-text)]'>Riwayat Perangkat</h1>
          <p className='mt-1 text-sm text-[var(--color-muted)]'>
            Catatan hidup/mati PC, Starlink, dan kamera. Diperbarui tiap 30 detik.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <div className='inline-flex rounded-xl border border-[var(--color-border)] bg-white p-1'>
            {[...PRESETS, { key: 'custom' as const, label: 'Tanggal' }].map((p) => (
              <button
                key={p.key}
                type='button'
                onClick={() => {
                  setRange(p.key);
                  setLimit(50);
                }}
                className={`h-9 rounded-lg px-3 text-sm font-semibold transition ${
                  range === p.key
                    ? 'bg-[var(--color-primary-strong)] !text-white'
                    : 'text-[var(--color-text)] hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type='button'
            onClick={() => refetch()}
            aria-label='Muat ulang'
            className='inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-slate-50'
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {range === 'custom' && (
        <div className='card flex flex-wrap items-end gap-3 p-4'>
          <label className='space-y-1 text-sm'>
            <span className='block font-medium'>Dari</span>
            <input
              type='date'
              value={customFrom}
              max={customTo}
              onChange={(e) => e.target.value && setCustomFrom(e.target.value)}
              className='h-11 rounded-xl border border-[var(--color-border)] px-3 text-base sm:text-sm'
            />
          </label>
          <label className='space-y-1 text-sm'>
            <span className='block font-medium'>Sampai</span>
            <input
              type='date'
              value={customTo}
              min={customFrom}
              max={toDateInput(new Date())}
              onChange={(e) => e.target.value && setCustomTo(e.target.value)}
              className='h-11 rounded-xl border border-[var(--color-border)] px-3 text-base sm:text-sm'
            />
          </label>
          <p className='text-xs text-[var(--color-muted)]'>Maksimal 92 hari.</p>
        </div>
      )}

      {error && (
        <p className='rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
          {(error as Error).message}
        </p>
      )}

      {data && data.agents.length === 0 && (
        <Banner>Belum ada agent pemantau yang terdaftar.</Banner>
      )}
      {lostAgents.map((agent) => (
        <Banner key={agent.id}>
          <strong>{agent.name}</strong> tidak melapor
          {agent.lastSeenAt
            ? ` sejak ${formatDateTime(agent.lastSeenAt)} (${formatDuration(now - new Date(agent.lastSeenAt).getTime())} lalu)`
            : ''}
          . PC mungkin mati atau internet putus; status kamera tidak terpantau sampai PC
          melapor lagi.
        </Banner>
      ))}
      {data?.truncated && (
        <Banner>Data terlalu banyak untuk rentang ini; pilih rentang yang lebih pendek.</Banner>
      )}

      {data && (
        <>
          <section className='grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3'>
            {data.devices.map((d) => {
              const Icon = KIND_ICON[d.kind] ?? Camera;
              const selected = deviceFilter === d.id;
              return (
                <button
                  key={d.id}
                  type='button'
                  onClick={() => setDeviceFilter(selected ? 'all' : d.id)}
                  className={`card flex flex-col gap-2 p-3 text-left sm:gap-3 sm:p-4 transition hover:shadow-md ${
                    selected ? 'ring-2 ring-[var(--color-primary-strong)]' : ''
                  }`}
                >
                  <div className='flex items-start gap-3'>
                    <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]'>
                      <Icon className='h-5 w-5' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <p className='truncate font-semibold text-[var(--color-text)]'>{d.name}</p>
                      <p className='truncate text-xs text-[var(--color-muted)]'>
                        {d.kind === 'CAMERA' ? d.key : d.kind === 'PC' ? 'PC lokal' : 'Internet'}
                      </p>
                    </div>
                    <StatusBadge status={d.currentStatus} />
                  </div>
                  <p className='text-xs text-[var(--color-muted)]'>
                    {d.statusSince
                      ? `Sejak ${formatDateTime(d.statusSince)} · ${formatDuration(now - new Date(d.statusSince).getTime())}`
                      : 'Belum ada data'}
                  </p>
                  <div className='flex items-center justify-between text-xs'>
                    <span className='text-[var(--color-muted)]'>
                      Hidup{' '}
                      <strong className='text-[var(--color-text)]'>
                        {d.stats.uptimePct === null ? '–' : `${d.stats.uptimePct.toFixed(1)}%`}
                      </strong>
                    </span>
                    <span className='text-[var(--color-muted)]'>
                      Mati{' '}
                      <strong className='text-[var(--color-text)]'>{d.stats.outages}×</strong>
                      {d.stats.offlineMs > 0 && ` · ${formatDuration(d.stats.offlineMs)}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </section>

          <section className='card space-y-3 p-4 sm:p-5'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <h2 className='font-semibold text-[var(--color-text)]'>Linimasa</h2>
              <div className='flex flex-wrap gap-3 text-xs text-[var(--color-muted)]'>
                {(['ONLINE', 'OFFLINE', 'UNKNOWN'] as Status[]).map((s) => (
                  <span key={s} className='inline-flex items-center gap-1.5'>
                    <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_BAR[s]}`} />
                    {STATUS_LABEL[s]}
                  </span>
                ))}
              </div>
            </div>
            <div className='space-y-2.5'>
              {data.devices.map((d) => (
                <div key={d.id} className='grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-3'>
                  <p className='truncate text-xs font-medium text-[var(--color-text)]'>{d.name}</p>
                  <Timeline device={d} from={from} to={to} />
                </div>
              ))}
            </div>
            <div className='flex justify-between text-xs text-[var(--color-muted)] sm:pl-[10.75rem]'>
              <span>{formatDateTime(data.from)}</span>
              <span>{formatDateTime(data.to)}</span>
            </div>
          </section>

          <section className='card p-4 sm:p-5'>
            <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
              <h2 className='font-semibold text-[var(--color-text)]'>
                {showAll ? 'Semua perubahan status' : 'Daftar gangguan'}
              </h2>
              <div className='flex flex-wrap items-center gap-2'>
                <select
                  value={deviceFilter}
                  onChange={(e) => setDeviceFilter(e.target.value)}
                  className='h-11 rounded-xl border border-[var(--color-border)] bg-white px-3 text-base sm:text-sm'
                >
                  <option value='all'>Semua perangkat</option>
                  {data.devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <label className='inline-flex h-11 items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    checked={showAll}
                    onChange={(e) => setShowAll(e.target.checked)}
                    className='h-4 w-4'
                  />
                  Tampilkan saat hidup
                </label>
              </div>
            </div>

            {events.length === 0 ? (
              <p className='py-8 text-center text-sm text-[var(--color-muted)]'>
                Tidak ada gangguan pada rentang ini.
              </p>
            ) : (
              <ul className='divide-y divide-[var(--color-border)]'>
                {events.slice(0, limit).map(({ device, period }, i) => {
                  const start = new Date(period.startedAt).getTime();
                  const end = period.endedAt ? new Date(period.endedAt).getTime() : now;
                  return (
                    <li
                      key={`${device.id}-${period.startedAt}-${i}`}
                      className='grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-3 sm:grid-cols-[1fr_9rem_14rem_8rem] sm:items-center sm:gap-4'
                    >
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-[var(--color-text)]'>
                          {device.name}
                        </p>
                        <p className='text-xs text-[var(--color-muted)]'>{reasonText(period)}</p>
                      </div>
                      <div className='justify-self-end sm:justify-self-start'>
                        <StatusBadge status={period.status} />
                      </div>
                      <p className='text-xs text-[var(--color-text)]'>
                        {formatDateTime(period.startedAt)} –{' '}
                        {period.endedAt ? formatDateTime(period.endedAt) : 'sekarang'}
                      </p>
                      <p className='text-right text-xs font-medium text-[var(--color-text)]'>
                        {formatDuration(end - start)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {events.length > limit && (
              <button
                type='button'
                onClick={() => setLimit((l) => l + 50)}
                className='mt-3 h-11 w-full rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text)] hover:bg-slate-50'
              >
                Tampilkan lebih banyak ({events.length - limit} lagi)
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
