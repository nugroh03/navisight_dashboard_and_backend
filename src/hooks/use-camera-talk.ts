'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { waitForIceGathering } from '@/lib/webrtc-ice';

export type TalkState = 'idle' | 'connecting' | 'talking';

const CONNECT_TIMEOUT_MS = 15_000;
// Batas satu sesi agar mic tidak terlupa terbuka dan suara terus terkirim ke lokasi.
const MAX_TALK_MS = 5 * 60_000;

// Tekan sekali untuk mulai bicara, tekan Akhiri untuk berhenti. Sambungan WebRTC
// terpisah dari video dan hanya mengirim audio, jadi tidak ikut mendengarkan.
export function useCameraTalk(cameraId: string) {
  const [state, setState] = useState<TalkState>('idle');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [mic, setMic] = useState<MediaStream | null>(null);
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
    setMic(null);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (isStale()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      micRef.current = stream;
      setMic(stream);

      const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
      pcRef.current = pc;
      pc.addTransceiver(stream.getAudioTracks()[0], { direction: 'sendonly' });
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

  return { state, error, elapsed, mic, start, stop };
}
