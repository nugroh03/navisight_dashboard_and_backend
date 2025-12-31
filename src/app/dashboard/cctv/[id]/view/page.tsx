'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Maximize,
  RotateCcw,
  AlertCircle,
  Camera,
  WifiOff,
  Settings,
  Info,
  MapPin,
  Activity,
} from 'lucide-react';
import { useCCTVCamera } from '@/hooks/use-cctv';
import Link from 'next/link';
import Hls from 'hls.js';
import { detectStreamType, type StreamType } from '@/lib/stream-utils';

const withCacheBuster = (url: string) =>
  `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;

export default function ViewCCTVPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const cameraId = params?.id as string;
  const from = searchParams.get('from') || 'cctv';
  const backUrl = from === 'dashboard' ? '/dashboard' : '/dashboard/cctv';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [streamType, setStreamType] = useState<StreamType>('iframe');
  const [hlsReloadKey, setHlsReloadKey] = useState(0);
  const [mjpegReloadKey, setMjpegReloadKey] = useState(0);
  const { data: camera, isLoading: cameraLoading } = useCCTVCamera(cameraId);
  const isAdmin = session?.user?.role === 'ADMINISTRATOR';

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement;

      setIsFullscreen(fullscreenElement === playerContainerRef.current);
    };

    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange',
    ];

    events.forEach((eventName) =>
      document.addEventListener(eventName, handleFullscreenChange)
    );

    return () => {
      events.forEach((eventName) =>
        document.removeEventListener(eventName, handleFullscreenChange)
      );
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)');

    const handleMediaChange = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile(
        'matches' in event ? event.matches : (event as MediaQueryList).matches
      );
    };

    handleMediaChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      mediaQuery.addListener(handleMediaChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, []);

  const formatDateTime = (value?: Date | string | null) => {
    if (!value) return '-';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const handleRefresh = () => {
    setHasError(false);
    setErrorMessage('');

    if (streamType === 'hls') {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      setHlsReloadKey((prev) => prev + 1);
      return;
    }

    if (streamType === 'mjpeg') {
      setMjpegReloadKey((prev) => prev + 1);
      return;
    }

    if (iframeRef.current && camera?.streamUrl) {
      iframeRef.current.src = withCacheBuster(camera.streamUrl);
    }
  };

  const handleFullscreen = () => {
    if (!camera?.streamUrl) return;
    window.open(camera.streamUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!camera?.streamUrl) {
      setStreamType('iframe');
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      return;
    }

    const detectedType = detectStreamType(camera.streamUrl);
    setStreamType(detectedType);
    setHasError(false);
    setErrorMessage('');

    if (detectedType !== 'hls' && hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }
  }, [camera?.streamUrl]);

  useEffect(() => {
    if (streamType !== 'hls' || !camera?.streamUrl) {
      return;
    }

    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    const sourceUrl =
      streamType === 'hls' && camera?.id
        ? `/api/cctv/${camera.id}/stream`
        : camera?.streamUrl;

    if (!sourceUrl) {
      setHasError(true);
      setErrorMessage('Stream HLS tidak tersedia.');
      return;
    }

    setHasError(false);
    setErrorMessage('');

    const cleanupVideoElement = () => {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
    };

    const nativeSupportLevel =
      videoElement.canPlayType('application/vnd.apple.mpegurl') ||
      videoElement.canPlayType('application/x-mpegurl');
    const canUseNative = nativeSupportLevel === 'probably';

    if (Hls.isSupported()) {
      console.log('[HLS] Using hls.js library');
      const hls = new Hls({
        debug: true,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        xhrSetup: (xhr: any) => {
          xhr.withCredentials = false;
        },
      });
      hlsInstanceRef.current = hls;

      hls.attachMedia(videoElement);
      console.log('[HLS] Loading source:', sourceUrl);
      hls.loadSource(sourceUrl);
      setHasError(false);
      setErrorMessage('');

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('HLS error', data);
        let message =
          data?.type === Hls.ErrorTypes.NETWORK_ERROR
            ? 'Jaringan bermasalah saat memuat stream HLS.'
            : 'Player tidak dapat memutar stream HLS.';

        if (data?.details === 'manifestParsingError') {
          message =
            'Manifest HLS tidak valid atau tidak diawali #EXTM3U (file bisa kedaluwarsa atau salah).';
        }

        setHasError(true);
        setErrorMessage(message);

        if (data?.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              hlsInstanceRef.current = null;
          }
        } else {
          // Non-fatal error, biarkan player mencoba recover tanpa menahan overlay
          setHasError(false);
          setErrorMessage('');
        }
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS] Manifest parsed, starting playback');
        videoElement
          .play()
          .then(() => {
            console.log('[HLS] Playback started successfully');
            setHasError(false);
          })
          .catch((error) => {
            console.error('[HLS] Autoplay error', error);
            setHasError(true);
            setErrorMessage('Player tidak dapat otomatis memutar stream.');
          });
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setHasError(false);
        setErrorMessage('');
      });

      hls.on(Hls.Events.LEVEL_LOADED, () => {
        setHasError(false);
        setErrorMessage('');
      });

      return () => {
        hls.destroy();
        hlsInstanceRef.current = null;
        cleanupVideoElement();
      };
    }

    if (canUseNative) {
      console.log('[HLS] Using native HLS support');
      videoElement.src = sourceUrl;
      videoElement
        .play()
        .then(() => {
          console.log('[HLS] Native playback started');
          setHasError(false);
        })
        .catch((error) => {
          console.error('[HLS] Native playback error', error);
          setHasError(true);
          setErrorMessage('Gagal memutar stream HLS.');
        });

      return () => {
        cleanupVideoElement();
      };
    }

    setHasError(true);
    setErrorMessage(
      'Browser tidak mendukung pemutaran HLS. Coba gunakan browser berbeda.'
    );
  }, [camera?.streamUrl, camera?.id, streamType, hlsReloadKey]);

  const handleVideoLoaded = () => {
    setHasError(false);
    setErrorMessage('');
  };

  const handleVideoError = () => {
    setHasError(true);
    setErrorMessage('Player tidak dapat memutar stream HLS.');
  };

  const handleMjpegLoaded = () => {
    setHasError(false);
    setErrorMessage('');
  };

  const handleMjpegError = () => {
    setHasError(true);
    setErrorMessage('Player tidak dapat memutar stream MJPEG.');
  };

  if (cameraLoading) {
    return (
      <div className='flex items-center justify-center min-h-[60vh]'>
        <div className='text-center space-y-4'>
          <div className='relative mx-auto w-16 h-16'>
            <div className='absolute inset-0 border-4 border-[var(--color-primary)]/20 rounded-full'></div>
            <div className='absolute inset-0 border-4 border-[var(--color-primary)] rounded-full border-t-transparent animate-spin'></div>
          </div>
          <p className='text-[var(--color-muted)] font-medium animate-pulse'>
            Menghubungkan ke kamera...
          </p>
        </div>
      </div>
    );
  }

  if (!camera) {
    return (
      <div className='flex flex-col items-center justify-center min-h-[60vh] text-center px-4'>
        <div className='w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6'>
          <Camera className='h-10 w-10 text-gray-400' />
        </div>
        <h2 className='text-xl font-semibold text-[var(--color-text)] mb-2'>
          Kamera Tidak Ditemukan
        </h2>
        <p className='text-[var(--color-muted)] max-w-md mb-8'>
          Kamera yang Anda cari mungkin telah dihapus atau Anda tidak memiliki
          akses untuk melihatnya.
        </p>
        <Link
          href={backUrl}
          className='btn-primary inline-flex items-center gap-2'
        >
          <ArrowLeft className='h-4 w-4' />
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return (
          <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'>
            <span className='relative flex h-2 w-2'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75'></span>
              <span className='relative inline-flex rounded-full h-2 w-2 bg-emerald-500'></span>
            </span>
            Online
          </span>
        );
      case 'OFFLINE':
        return (
          <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20'>
            <WifiOff className='w-3 h-3' />
            Offline
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20'>
            <Settings className='w-3 h-3' />
            Maintenance
          </span>
        );
      default:
        return (
          <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20'>
            {status}
          </span>
        );
    }
  };

  return (
    <div className='max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500'>
      {/* Header Navigation */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div className='flex items-center gap-4'>
          <Link
            href={backUrl}
            className='w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm'
          >
            <ArrowLeft className='h-5 w-5' />
          </Link>
          <div>
            <h1 className='text-xl font-bold text-[var(--color-text)] flex items-center gap-3'>
              {camera.name}
              {getStatusBadge(camera.status)}
            </h1>
            <div className='flex items-center gap-2 text-sm text-[var(--color-muted)] mt-1'>
              <MapPin className='w-3.5 h-3.5' />
              {camera.location || 'Lokasi tidak diset'}
              <span className='text-gray-300'>•</span>
              <span className='flex items-center gap-1'>
                <Activity className='w-3.5 h-3.5' />
                Last active: {formatDateTime(camera.lastActivity)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Video Player Column */}
        <div className='lg:col-span-2 space-y-4'>
          <div className='relative rounded-2xl overflow-hidden bg-neutral-900 shadow-2xl ring-1 ring-black/5'>
            {/* Video Container */}
            <div
              ref={playerContainerRef}
              className={`relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden group fullscreen-player${
                isFullscreen ? ' fullscreen-active' : ''
              }`}
            >
              {camera.status !== 'ONLINE' ? (
                <div className='flex flex-col items-center justify-center text-neutral-500 p-8 text-center'>
                  <WifiOff className='h-16 w-16 mb-4 opacity-50' />
                  <p className='text-lg font-medium text-neutral-400'>
                    Kamera Offline
                  </p>
                  <p className='text-sm mt-2 max-w-xs'>
                    Tidak dapat terhubung ke stream kamera saat ini.
                  </p>
                </div>
              ) : !camera.streamUrl ? (
                <div className='flex flex-col items-center justify-center text-neutral-500 p-8 text-center'>
                  <AlertCircle className='h-16 w-16 mb-4 text-amber-500/50' />
                  <p className='text-lg font-medium text-neutral-400'>
                    Stream Tidak Dikonfigurasi
                  </p>
                </div>
              ) : (
                <>
                  <div className='flex items-center justify-center h-full w-full bg-black'>
                    <div className='flex items-center justify-center h-full w-full bg-black'>
                      {streamType === 'hls' ? (
                        <video
                          key={`hls-player-${hlsReloadKey}`}
                          ref={videoRef}
                          className='h-full w-full object-contain bg-black'
                          controls
                          muted
                          autoPlay
                          playsInline
                          crossOrigin='anonymous'
                          onPlaying={() => {
                            setHasError(false);
                            setErrorMessage('');
                          }}
                          onLoadedData={handleVideoLoaded}
                          onError={handleVideoError}
                        />
                      ) : streamType === 'mjpeg' ? (
                        <img
                          key={`mjpeg-player-${mjpegReloadKey}`}
                          src={camera.streamUrl}
                          alt={camera.name}
                          className='h-full w-full object-contain bg-black select-none'
                          draggable={false}
                          onLoad={handleMjpegLoaded}
                          onError={handleMjpegError}
                        />
                      ) : (
                        <iframe
                          ref={iframeRef}
                          src={camera.streamUrl}
                          className='h-full w-auto border-0'
                          style={{
                            aspectRatio: isMobile ? '16 / 9' : '4 / 3',
                            display: 'block',
                          }}
                          allowFullScreen
                          scrolling='no'
                        />
                      )}
                    </div>
                  </div>

                  {/* Error Overlay */}
                  {hasError && (
                    <div className='absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm text-white p-8'>
                      <AlertCircle className='h-12 w-12 mb-4 text-red-500' />
                      <p className='text-lg font-medium mb-2'>
                        Koneksi Terputus
                      </p>
                      <button
                        onClick={handleRefresh}
                        className='mt-4 px-4 py-2 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2'
                      >
                        <RotateCcw className='h-4 w-4' />
                        Muat Ulang
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Column */}
      <div className='space-y-6'>
        {/* Quick Stats Card */}
        <div className='card p-5 space-y-4'>
          <h3 className='font-semibold text-[var(--color-text)] flex items-center gap-2'>
            <Info className='h-4 w-4 text-[var(--color-primary)]' />
            Informasi Kamera
          </h3>

          <div className='space-y-3'>
            <div className='p-3 rounded-lg bg-gray-50 border border-gray-100'>
              <p className='text-xs text-[var(--color-muted)] mb-1'>Project</p>
              <p className='font-medium text-[var(--color-text)]'>
                {camera.project?.name || 'Unassigned'}
              </p>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='p-3 rounded-lg bg-gray-50 border border-gray-100'>
                <p className='text-xs text-[var(--color-muted)] mb-1'>Dibuat</p>
                <p className='text-sm font-medium text-[var(--color-text)]'>
                  {formatDateTime(camera.createdAt).split(',')[0]}
                </p>
              </div>
              <div className='p-3 rounded-lg bg-gray-50 border border-gray-100'>
                <p className='text-xs text-[var(--color-muted)] mb-1'>Update</p>
                <p className='text-sm font-medium text-[var(--color-text)]'>
                  {formatDateTime(camera.updatedAt).split(',')[0]}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Description Card */}
        <div className='card p-5'>
          <h3 className='font-semibold text-[var(--color-text)] mb-3'>
            Deskripsi
          </h3>
          <p className='text-sm text-[var(--color-muted)] leading-relaxed whitespace-pre-wrap'>
            {camera.description ||
              'Tidak ada deskripsi tambahan untuk kamera ini.'}
          </p>
        </div>

        {/* Admin Info */}
        {isAdmin && (
          <div className='card p-5 border-l-4 border-l-amber-400'>
            <h3 className='font-semibold text-[var(--color-text)] mb-2 flex items-center gap-2'>
              <Settings className='h-4 w-4 text-amber-500' />
              Konfigurasi Admin
            </h3>
            <div className='space-y-2'>
              <div>
                <p className='text-xs text-[var(--color-muted)]'>Stream URL</p>
                <code className='block mt-1 p-2 bg-gray-100 rounded text-xs font-mono break-all text-gray-600'>
                  {camera.streamUrl || '-'}
                </code>
              </div>
              <div>
                <p className='text-xs text-[var(--color-muted)]'>Camera ID</p>
                <code className='block mt-1 text-xs font-mono text-gray-500'>
                  {camera.id}
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
