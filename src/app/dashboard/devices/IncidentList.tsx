'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Camera, Cpu, Satellite, Video } from 'lucide-react';
import {
  buildIncidents,
  formatClock,
  formatDayHeading,
  formatDuration,
  formatShortDate,
  groupByDay,
  MINUTE_MS,
  reasonText,
  dayKey,
  type Device,
  type Incident,
  type Outage,
} from './history';

const KIND_ICON = { PC: Cpu, CAMERA: Camera, INTERNET: Satellite, RECORDING: Video };
const SHORT_LIMIT_MIN = 5;
const PAGE_SIZE = 30;

/** Jam selesai; tanggal ikut ditampilkan bila beda hari dengan mulainya. */
function endText(start: number, end: number) {
  return dayKey(start) === dayKey(end) ? formatClock(end) : `${formatShortDate(end)} ${formatClock(end)}`;
}

function OutageRow({ outage, nowMs }: { outage: Outage; nowMs: number }) {
  const { device, period, start, end } = outage;
  const Icon = KIND_ICON[device.kind] ?? Camera;
  const ongoing = end === null;
  const recording = device.kind === 'RECORDING';
  const name = recording ? device.name.replace(/^Rekaman /, '') : device.name;
  return (
    <li className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center'>
      <Icon className='mt-0.5 h-4 w-4 text-[var(--color-muted)] sm:mt-0' />
      <div className='min-w-0'>
        <p className='text-sm font-medium text-[var(--color-text)]'>
          {name}
          {recording && <span className='font-normal text-[var(--color-muted)]'> · rekaman</span>}
        </p>
        <p className='text-xs text-[var(--color-muted)]'>{reasonText(period)}</p>
      </div>
      <div className='col-start-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:col-start-3 sm:justify-end'>
        <span className='font-semibold tabular-nums text-[var(--color-text)]'>{formatClock(start)}</span>
        <ArrowRight className='h-3.5 w-3.5 text-[var(--color-muted)]' />
        {ongoing ? (
          <span className='font-semibold text-red-700'>belum {recording ? 'merekam' : 'hidup'}</span>
        ) : (
          <span className='font-semibold tabular-nums text-emerald-700'>{endText(start, end)}</span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            ongoing ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {formatDuration((end ?? nowMs) - start)}
        </span>
      </div>
    </li>
  );
}

function IncidentCard({ incident, nowMs }: { incident: Incident; nowMs: number }) {
  const ongoing = incident.end === null;
  const severe = incident.outages.some((o) => o.device.kind !== 'RECORDING');
  const tone = ongoing ? 'bg-red-500' : severe ? 'bg-orange-400' : 'bg-amber-400';
  const many = incident.outages.length > 1;
  return (
    <li className='relative grid grid-cols-[3.5rem_1fr] gap-3 sm:grid-cols-[4.5rem_1fr] sm:gap-4'>
      <div className='pt-3 text-right'>
        <p className='text-base font-bold tabular-nums text-[var(--color-text)] sm:text-lg'>
          {formatClock(incident.start)}
        </p>
      </div>
      <div className='relative rounded-xl border border-[var(--color-border)] bg-white p-3 sm:p-4'>
        <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${tone}`} />
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1 pl-2'>
          <p className='font-semibold text-[var(--color-text)]'>{incident.title}</p>
          {ongoing ? (
            <span className='rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200'>
              Masih berlangsung
            </span>
          ) : (
            many && (
              <span className='text-xs text-[var(--color-muted)]'>
                semua pulih {endText(incident.start, incident.end as number)}
              </span>
            )
          )}
        </div>
        <ul className='mt-1 divide-y divide-[var(--color-border)] pl-2'>
          {incident.outages.map((o) => (
            <OutageRow key={`${o.device.id}-${o.start}`} outage={o} nowMs={nowMs} />
          ))}
        </ul>
      </div>
    </li>
  );
}

/** Daftar kejadian per hari: jam mulai mati, jam hidup lagi, lama, keterangan. */
export function IncidentList({
  devices,
  deviceFilter,
  onDeviceFilter,
  nowMs,
}: {
  devices: Device[];
  deviceFilter: string;
  onDeviceFilter: (id: string) => void;
  nowMs: number;
}) {
  const [showShort, setShowShort] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const deviceId = deviceFilter === 'all' ? undefined : deviceFilter;
  const incidents = useMemo(
    () => buildIncidents(devices, { minMs: showShort ? 0 : SHORT_LIMIT_MIN * MINUTE_MS, deviceId }),
    [devices, showShort, deviceId]
  );
  // Jumlah gangguan singkat (sudah selesai, < batas) yang disembunyikan.
  const hiddenShort = useMemo(() => {
    if (showShort) return 0;
    let count = 0;
    for (const d of devices) {
      if (deviceId && d.id !== deviceId) continue;
      for (const p of d.periods) {
        if (p.status !== 'OFFLINE' || !p.endedAt || d.kind === 'PC') continue;
        const ms = new Date(p.endedAt).getTime() - new Date(p.startedAt).getTime();
        if (ms < SHORT_LIMIT_MIN * MINUTE_MS) count++;
      }
    }
    return count;
  }, [devices, showShort, deviceId]);
  const days = groupByDay(incidents.slice(0, limit));
  const selectedName = devices.find((d) => d.id === deviceFilter)?.name;

  return (
    <section className='card p-4 sm:p-5'>
      <div className='mb-4 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='font-semibold text-[var(--color-text)]'>Daftar kejadian</h2>
          <p className='mt-0.5 text-xs text-[var(--color-muted)]'>
            Perangkat yang mati hampir bersamaan digabung jadi satu kejadian.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <select
            value={deviceFilter}
            onChange={(e) => {
              onDeviceFilter(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            aria-label='Pilih perangkat'
            className='h-11 rounded-xl border border-[var(--color-border)] bg-white px-3 text-base sm:text-sm'
          >
            <option value='all'>Semua perangkat</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <label className='inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 text-sm'>
            <input
              type='checkbox'
              checked={showShort}
              onChange={(e) => setShowShort(e.target.checked)}
              className='h-4 w-4'
            />
            Tampilkan gangguan &lt; {SHORT_LIMIT_MIN} menit
          </label>
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className='rounded-xl bg-emerald-50 px-4 py-8 text-center'>
          <p className='font-semibold text-emerald-800'>
            Tidak ada gangguan{selectedName ? ` pada ${selectedName}` : ''} di rentang waktu ini 🎉
          </p>
          {hiddenShort > 0 && (
            <p className='mt-1 text-sm text-emerald-700'>
              Ada {hiddenShort} gangguan singkat (&lt; {SHORT_LIMIT_MIN} menit) yang disembunyikan.
            </p>
          )}
        </div>
      ) : (
        <div className='space-y-6'>
          {days.map((day) => (
            <div key={day.key}>
              <h3 className='mb-3 flex items-center justify-between border-b border-[var(--color-border)] pb-2 text-sm font-semibold text-[var(--color-text)]'>
                <span>{formatDayHeading(day.key, nowMs)}</span>
                <span className='text-xs font-normal text-[var(--color-muted)]'>
                  {day.incidents.length} kejadian
                </span>
              </h3>
              <ul className='space-y-3'>
                {day.incidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} nowMs={nowMs} />
                ))}
              </ul>
            </div>
          ))}
          {hiddenShort > 0 && (
            <p className='text-center text-xs text-[var(--color-muted)]'>
              {hiddenShort} gangguan singkat (&lt; {SHORT_LIMIT_MIN} menit) disembunyikan.{' '}
              <button
                type='button'
                onClick={() => setShowShort(true)}
                className='font-semibold text-[var(--color-primary-strong)] underline'
              >
                Tampilkan
              </button>
            </p>
          )}
        </div>
      )}
      {incidents.length > limit && (
        <button
          type='button'
          onClick={() => setLimit((l) => l + PAGE_SIZE)}
          className='mt-4 h-11 w-full rounded-xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text)] hover:bg-slate-50'
        >
          Tampilkan lebih banyak ({incidents.length - limit} kejadian lagi)
        </button>
      )}
    </section>
  );
}
