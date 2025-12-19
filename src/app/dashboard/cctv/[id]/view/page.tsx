'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  const cameraId = params?.id as string;
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { data: camera, isLoading: cameraLoading } = useCCTVCamera(cameraId);

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
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-strong)]'></div>
      </div>
    );
  }

  if (!camera) {
    return (
      <div className='card p-12 text-center'>
        <p className='text-[var(--color-muted)] mb-4'>Kamera tidak ditemukan</p>
        <button
          onClick={() => router.push('/dashboard/cctv')}
          className='btn-primary inline-flex items-center gap-2'
        >
          Kembali ke Daftar CCTV
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
    <div className='space-y-6'>
      {/* Header */}
      <div className='card p-6'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <Link
              href='/dashboard/cctv'
              className='w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors'
            >
              <ArrowLeft className='h-5 w-5 text-[var(--color-text)]' />
            </Link>
            <div className='flex items-center gap-3'>
              <div className='w-12 h-12 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center'>
                <Camera className='h-6 w-6 text-[var(--color-primary-strong)]' />
              </div>
              <div>
                <h1 className='text-xl font-semibold text-[var(--color-text)]'>
                  {camera.name}
                </h1>
                <p className='text-sm text-[var(--color-muted)] mt-0.5'>
                  {camera.location || 'Lokasi tidak diset'}
                </p>
              </div>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {getStatusBadge(camera.status)}
            <button
              onClick={handleRefresh}
              className='px-3 py-2 text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2'
            >
              <RotateCcw className='h-4 w-4' />
              Refresh
            </button>
            <button
              onClick={handleFullscreen}
              className='px-3 py-2 text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center gap-2'
            >
              <Maximize className='h-4 w-4' />
              Fullscreen
            </button>
          </div>
        </div>
      </div>

      {/* Video Player */}
      <div className='card p-0 overflow-hidden'>
        <div className='relative bg-black aspect-video'>
          {camera.status !== 'ONLINE' ? (
            <div className='absolute inset-0 flex flex-col items-center justify-center text-white'>
              <Camera className='h-16 w-16 mb-4 text-gray-400' />
              <p className='text-lg font-medium'>
                Camera {camera.status.toLowerCase()}
              </p>
              <p className='text-sm text-gray-400 mt-2'>
                Stream kamera tidak tersedia saat ini
              </p>
            </div>
          ) : !camera.streamUrl ? (
            <div className='absolute inset-0 flex flex-col items-center justify-center text-white'>
              <AlertCircle className='h-16 w-16 mb-4 text-yellow-400' />
              <p className='text-lg font-medium'>
                URL stream tidak dikonfigurasi
              </p>
            </div>
          ) : (
            <>
              <iframe
                ref={iframeRef}
                src={camera.streamUrl}
                className='w-full h-full'
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
                  <Loader2 className='h-8 w-8 animate-spin mb-2' />
                  <span className='text-sm'>Memuat stream...</span>
                </div>
              )}

              {hasError && (
                <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-8'>
                  <AlertCircle className='h-16 w-16 mb-4 text-red-400' />
                  <p className='text-lg font-medium mb-2'>Error Stream</p>
                  <p className='text-sm text-center text-gray-300 max-w-md'>
                    {errorMessage ||
                      'Tidak dapat memuat stream kamera. Silakan periksa URL stream dan coba lagi.'}
                  </p>
                  <button
                    onClick={handleRefresh}
                    className='mt-4 px-4 py-2 text-sm font-medium text-white border border-white/30 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center gap-2'
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

      {/* Camera Info */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div className='card p-5'>
          <h2 className='text-base font-semibold text-[var(--color-text)] mb-4'>
            Informasi Kamera
          </h2>
          <div className='space-y-3'>
            <div>
              <p className='text-sm text-[var(--color-muted)]'>Deskripsi</p>
              <p className='font-medium text-[var(--color-text)]'>
                {camera.description || 'Tidak ada deskripsi'}
              </p>
            </div>
            <div>
              <p className='text-sm text-[var(--color-muted)]'>Project</p>
              <p className='font-medium text-[var(--color-text)]'>
                {camera.project?.name || 'Unassigned'}
              </p>
            </div>
          </div>
        </div>

        <div className='card p-5'>
          <h2 className='text-base font-semibold text-[var(--color-text)] mb-4'>
            Detail Stream
          </h2>
          <div className='space-y-3'>
            <div>
              <p className='text-sm text-[var(--color-muted)]'>Stream URL</p>
              <p className='font-medium text-xs break-all text-[var(--color-text)]'>
                {camera.streamUrl || 'Tidak dikonfigurasi'}
              </p>
            </div>
            <div>
              <p className='text-sm text-[var(--color-muted)]'>Status</p>
              <p className='font-medium text-[var(--color-text)]'>
                {camera.status}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
