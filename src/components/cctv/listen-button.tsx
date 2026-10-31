'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';

interface ListenButtonProps {
  cameraId: string;
}

type ListenState = 'idle' | 'connecting' | 'listening';

const ICE_GATHERING_TIMEOUT_MS = 2_000;
const CONNECT_TIMEOUT_MS = 15_000;

const waitForIceGathering = (pc: RTCPeerConnection) =>
  new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const timer = setTimeout(done, ICE_GATHERING_TIMEOUT_MS);
    function done() {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    }
    function onChange() {
      if (pc.iceGatheringState === 'complete') done();
    }
    pc.addEventListener('icegatheringstatechange', onChange);
  });

// Sambungan WebRTC terpisah dari video dan hanya menerima audio. Koneksi ke kamera
// hanya terbuka selama tombol aktif, dan tidak ada suara yang direkam.
export function ListenButton({ cameraId }: ListenButtonProps) {
  const [state, setState] = useState<ListenState>('idle');
  const [error, setError] = useState('');
  const [volume, setVolume] = useState(1);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Naik setiap mulai/berhenti, agar proses sambung yang sudah usang dibatalkan.
  const sessionRef = useRef(0);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) audioRef.current.srcObject = null;
    setState('idle');
  }, []);

  const start = async () => {
    stop();
    setError('');
    const session = sessionRef.current;
    const isStale = () => session !== sessionRef.current;
    const fail = (message: string) => {
      if (isStale()) return;
      stop();
      setError(message);
    };

    setState('connecting');
    const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
    pcRef.current = pc;
    pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.ontrack = (event) => {
      if (!audioRef.current) return;
      audioRef.current.srcObject =
        event.streams[0] ?? new MediaStream([event.track]);
      void audioRef.current.play().catch(() => undefined);
    };
    pc.onconnectionstatechange = () => {
      if (isStale()) return;
      if (pc.connectionState === 'connected') {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        setState('listening');
      } else if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected'
      ) {
        fail('Sambungan suara terputus');
      }
    };
    timerRef.current = setTimeout(
      () => fail('Waktu sambungan suara habis'),
      CONNECT_TIMEOUT_MS
    );

    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitForIceGathering(pc);
      if (isStale()) return;

      const response = await fetch(`/api/cctv/${cameraId}/listen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp ?? '',
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? 'Gagal menyambungkan suara');
      }

      const answer = await response.text();
      if (isStale()) return;
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    } catch (err) {
      fail((err as Error).message);
    }
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [stop]);

  const active = state !== 'idle';

  return (
    <div className='card p-5 space-y-3'>
      <h3 className='font-semibold text-[var(--color-text)] flex items-center gap-2'>
        <Volume2 className='h-4 w-4 text-[var(--color-primary)]' />
        Dengarkan Kamera
      </h3>
      <audio ref={audioRef} autoPlay />
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
