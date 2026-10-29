'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Move,
  Navigation,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCCTVPtzPresets } from '@/hooks/use-cctv';

interface PtzControlsProps {
  cameraId: string;
}

type Vector = { pan: number; tilt: number; zoom: number };

// Server menghentikan kamera sendiri bila tidak ada "move" baru dalam 1,5 s.
const MOVE_REFRESH_MS = 400;

const SPEEDS = {
  slow: 30,
  normal: 60,
  fast: 100,
} as const;

type Speed = keyof typeof SPEEDS;

export function PtzControls({ cameraId }: PtzControlsProps) {
  const [speed, setSpeed] = useState<Speed>('normal');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [presetId, setPresetId] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const movingRef = useRef(false);
  const { data: presets, isLoading: presetsLoading } = useCCTVPtzPresets(
    cameraId,
    true
  );

  const send = useCallback(
    async (body: object, keepalive = false) => {
      const response = await fetch(`/api/cctv/${cameraId}/ptz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? 'Perintah PTZ gagal');
      }
    },
    [cameraId]
  );

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setActiveKey(null);
    if (!movingRef.current) return;
    movingRef.current = false;
    // keepalive agar stop tetap terkirim walau halaman sedang ditutup.
    send({ action: 'stop' }, true).catch((err: Error) => setError(err.message));
  }, [send]);

  const start = (key: string, vector: Vector) => {
    stop();
    setError('');
    setActiveKey(key);
    movingRef.current = true;
    const move = () =>
      send({ action: 'move', ...vector }).catch((err: Error) => {
        setError(err.message);
        stop();
      });
    void move();
    intervalRef.current = setInterval(move, MOVE_REFRESH_MS);
  };

  // Hentikan gerakan bila tab disembunyikan, jendela kehilangan fokus, atau komponen dilepas.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    window.addEventListener('blur', stop);
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', stop);
      window.removeEventListener('pagehide', stop);
      document.removeEventListener('visibilitychange', handleVisibility);
      stop();
    };
  }, [stop]);

  const goToPreset = async () => {
    if (!presetId) return;
    setError('');
    try {
      await send({ action: 'goto', presetId: Number(presetId) });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const s = SPEEDS[speed];
  const holdButton = (
    key: string,
    vector: Vector,
    label: string,
    icon: React.ReactNode
  ) => (
    <button
      type='button'
      aria-label={label}
      title={label}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        start(key, vector);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(event) => event.preventDefault()}
      className={`h-12 w-12 flex items-center justify-center rounded-xl border transition-colors select-none touch-none ${
        activeKey === key
          ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className='card p-5 space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='font-semibold text-[var(--color-text)] flex items-center gap-2'>
          <Move className='h-4 w-4 text-[var(--color-primary)]' />
          Kontrol PTZ
        </h3>
        <select
          value={speed}
          onChange={(event) => setSpeed(event.target.value as Speed)}
          className='px-2 py-1.5 border border-[var(--color-border)] bg-white text-[var(--color-text)] rounded-[var(--radius-md)] text-sm'
          aria-label='Kecepatan PTZ'
        >
          <option value='slow'>Lambat</option>
          <option value='normal'>Sedang</option>
          <option value='fast'>Cepat</option>
        </select>
      </div>

      <div className='flex flex-col sm:flex-row items-center gap-6'>
        <div className='grid grid-cols-3 gap-2'>
          <span />
          {holdButton('up', { pan: 0, tilt: s, zoom: 0 }, 'Atas', <ArrowUp className='h-5 w-5' />)}
          <span />
          {holdButton('left', { pan: -s, tilt: 0, zoom: 0 }, 'Kiri', <ArrowLeft className='h-5 w-5' />)}
          <span className='h-12 w-12 flex items-center justify-center text-xs text-[var(--color-muted)]'>
            tahan
          </span>
          {holdButton('right', { pan: s, tilt: 0, zoom: 0 }, 'Kanan', <ArrowRight className='h-5 w-5' />)}
          <span />
          {holdButton('down', { pan: 0, tilt: -s, zoom: 0 }, 'Bawah', <ArrowDown className='h-5 w-5' />)}
          <span />
        </div>

        <div className='flex sm:flex-col gap-2'>
          {holdButton('zoom-in', { pan: 0, tilt: 0, zoom: s }, 'Zoom in', <ZoomIn className='h-5 w-5' />)}
          {holdButton('zoom-out', { pan: 0, tilt: 0, zoom: -s }, 'Zoom out', <ZoomOut className='h-5 w-5' />)}
        </div>

        <div className='flex-1 w-full space-y-2'>
          <p className='text-xs text-[var(--color-muted)]'>Preset</p>
          {presetsLoading ? (
            <p className='text-sm text-[var(--color-muted)]'>Memuat preset...</p>
          ) : presets && presets.length > 0 ? (
            <div className='flex gap-2'>
              <select
                value={presetId}
                onChange={(event) => setPresetId(event.target.value)}
                className='flex-1 px-2 py-2 border border-[var(--color-border)] bg-white text-[var(--color-text)] rounded-[var(--radius-md)] text-sm'
              >
                <option value=''>Pilih preset</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <button
                type='button'
                onClick={goToPreset}
                disabled={!presetId}
                className='inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-gray-50 disabled:opacity-50'
              >
                <Navigation className='h-4 w-4' />
                Ke preset
              </button>
            </div>
          ) : (
            <p className='text-sm text-[var(--color-muted)]'>
              Belum ada preset di kamera ini.
            </p>
          )}
        </div>
      </div>

      {error && <p className='text-sm text-red-600'>{error}</p>}
    </div>
  );
}
