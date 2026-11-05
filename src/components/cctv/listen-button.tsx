'use client';

import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { useCameraListen } from '@/hooks/use-camera-listen';

interface ListenButtonProps {
  cameraId: string;
}

export function ListenButton({ cameraId }: ListenButtonProps) {
  const { state, error, volume, setVolume, attachAudio, start, stop } =
    useCameraListen(cameraId);
  const active = state !== 'idle';

  return (
    <div className='card p-5 space-y-3'>
      <h3 className='font-semibold text-[var(--color-text)] flex items-center gap-2'>
        <Volume2 className='h-4 w-4 text-[var(--color-primary)]' />
        Dengarkan Kamera
      </h3>
      <audio ref={attachAudio} autoPlay />
      <button
        type='button'
        aria-pressed={active}
        onClick={() => (active ? stop() : void start())}
        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
          state === 'listening'
            ? 'bg-emerald-600 border-emerald-600 text-white'
            : state === 'connecting'
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        {state === 'connecting' ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : state === 'listening' ? (
          <VolumeX className='h-4 w-4' />
        ) : (
          <Volume2 className='h-4 w-4' />
        )}
        {state === 'listening'
          ? 'Sedang mendengarkan, klik untuk berhenti'
          : state === 'connecting'
            ? 'Menyambungkan...'
            : 'Dengarkan'}
      </button>
      {state === 'listening' && (
        <label className='flex items-center gap-3 text-sm text-[var(--color-muted)]'>
          Volume
          <input
            type='range'
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            className='flex-1'
          />
        </label>
      )}
      {error && <p className='text-sm text-red-600'>{error}</p>}
    </div>
  );
}
