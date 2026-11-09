'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { AlertTriangle, Camera, Cpu, Loader2, RefreshCw, Satellite, Video } from 'lucide-react';
import { TelegramSettings } from './TelegramSettings';
import { NowSummary } from './NowSummary';
import { DeviceTimeline } from './DeviceTimeline';
import { IncidentList } from './IncidentList';
import {
  DAY_MS,
  HOUR_MS,
  formatDuration,
  formatWhen,
  statusLabel,
  withRecordingNames,
  type DevicesData,
  type Status,
} from './history';

type RangeKey = '24h' | '7d' | '30d' | 'custom';

const PRESETS: { key: Exclude<RangeKey, 'custom'>; label: string; ms: number }[] = [
  { key: '24h', label: '24 jam', ms: DAY_MS },
  { key: '7d', label: '7 hari', ms: 7 * DAY_MS },
  { key: '30d', label: '30 hari', ms: 30 * DAY_MS },
];

const STATUS_BADGE: Record<Status, string> = {
  ONLINE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  OFFLINE: 'bg-red-50 text-red-700 ring-red-200',
  UNKNOWN: 'bg-slate-100 text-slate-600 ring-slate-200',
};
const STATUS_DOT: Record<Status, string> = {
  ONLINE: 'bg-emerald-500',
  OFFLINE: 'bg-red-500',
  UNKNOWN: 'bg-slate-300',
};
const KIND_ICON = { PC: Cpu, CAMERA: Camera, INTERNET: Satellite, RECORDING: Video };

// Tanggal (YYYY-MM-DD) dalam WIB untuk input type=date.
const toDateInput = (date: Date) =>
  new Date(date.getTime() + 7 * HOUR_MS).toISOString().slice(0, 10);
const fromDateInput = (value: string, endOfDay: boolean) =>
  new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}+07:00`);

function StatusBadge({ status, label }: { status: Status; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_BADGE[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {label}
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

export default function DevicesPage() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'ADMINISTRATOR';
  const [range, setRange] = useState<RangeKey>('24h');
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date(Date.now() - 7 * DAY_MS)));
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()));
  const [deviceFilter, setDeviceFilter] = useState<string>('all');

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
      const result = body as DevicesData;
      return { ...result, devices: withRecordingNames(result.devices) };
    },
    enabled: isAdmin,
    refetchInterval: range === 'custom' ? false : 30_000,
  });

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
  // Rekaman Shinobi ditampilkan menempel pada kartu & linimasa kameranya.
  const mainDevices = data?.devices.filter((d) => d.kind !== 'RECORDING') ?? [];
  const recordingOf = new Map(
    (data?.devices ?? [])
      .filter((d) => d.kind === 'RECORDING')
      .map((d) => [d.key.replace(/^rec:/, ''), d] as const)
  );

  return (
    <div className='mx-auto max-w-6xl space-y-6'>
      <header className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold text-[var(--color-text)]'>Riwayat Perangkat</h1>
          <p className='mt-1 text-sm text-[var(--color-muted)]'>
            Catatan hidup/mati PC, Starlink, kamera, dan rekaman. Diperbarui tiap 30 detik.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <div className='inline-flex rounded-xl border border-[var(--color-border)] bg-white p-1'>
            {[...PRESETS, { key: 'custom' as const, label: 'Tanggal' }].map((p) => (
              <button
                key={p.key}
                type='button'
                onClick={() => setRange(p.key)}
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
      {data?.truncated && (
        <Banner>Data terlalu banyak untuk rentang ini; pilih rentang yang lebih pendek.</Banner>
      )}

      {data && (
        <>
          <NowSummary devices={data.devices} agents={data.agents} nowMs={now} />

          <section className='grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3'>
            {mainDevices.map((d) => {
              const Icon = KIND_ICON[d.kind] ?? Camera;
              const rec = d.kind === 'CAMERA' ? recordingOf.get(d.key) : undefined;
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
                    <StatusBadge status={d.currentStatus} label={statusLabel(d.kind, d.currentStatus)} />
                  </div>
                  <p className='text-xs text-[var(--color-muted)]'>
                    {d.statusSince ? (
                      <>
                        {statusLabel(d.kind, d.currentStatus)} sejak{' '}
                        <strong className='text-[var(--color-text)]'>
                          {formatWhen(d.statusSince, now)}
                        </strong>{' '}
                        · {formatDuration(now - new Date(d.statusSince).getTime())}
                      </>
                    ) : (
                      'Belum ada data'
                    )}
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
                  {rec && (
                    <div className='flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-xs'>
                      <span className='inline-flex items-center gap-1.5 text-[var(--color-muted)]'>
                        <Video className='h-3.5 w-3.5' /> Rekaman
                        {rec.stats.uptimePct !== null && (
                          <strong className='text-[var(--color-text)]'>
                            {rec.stats.uptimePct.toFixed(1)}%
                          </strong>
                        )}
                      </span>
                      <StatusBadge
                        status={rec.currentStatus}
                        label={statusLabel('RECORDING', rec.currentStatus)}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </section>

          <DeviceTimeline
            devices={mainDevices}
            recordingOf={recordingOf}
            from={from}
            to={to}
            nowMs={now}
          />

          <IncidentList
            devices={data.devices}
            deviceFilter={deviceFilter}
            onDeviceFilter={setDeviceFilter}
            nowMs={now}
          />
          <TelegramSettings />
        </>
      )}
    </div>
  );
}
