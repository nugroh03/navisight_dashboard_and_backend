'use client';

import { useCCTV } from '@/hooks/use-cctv';
import { Camera } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: cameras = [], isLoading } = useCCTV();

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ONLINE':
        return (
          <span className='tag bg-green-50 text-green-700 border-green-200'>
            Online
          </span>
        );
      case 'OFFLINE':
        return (
          <span className='tag bg-red-50 text-red-700 border-red-200'>
            Offline
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className='tag bg-yellow-50 text-yellow-700 border-yellow-200'>
            Maintenance
          </span>
        );
      default:
        return <span className='tag'>Unknown</span>;
    }
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]'>
          Dashboard
        </p>
        <h1 className='mt-3 text-2xl font-semibold text-[var(--color-text)]'>
          Selamat datang di NAVISIGHT
        </h1>
        <p className='mt-2 text-[var(--color-muted)]'>
          Monitoring CCTV dan manajemen proyek dalam satu platform.
        </p>
      </div>

      {/* CCTV Grid */}
      <div className='card border-[var(--color-border)] bg-white p-6 shadow-lg'>
        <div className='flex items-center justify-between mb-6'>
          <h2 className='text-xl font-semibold text-[var(--color-text)]'>
            Live CCTV Monitoring
          </h2>
          <Link
            href='/dashboard/cctv'
            className='text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-strong)]'
          >
            Lihat Semua →
          </Link>
        </div>

        {isLoading ? (
          <div className='flex items-center justify-center py-12'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]'></div>
          </div>
        ) : cameras.length === 0 ? (
          <div className='text-center py-12'>
            <Camera className='mx-auto h-12 w-12 text-[var(--color-muted)] opacity-50' />
            <p className='mt-4 text-sm text-[var(--color-muted)]'>
              Belum ada kamera CCTV
            </p>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {cameras.slice(0, 6).map((camera) => (
              <div
                key={camera.id}
                className='card border-[var(--color-border)] overflow-hidden'
              >
                {/* Preview Stream */}
                <div className='relative bg-gray-900 aspect-video overflow-hidden'>
                  {camera.status === 'ONLINE' && camera.streamUrl ? (
                    <iframe
                      src={camera.streamUrl}
                      className='w-full h-full absolute inset-0'
                      allow='autoplay; fullscreen; picture-in-picture'
                      title={camera.name}
                    />
                  ) : (
                    <div className='absolute inset-0 flex flex-col items-center justify-center text-white'>
                      <Camera className='h-12 w-12 opacity-50 mb-2' />
                      <p className='text-sm opacity-75'>
                        Camera {camera.status?.toLowerCase() || 'offline'}
                      </p>
                    </div>
                  )}
                  <div className='absolute top-3 right-3 z-10'>
                    {getStatusBadge(camera.status)}
                  </div>
                </div>

                {/* Info */}
                <div className='p-4'>
                  <h3 className='font-semibold text-[var(--color-text)] truncate'>
                    {camera.name || 'Unnamed Camera'}
                  </h3>
                  {camera.project && (
                    <p className='mt-1 text-xs text-[var(--color-primary)] font-medium truncate'>
                      {camera.project.name}
                    </p>
                  )}
                  {camera.location && (
                    <p className='mt-1 text-sm text-[var(--color-muted)] truncate'>
                      {camera.location}
                    </p>
                  )}
                  <Link
                    href={`/dashboard/cctv/${camera.id}/view`}
                    className='mt-3 inline-block text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-strong)]'
                  >
                    Lihat Fullscreen →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
