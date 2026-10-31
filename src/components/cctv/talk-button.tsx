'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic } from 'lucide-react';

interface TalkButtonProps {
  cameraId: string;
}

type TalkState = 'idle' | 'connecting' | 'talking';

const ICE_GATHERING_TIMEOUT_MS = 2_000;
// Batas satu sesi agar mic tidak terbuka terus bila event lepas tombol hilang.
const MAX_TALK_MS = 60_000;

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

// Tahan untuk bicara: sambungan WebRTC terpisah dari video, hanya mengirim
// audio, dan dibuka selama tombol ditahan agar mic & sesi kamera tidak tertahan.
export function TalkButton({ cameraId }: TalkButtonProps) {
  const [state, setState] = useState<TalkState>('idle');
  const [error, setError] = useState('');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Naik setiap mulai/berhenti, agar proses sambung yang sudah usang dibatalkan.
  const sessionRef = useRef(0);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
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

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Browser hanya mengizinkan mic lewat HTTPS.');
      return;
    }

    setState('connecting');
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
          setState('talking');
        } else if (pc.connectionState === 'failed') {
          stop();
          setError('Sambungan audio gagal');
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
        throw new Error(data?.message ?? 'Gagal menyambungkan audio');
      }

      const answer = await response.text();
      if (isStale()) return;
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
      timerRef.current = setTimeout(stop, MAX_TALK_MS);
    } catch (err) {
      if (isStale()) return;
      stop();
      const name = (err as Error).name;
      setError(
        name === 'NotAllowedError'
          ? 'Izin mic ditolak di browser'
          : name === 'NotFoundError'
            ? 'Mic tidak ditemukan di perangkat ini'
            : (err as Error).message
      );
    }
  };

  // Lepaskan mic bila tab disembunyikan, jendela kehilangan fokus, atau komponen dilepas.
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

  return (
    <div className='card p-5 space-y-3'>
      <h3 className='font-semibold text-[var(--color-text)] flex items-center gap-2'>
        <Mic className='h-4 w-4 text-[var(--color-primary)]' />
        Bicara ke Kamera
      </h3>
      <button
        type='button'
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          void start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onContextMenu={(event) => event.preventDefault()}
        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors select-none touch-none ${
          state === 'talking'
            ? 'bg-red-600 border-red-600 text-white'
            : state === 'connecting'
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        {state === 'connecting' ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
          <Mic className='h-4 w-4' />
        )}
        {state === 'talking'
          ? 'Silakan bicara... (lepas untuk berhenti)'
          : state === 'connecting'
            ? 'Menyambungkan, tetap tahan...'
            : 'Tahan untuk bicara'}
      </button>
      {error && <p className='text-sm text-red-600'>{error}</p>}
    </div>
  );
}
