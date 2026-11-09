'use client';

import { useState, type MouseEvent } from 'react';
import { MousePointerClick, X } from 'lucide-react';
import {
  formatClockSec,
  formatDuration,
  formatShortDate,
  pickPeriod,
  reasonText,
  statusLabel,
  timelineTicks,
  type Device,
  type Status,
} from './history';

const BAR: Record<Status, string> = {
  ONLINE: 'bg-emerald-500',
  OFFLINE: 'bg-red-500',
  UNKNOWN: 'bg-slate-300',
};
const REC_BAR: Record<Status, string> = {
  ONLINE: 'bg-sky-500',
  OFFLINE: 'bg-amber-500',
  UNKNOWN: 'bg-slate-300',
};

type Selection = { deviceId: string; index: number };

function Bar({
  device,
  from,
  to,
  nowMs,
  thin,
  selected,
  onPick,
}: {
  device: Device;
  from: number;
  to: number;
  nowMs: number;
  thin?: boolean;
  selected: number | null;
  onPick: (index: number | null) => void;
}) {
  const span = to - from;
  const colors = device.kind === 'RECORDING' ? REC_BAR : BAR;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const at = from + ((event.clientX - rect.left) / rect.width) * span;
    // Toleransi ±12px agar gangguan singkat (bar tipis) tetap mudah diketuk.
    onPick(pickPeriod(device, at, (12 / rect.width) * span, nowMs));
  };

  return (
    <div
      role='button'
      tabIndex={0}
      aria-label={`Linimasa ${device.name}`}
      onClick={handleClick}
      className={`relative w-full cursor-pointer overflow-hidden bg-slate-100 ${
        thin ? 'h-2.5 rounded-sm' : 'h-7 rounded-md'
      }`}
    >
      {device.periods.map((p, i) => {
        const start = Math.max(new Date(p.startedAt).getTime(), from);
        const end = Math.min(p.endedAt ? new Date(p.endedAt).getTime() : to, to);
        if (end <= start) return null;
        return (
          <div
            key={i}
            title={`${statusLabel(device.kind, p.status)} · ${formatClockSec(p.startedAt)} – ${
              p.endedAt ? formatClockSec(p.endedAt) : 'sekarang'
            }`}
            className={`absolute inset-y-0 ${colors[p.status]} ${p.provisional ? 'opacity-50' : ''} ${
              selected === i ? 'z-10 ring-2 ring-slate-900 ring-offset-1' : ''
            }`}
            style={{
              left: `${((start - from) / span) * 100}%`,
              // Minimal 3px agar gangguan singkat tetap terlihat.
              width: `max(3px, ${((end - start) / span) * 100}%)`,
            }}
          />
        );
      })}
    </div>
  );
}

function Detail({
  device,
  index,
  nowMs,
  onClose,
}: {
  device: Device;
  index: number;
  nowMs: number;
  onClose: () => void;
}) {
  const p = device.periods[index];
  const start = new Date(p.startedAt).getTime();
  const end = p.endedAt ? new Date(p.endedAt).getTime() : nowMs;
  const bad = p.status === 'OFFLINE';
  const label = statusLabel(device.kind, p.status);
  return (
    <div
      className={`relative rounded-xl border p-4 pr-12 ${
        bad ? 'border-red-200 bg-red-50' : 'border-[var(--color-border)] bg-slate-50'
      }`}
    >
      <button
        type='button'
        onClick={onClose}
        aria-label='Tutup rincian'
        className='absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-white'
      >
        <X className='h-4 w-4' />
      </button>
      <p className='text-sm font-semibold text-[var(--color-text)]'>
        {device.name} · <span className={bad ? 'text-red-700' : ''}>{label}</span>
      </p>
      <dl className='mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4'>
        <div>
          <dt className='text-xs text-[var(--color-muted)]'>{bad ? 'Mulai mati' : 'Mulai'}</dt>
          <dd className='font-semibold text-[var(--color-text)]'>
            {formatClockSec(start)}
            <span className='block text-xs font-normal text-[var(--color-muted)]'>
              {formatShortDate(start)}
            </span>
          </dd>
        </div>
        <div>
          <dt className='text-xs text-[var(--color-muted)]'>{bad ? 'Hidup lagi' : 'Sampai'}</dt>
          <dd className='font-semibold text-[var(--color-text)]'>
            {p.endedAt ? (
              <>
                {formatClockSec(end)}
                <span className='block text-xs font-normal text-[var(--color-muted)]'>
                  {formatShortDate(end)}
                </span>
              </>
            ) : (
              <span className={bad ? 'text-red-700' : ''}>
                {bad ? 'Belum hidup' : 'Sekarang'}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className='text-xs text-[var(--color-muted)]'>Lama</dt>
          <dd className='font-semibold text-[var(--color-text)]'>
            {formatDuration(end - start)}
            {!p.endedAt && (
              <span className='block text-xs font-normal text-[var(--color-muted)]'>
                masih berlangsung
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className='text-xs text-[var(--color-muted)]'>Keterangan</dt>
          <dd className='text-[var(--color-text)]'>{reasonText(p)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** Linimasa semua perangkat dengan penanda jam; ketuk bar untuk melihat rincian. */
export function DeviceTimeline({
  devices,
  recordingOf,
  from,
  to,
  nowMs,
}: {
  devices: Device[];
  recordingOf: Map<string, Device>;
  from: number;
  to: number;
  nowMs: number;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const span = to - from;
  const ticks = timelineTicks(from, to);
  const all = [...devices, ...recordingOf.values()];
  const selectedDevice = selection && all.find((d) => d.id === selection.deviceId);
  const pick = (device: Device) => (index: number | null) =>
    setSelection(index === null ? null : { deviceId: device.id, index });
  const selectedIndex = (device: Device) =>
    selection?.deviceId === device.id ? selection.index : null;

  const grid = (
    <div className='pointer-events-none absolute inset-0 z-20'>
      {ticks.map((t) => (
        <div
          key={t.at}
          className={`absolute inset-y-0 border-l ${
            t.major ? 'border-slate-900/40' : 'border-dashed border-slate-900/15'
          }`}
          style={{ left: `${((t.at - from) / span) * 100}%` }}
        />
      ))}
    </div>
  );

  return (
    <section className='card space-y-4 p-4 sm:p-5'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='font-semibold text-[var(--color-text)]'>Linimasa</h2>
          <p className='mt-0.5 inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]'>
            <MousePointerClick className='h-3.5 w-3.5' />
            Ketuk bagian berwarna untuk melihat jam mulai &amp; selesainya.
          </p>
        </div>
        <div className='flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--color-muted)]'>
          <Legend className='bg-emerald-500' label='Hidup' />
          <Legend className='bg-red-500' label='Mati' />
          <Legend className='bg-slate-300' label='Tidak terpantau' />
          {recordingOf.size > 0 && (
            <>
              <Legend className='bg-sky-500' label='Merekam' thin />
              <Legend className='bg-amber-500' label='Tidak merekam' thin />
            </>
          )}
        </div>
      </div>

      <div className='grid gap-x-3 sm:grid-cols-[9.5rem_1fr]'>
        <div className='hidden sm:block' />
        <div className='relative h-5 text-[11px] text-[var(--color-muted)]'>
          {ticks.map((t) => {
            const left = ((t.at - from) / span) * 100;
            return (
              <span
                key={t.at}
                className={`absolute -translate-x-1/2 whitespace-nowrap ${
                  t.major ? 'font-semibold text-[var(--color-text)]' : ''
                } ${left > 96 || left < 3 ? 'hidden' : ''}`}
                style={{ left: `${left}%` }}
              >
                {t.label}
              </span>
            );
          })}
        </div>

        {devices.map((d) => {
          const rec = d.kind === 'CAMERA' ? recordingOf.get(d.key) : undefined;
          return (
            <div key={d.id} className='contents'>
              <p className='mt-3 truncate text-xs font-medium text-[var(--color-text)] sm:mt-0 sm:self-center sm:py-2'>
                {d.name}
              </p>
              <div className='relative space-y-1 sm:py-2'>
                <Bar
                  device={d}
                  from={from}
                  to={to}
                  nowMs={nowMs}
                  selected={selectedIndex(d)}
                  onPick={pick(d)}
                />
                {rec && (
                  <Bar
                    device={rec}
                    from={from}
                    to={to}
                    nowMs={nowMs}
                    thin
                    selected={selectedIndex(rec)}
                    onPick={pick(rec)}
                  />
                )}
                {grid}
              </div>
            </div>
          );
        })}
      </div>

      {selection && selectedDevice && selectedDevice.periods[selection.index] && (
        <Detail
          device={selectedDevice}
          index={selection.index}
          nowMs={nowMs}
          onClose={() => setSelection(null)}
        />
      )}
    </section>
  );
}

function Legend({ className, label, thin }: { className: string; label: string; thin?: boolean }) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span className={`w-3 rounded-sm ${thin ? 'h-1.5' : 'h-3'} ${className}`} />
      {label}
    </span>
  );
}
