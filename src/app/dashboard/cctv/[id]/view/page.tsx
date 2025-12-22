'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Maximize,
  RotateCcw,
  Loader2,
  AlertCircle,
  Camera,
  Wifi,
  WifiOff,
  Settings,
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { data: camera, isLoading: cameraLoading } = useCCTVCamera(cameraId);
  const isAdmin = session?.user?.role === 'ADMINISTRATOR';

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
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  const handleFullscreen = () => {
    const element = iframeRef.current || videoRef.current;
    if (element?.requestFullscreen) {
      element.requestFullscreen();
    }
  };

  if (cameraLoading) {
    return (
      <div className='flex items-center justify-center min-h-[50vh] pb-20 md:pb-0'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-strong)] mx-auto'></div>
          <p className='text-sm text-[var(--color-muted)] mt-3'>
            Memuat kamera...
          </p>
        </div>
      </div>
    );
  }

  if (!camera) {
    return (
      <div className='card p-8 md:p-12 text-center mx-4 md:mx-0 mt-4 md:mt-0'>
        <Camera className='h-12 w-12 md:h-16 md:w-16 mx-auto text-[var(--color-muted)] opacity-50 mb-4' />
        <p className='text-sm md:text-base text-[var(--color-muted)] mb-4'>
          Kamera tidak ditemukan
        </p>
        <button
          onClick={() => router.push(backUrl)}
          className='btn-primary inline-flex items-center gap-2 text-sm md:text-base'
        >
          <ArrowLeft className='h-4 w-4' />
          Kembali
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return (
          <span
            className='tag'
            style={{
              borderColor: '#16a34a',
              color: '#16a34a',
              background: '#dcfce7',
            }}
          >
            <Wifi className='w-4 h-4' />
            Online
          </span>
        );
      case 'OFFLINE':
        return (
          <span
            className='tag'
            style={{
              borderColor: '#dc2626',
              color: '#dc2626',
              background: '#fee2e2',
            }}
          >
            <WifiOff className='w-4 h-4' />
            Offline
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span
            className='tag'
            style={{
              borderColor: '#f59e0b',
              color: '#f59e0b',
              background: '#fef3c7',
            }}
          >
            <Settings className='w-4 h-4' />
            Maintenance
          </span>
        );
      default:
        return <span className='tag'>{status}</span>;
    }
  };

  return (
    <div className='space-y-4 md:space-y-6 pb-20 md:pb-0'>
      {/* Header */}
      <div className='card p-0 overflow-hidden'>
        <div className='p-4 md:p-6 border-b border-[var(--color-border)]'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div className='flex items-center gap-3 md:gap-4 min-w-0'>
              <Link
                href={backUrl}
                className='w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0'
              >
                <ArrowLeft className='h-5 w-5 text-[var(--color-text)]' />
              </Link>
              <div className='flex items-center gap-3 min-w-0'>
                <div className='w-10 h-10 md:w-12 md:h-12 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center flex-shrink-0'>
                  <Camera className='h-5 w-5 md:h-6 md:w-6 text-[var(--color-primary-strong)]' />
                </div>
                <div className='min-w-0'>
                  <h1 className='text-base md:text-xl font-semibold text-[var(--color-text)] truncate'>
                    {camera.name}
                  </h1>
                  <p className='text-xs md:text-sm text-[var(--color-muted)] mt-0.5 truncate'>
                    {camera.location || 'Lokasi tidak diset'}
                  </p>
                </div>
              </div>
            </div>
            <div className='flex items-center gap-2 flex-wrap justify-between md:justify-end'>
              {getStatusBadge(camera.status)}
              <button
                onClick={handleRefresh}
                className='px-3 py-2 text-xs md:text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2'
              >
                <RotateCcw className='h-4 w-4' />
                <span className='hidden sm:inline'>Refresh</span>
              </button>
              <button
                onClick={handleFullscreen}
                className='px-3 py-2 text-xs md:text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2'
              >
                <Maximize className='h-4 w-4' />
                <span className='hidden sm:inline'>Fullscreen</span>
              </button>
            </div>
          </div>
        </div>

        <div className='p-4 md:p-6'>
          <dl className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <dt className='text-xs md:text-sm text-[var(--color-muted)]'>
                Project
              </dt>
              <dd className='text-sm md:text-base font-medium text-[var(--color-text)] mt-1'>
                {camera.project?.name || 'Unassigned'}
              </dd>
            </div>

            <div>
              <dt className='text-xs md:text-sm text-[var(--color-muted)]'>
                Terakhir aktif
              </dt>
              <dd className='text-sm md:text-base font-medium text-[var(--color-text)] mt-1'>
                {formatDateTime(camera.lastActivity)}
              </dd>
            </div>

            <div>
              <dt className='text-xs md:text-sm text-[var(--color-muted)]'>
                Update terakhir
              </dt>
              <dd className='text-sm md:text-base font-medium text-[var(--color-text)] mt-1'>
                {formatDateTime(camera.updatedAt)}
              </dd>
            </div>

            <div className='sm:col-span-2'>
              <dt className='text-xs md:text-sm text-[var(--color-muted)]'>
                Deskripsi
              </dt>
              <dd className='text-sm md:text-base font-medium text-[var(--color-text)] mt-1 whitespace-pre-wrap'>
                {camera.description || 'Tidak ada deskripsi'}
              </dd>
            </div>

            {isAdmin && (
              <div className='sm:col-span-2'>
                <dt className='text-xs md:text-sm text-[var(--color-muted)]'>
                  Stream URL
                </dt>
                <dd className='text-xs md:text-sm font-medium text-[var(--color-text)] mt-1 break-all'>
                  {camera.streamUrl || 'Tidak dikonfigurasi'}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Video Player */}
      <div className='card p-0 overflow-hidden'>
        <div className='relative bg-black aspect-video w-full'>
          {camera.status !== 'ONLINE' ? (
            <div className='absolute inset-0 flex flex-col items-center justify-center text-white px-4'>
              <Camera className='h-12 w-12 md:h-16 md:w-16 mb-3 md:mb-4 text-gray-400' />
              <p className='text-base md:text-lg font-medium'>
                Camera {camera.status.toLowerCase()}
              </p>
              <p className='text-xs md:text-sm text-gray-400 mt-2 text-center'>
                Stream kamera tidak tersedia saat ini
              </p>
            </div>
          ) : !camera.streamUrl ? (
            <div className='absolute inset-0 flex flex-col items-center justify-center text-white px-4'>
              <AlertCircle className='h-12 w-12 md:h-16 md:w-16 mb-3 md:mb-4 text-yellow-400' />
              <p className='text-base md:text-lg font-medium text-center'>
                URL stream tidak dikonfigurasi
              </p>
            </div>
          ) : (
            <>
              <iframe
                ref={iframeRef}
                src={camera.streamUrl}
                className='w-full h-full absolute inset-0'
                allow='autoplay; fullscreen; picture-in-picture'
                allowFullScreen
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                  setErrorMessage('Gagal memuat stream');
                }}
              />

              {isLoading && (
                <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white'>
                  <Loader2 className='h-6 w-6 md:h-8 md:w-8 animate-spin mb-2' />
                  <span className='text-xs md:text-sm'>Memuat stream...</span>
                </div>
              )}

              {hasError && (
                <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4 md:p-8'>
                  <AlertCircle className='h-12 w-12 md:h-16 md:w-16 mb-3 md:mb-4 text-red-400' />
                  <p className='text-base md:text-lg font-medium mb-2'>
                    Error Stream
                  </p>
                  <p className='text-xs md:text-sm text-center text-gray-300 max-w-md'>
                    {errorMessage ||
                      'Tidak dapat memuat stream kamera. Silakan periksa URL stream dan coba lagi.'}
                  </p>
                  <button
                    onClick={handleRefresh}
                    className='mt-4 px-4 py-2 text-xs md:text-sm font-medium text-white border border-white/30 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center gap-2'
                  >
                    <RotateCcw className='h-4 w-4' />
                    Coba Lagi
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
