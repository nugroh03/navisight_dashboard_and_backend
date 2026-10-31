'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, PhoneOff } from 'lucide-react';

interface TalkButtonProps {
  cameraId: string;
}

type TalkState = 'idle' | 'connecting' | 'talking';

const ICE_GATHERING_TIMEOUT_MS = 2_000;
const CONNECT_TIMEOUT_MS = 15_000;
// Batas satu sesi agar mic tidak terlupa terbuka dan suara terus terkirim ke lokasi.
const MAX_TALK_MS = 5 * 60_000;

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

const formatElapsed = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

// Tekan sekali untuk mulai bicara, tekan Akhiri untuk berhenti. Sambungan WebRTC
// terpisah dari video dan hanya mengirim audio, jadi tidak ikut mendengarkan.
export function TalkButton({ cameraId }: TalkButtonProps) {
  const [state, setState] = useState<TalkState>('idle');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Naik setiap mulai/berhenti, agar proses sambung yang sudah usang dibatalkan.
  const sessionRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = useCallback(() => {
    sessionRef.current += 1;
    clearTimer();
    micRef.current?.getTracks().forEach((track) => track.stop());
    micRef.current = null;
    if (pcRef.current) {
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
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

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Browser hanya mengizinkan mic lewat HTTPS.');
      return;
    }

    setElapsed(0);
    setState('connecting');
    timerRef.current = setTimeout(
      () => fail('Waktu sambungan mic habis'),
      CONNECT_TIMEOUT_MS
    );
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (isStale()) {
        mic.getTracks().forEach((track) => track.stop());
        return;
      }
      micRef.current = mic;

      const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
      pcRef.current = pc;
      pc.addTransceiver(mic.getAudioTracks()[0], { direction: 'sendonly' });
      // go2rtc menganggap koneksi yang hanya mengirim sebagai producer dan tidak
      // meneruskannya ke kamera; transceiver recvonly menjadikannya consumer.
      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.onconnectionstatechange = () => {
        if (isStale()) return;
        if (pc.connectionState === 'connected') {
          clearTimer();
          timerRef.current = setTimeout(() => {
            fail('Sesi bicara berakhir otomatis setelah 5 menit');
          }, MAX_TALK_MS);
          setState('talking');
        } else if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected'
        ) {
          fail('Sambungan mic terputus');
        }
      };

      await pc.setLocalDescription(await pc.createOffer());
      await waitForIceGathering(pc);
      if (isStale()) return;

      const response = await fetch(`/api/cctv/${cameraId}/talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp ?? '',
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? 'Gagal menyambungkan mic');
      }

      const answer = await response.text();
      if (isStale()) return;
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    } catch (err) {
      const name = (err as Error).name;
      fail(
        name === 'NotAllowedError'
          ? 'Izin mic ditolak di browser'
          : name === 'NotFoundError'
            ? 'Mic tidak ditemukan di perangkat ini'
            : (err as Error).message
      );
    }
  };

  useEffect(() => {
    if (state !== 'talking') return;
    const startedAt = Date.now();
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => clearInterval(interval);
  }, [state]);

  // Mic jangan tetap terbuka bila halaman ditinggalkan atau tab disembunyikan.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', stop);
      document.removeEventListener('visibilitychange', handleVisibility);
      stop();
    };
  }, [stop]);

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
