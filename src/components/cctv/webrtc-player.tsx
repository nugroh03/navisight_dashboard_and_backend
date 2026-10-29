'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Radio } from 'lucide-react';

interface WebRTCPlayerProps {
  cameraId: string;
  /** Dipanggil saat WebRTC gagal setelah semua percobaan ulang (untuk fallback ke HLS). */
  onFatalError?: (message: string) => void;
}

type PlayerState = 'connecting' | 'live' | 'reconnecting';

const ICE_GATHERING_TIMEOUT_MS = 2_000;
const CONNECT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

// Tunggu kandidat ICE terkumpul agar offer lengkap (signaling non-trickle).
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

export function WebRTCPlayer({ cameraId, onFatalError }: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const retriesRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onFatalErrorRef = useRef(onFatalError);
  const [state, setState] = useState<PlayerState>('connecting');

  useEffect(() => {
    onFatalErrorRef.current = onFatalError;
  }, [onFatalError]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const closePeer = () => {
    clearTimers();
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  const connect = useCallback(async () => {
    closePeer();
    let disposed = false;

    const fail = (message: string) => {
      if (disposed) return;
      disposed = true;
      closePeer();
      if (retriesRef.current < MAX_RETRIES) {
        retriesRef.current += 1;
        setState('reconnecting');
        const delay = 1_000 * 2 ** (retriesRef.current - 1);
        timersRef.current.push(setTimeout(() => void connect(), delay));
      } else {
        onFatalErrorRef.current?.(message);
      }
    };

    const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' });
    pcRef.current = pc;
    pc.addTransceiver('video', { direction: 'recvonly' });

    pc.ontrack = (event) => {
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      void video.play().catch(() => undefined);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        fail('Koneksi WebRTC gagal');
      } else if (pc.connectionState === 'disconnected') {
        // Beri waktu pulih sendiri sebelum dianggap putus.
        timersRef.current.push(
          setTimeout(() => {
            if (pc.connectionState === 'disconnected') {
              fail('Koneksi WebRTC terputus');
            }
          }, 5_000)
        );
      }
    };

    timersRef.current.push(
      setTimeout(() => {
        if (pc.connectionState !== 'connected') {
          fail('Waktu koneksi WebRTC habis');
        }
      }, CONNECT_TIMEOUT_MS)
    );

    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitForIceGathering(pc);
      if (disposed || pcRef.current !== pc) return;

      const response = await fetch(`/api/cctv/${cameraId}/webrtc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp ?? '',
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        // Konfigurasi/akses salah tidak akan pulih dengan mencoba ulang.
        if ([401, 403, 404, 503].includes(response.status)) {
          disposed = true;
          closePeer();
          onFatalErrorRef.current?.(
            data?.message ?? 'Live view tidak tersedia'
          );
          return;
        }
        throw new Error(data?.message ?? `HTTP ${response.status}`);
      }

      const answer = await response.text();
      if (disposed || pcRef.current !== pc) return;
      await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Koneksi WebRTC gagal');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId]);

  useEffect(() => {
    retriesRef.current = 0;
    setState('connecting');
    void connect();
    return () => closePeer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  const handlePlaying = () => {
    retriesRef.current = 0;
    setState('live');
  };

  return (
    <div className='relative h-full w-full bg-black'>
      <video
        ref={videoRef}
        className='h-full w-full object-contain bg-black'
        muted
        autoPlay
        playsInline
        onPlaying={handlePlaying}
      />

      {state !== 'live' ? (
        <div className='absolute inset-0 flex flex-col items-center justify-center gap-3 text-neutral-300'>
          <Loader2 className='h-8 w-8 animate-spin' />
          <p className='text-sm'>
            {state === 'reconnecting'
              ? 'Menyambungkan ulang...'
              : 'Menghubungkan live view...'}
          </p>
        </div>
      ) : (
        <span className='absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white'>
          <Radio className='h-3 w-3 text-red-500' />
          LIVE · WebRTC
        </span>
      )}
    </div>
  );
}
