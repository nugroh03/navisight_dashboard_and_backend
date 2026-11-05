'use client';

import { Loader2, Mic, PhoneOff } from 'lucide-react';
import { useCameraTalk } from '@/hooks/use-camera-talk';

interface TalkButtonProps {
  cameraId: string;
}

export const formatElapsed = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export function TalkButton({ cameraId }: TalkButtonProps) {
  const { state, error, elapsed, start, stop } = useCameraTalk(cameraId);

  return (
    <div className='card p-5 space-y-3'>
      <h3 className='font-semibold text-[var(--color-text)] flex items-center gap-2'>
        <Mic className='h-4 w-4 text-[var(--color-primary)]' />
        Bicara ke Kamera
      </h3>
      {state === 'idle' ? (
        <button
          type='button'
          onClick={() => void start()}
          className='w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50'
        >
          <Mic className='h-4 w-4' />
          Mulai bicara
        </button>
      ) : (
        <div className='flex gap-2'>
          <div
            role='status'
            className={`flex-1 min-w-0 inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium text-white ${
              state === 'talking' ? 'bg-red-600' : 'bg-amber-500'
            }`}
          >
            {state === 'talking' ? (
              <>
                <Mic className='h-4 w-4 shrink-0 animate-pulse' />
                Mic aktif · {formatElapsed(elapsed)}
              </>
            ) : (
              <>
                <Loader2 className='h-4 w-4 shrink-0 animate-spin' />
                Menyambungkan...
              </>
            )}
          </div>
          <button
            type='button'
            onClick={stop}
            className='inline-flex shrink-0 items-center gap-1.5 px-4 py-3 rounded-xl border border-red-300 bg-white text-sm font-semibold text-red-600 transition-colors hover:bg-red-50'
          >
            <PhoneOff className='h-4 w-4' />
            Akhiri
          </button>
        </div>
      )}
      {error && <p className='text-sm text-red-600'>{error}</p>}
    </div>
  );
}
