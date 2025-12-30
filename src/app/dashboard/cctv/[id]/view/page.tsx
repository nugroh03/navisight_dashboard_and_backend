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

export default function ViewCCTVPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const cameraId = params?.id as string;
  const from = searchParams.get('from') || 'cctv';
  const backUrl = from === 'dashboard' ? '/dashboard' : '/dashboard/cctv';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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

    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleFullscreen = () => {
    if (!camera?.streamUrl) return;
    window.open(camera.streamUrl, '_blank', 'noopener,noreferrer');
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
                      <iframe
                        ref={iframeRef}
                        src={camera.streamUrl}
                        className='h-full w-auto border-0'
                        style={{
                          aspectRatio: isMobile ? '16 / 9' : '4 / 3',
                          display: 'block',
                        }}
                        // allow='autoplay; fullscreen; picture-in-picture'
                        allowFullScreen
                        scrolling='no'
                      />
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

            {/* Player Controls Bar */}
            <div className='bg-neutral-800/50 backdrop-blur border-t border-white/5 p-3'>
              <div className='flex items-center justify-end gap-1'>
                <button
                  onClick={handleRefresh}
                  className='p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors'
                  title='Refresh Stream'
                >
                  <RotateCcw className='h-4 w-4' />
                </button>
                <div className='w-px h-4 bg-white/10 mx-1'></div>
                <button
                  onClick={handleFullscreen}
                  className='p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors'
                  title='Fullscreen'
                >
                  <Maximize className='h-4 w-4' />
                </button>
              </div>
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
