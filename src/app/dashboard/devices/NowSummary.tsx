'use client';

import { CheckCircle2, CircleAlert, CircleOff, Clock3 } from 'lucide-react';
import {
  formatDuration,
  formatWhen,
  reasonText,
  type Agent,
  type Device,
} from './history';

type Problem = {
  key: string;
  name: string;
  what: string;
  since: string | null;
  detail?: string;
  severe: boolean;
};

/** Ringkasan kondisi saat ini dalam kalimat biasa. */
export function NowSummary({
  devices,
  agents,
  nowMs,
}: {
  devices: Device[];
  agents: Agent[];
  nowMs: number;
}) {
  const lostAgent = agents.find((a) => !a.online);
  const problems: Problem[] = [];

  for (const d of devices) {
    if (d.currentStatus !== 'OFFLINE') continue;
    const current = d.periods[d.periods.length - 1];
    problems.push({
      key: d.id,
      name: d.kind === 'RECORDING' ? d.name.replace(/^Rekaman /, '') : d.name,
      what: d.kind === 'RECORDING' ? 'tidak merekam' : 'mati',
      since: d.statusSince,
      detail: current && d.kind !== 'RECORDING' ? reasonText(current) : undefined,
      severe: d.kind !== 'RECORDING',
    });
  }
  // Yang paling lama bermasalah di atas.
  problems.sort((a, b) => (a.since ?? '').localeCompare(b.since ?? ''));

  const watched = devices.filter((d) => d.kind !== 'RECORDING');
  const offline = watched.filter((d) => d.currentStatus === 'OFFLINE').length;
  const notRecording = devices.filter(
    (d) => d.kind === 'RECORDING' && d.currentStatus === 'OFFLINE'
  ).length;

  if (lostAgent) {
    return (
      <section className='card flex items-start gap-4 border-l-4 border-l-slate-400 p-4 sm:p-5'>
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600'>
          <CircleOff className='h-6 w-6' />
        </div>
        <div className='min-w-0'>
          <p className='text-lg font-semibold text-[var(--color-text)]'>
            PC pemantau tidak melapor
            {lostAgent.lastSeenAt && ` sejak ${formatWhen(lostAgent.lastSeenAt, nowMs)}`}
          </p>
          <p className='mt-1 text-sm text-[var(--color-muted)]'>
            {lostAgent.lastSeenAt &&
              `Sudah ${formatDuration(nowMs - new Date(lostAgent.lastSeenAt).getTime())}. `}
            Kemungkinan PC mati (listrik) atau internet putus. Kondisi kamera tidak bisa
            diketahui sampai PC melapor lagi.
          </p>
        </div>
      </section>
    );
  }

  if (problems.length === 0) {
    return (
      <section className='card flex items-center gap-4 border-l-4 border-l-emerald-500 p-4 sm:p-5'>
        <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600'>
          <CheckCircle2 className='h-6 w-6' />
        </div>
        <div>
          <p className='text-lg font-semibold text-[var(--color-text)]'>Semua perangkat normal</p>
          <p className='text-sm text-[var(--color-muted)]'>
            {watched.length} perangkat hidup
            {devices.some((d) => d.kind === 'RECORDING') && ' dan semua kamera merekam'}.
          </p>
        </div>
      </section>
    );
  }

  const parts = [
    offline > 0 && `${offline} dari ${watched.length} perangkat mati`,
    notRecording > 0 && `${notRecording} kamera tidak merekam`,
  ].filter(Boolean);

  return (
    <section
      className={`card border-l-4 p-4 sm:p-5 ${offline > 0 ? 'border-l-red-500' : 'border-l-amber-500'}`}
    >
      <div className='flex items-center gap-4'>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            offline > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          <CircleAlert className='h-6 w-6' />
        </div>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]'>
            Saat ini
          </p>
          <p className='text-lg font-semibold text-[var(--color-text)]'>{parts.join(' · ')}</p>
        </div>
      </div>
      <ul className='mt-4 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]'>
        {problems.map((p) => (
          <li key={p.key} className='flex gap-3 px-3 py-2.5 sm:items-center sm:px-4'>
            <span
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full sm:mt-0 ${p.severe ? 'bg-red-500' : 'bg-amber-500'}`}
            />
            <div className='flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3'>
              <p className='text-sm text-[var(--color-text)]'>
                <strong>{p.name}</strong> {p.what}
                {p.detail && (
                  <span className='block text-xs text-[var(--color-muted)] sm:inline sm:text-sm'>
                    <span className='hidden sm:inline'> · </span>
                    {p.detail}
                  </span>
                )}
              </p>
              {p.since && (
                <p className='inline-flex shrink-0 items-center gap-1.5 text-sm text-[var(--color-text)]'>
                  <Clock3 className='h-4 w-4 text-[var(--color-muted)]' />
                  sejak <strong>{formatWhen(p.since, nowMs)}</strong>
                  <span className='text-[var(--color-muted)]'>
                    ({formatDuration(nowMs - new Date(p.since).getTime())})
                  </span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
