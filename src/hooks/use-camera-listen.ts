'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { waitForIceGathering } from '@/lib/webrtc-ice';

export type ListenState = 'idle' | 'connecting' | 'listening';

const CONNECT_TIMEOUT_MS = 15_000;

// Sambungan WebRTC terpisah dari video dan hanya menerima audio. Koneksi ke kamera
// hanya terbuka selama aktif, dan tidak ada suara yang direkam.
export function useCameraListen(cameraId: string) {
  const [state, setState] = useState<ListenState>('idle');
  const [error, setError] = useState('');
  const [volume, setVolume] = useState(1);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const attachAudio = useCallback((element: HTMLAudioElement | null) => {
    audioRef.current = element;
  }, []);

  return { state, error, volume, setVolume, attachAudio, start, stop };
}
