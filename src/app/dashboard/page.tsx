'use client';

import { useState } from 'react';
import { useCCTV } from '@/hooks/use-cctv';
import { useProjects } from '@/hooks/use-projects';
import { Camera, FolderKanban, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { APP_CONFIG } from '@/config/app';
import { useSession } from 'next-auth/react';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [projectFilter, setProjectFilter] = useState<string>('ALL');

  // Check if user is WORKER
  const isWorker = session?.user?.role === 'WORKER';

  // Fetch projects for filter dropdown
  const { data: projects } = useProjects();

  // Fetch CCTVs filtered by selected project
  const { data: cameras = [], isLoading } = useCCTV(
    projectFilter !== 'ALL' ? projectFilter : undefined
  );

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
    <div className='space-y-4 md:space-y-6 pb-20 md:pb-0'>
      {/* Header */}
      <div className='card border-[var(--color-border)] bg-white p-4 md:p-8 shadow-lg'>
        <p className='text-xs md:text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]'>
          Dashboard
        </p>
        <h1 className='mt-2 md:mt-3 text-xl md:text-2xl font-semibold text-[var(--color-text)]'>
          Selamat datang di {APP_CONFIG.name}
        </h1>
        <p className='mt-1 md:mt-2 text-sm md:text-base text-[var(--color-muted)]'>
          Monitoring CCTV dan manajemen proyek dalam satu platform.
        </p>
      </div>

      {/* Filter */}
      {!isWorker && (
        <div className='card border-[var(--color-border)] bg-white p-4 md:p-6 shadow-lg'>
          <div className='flex items-center gap-3'>
            <span className='text-sm font-medium text-[var(--color-text)] whitespace-nowrap'>
              Filter Project:
            </span>
            <div className='relative flex-1 sm:flex-none sm:min-w-[220px]'>
              <div className='absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none'>
                <FolderKanban className='h-4 w-4 text-[var(--color-primary)]' />
              </div>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className='w-full appearance-none pl-10 pr-9 py-2.5 border border-[var(--color-border)] bg-white text-[var(--color-text)] rounded-lg text-sm font-medium 
                  hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent
                  transition-colors duration-200 cursor-pointer'
              >
                <option value='ALL'>Semua Project</option>
                {projects?.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <div className='absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none'>
                <ChevronDown className='h-4 w-4 text-[var(--color-muted)]' />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CCTV Grid */}
      <div className='card border-[var(--color-border)] bg-white p-4 md:p-6 shadow-lg'>
        <div className='flex items-center justify-between mb-4 md:mb-6'>
          <h2 className='text-lg md:text-xl font-semibold text-[var(--color-text)]'>
            Live CCTV Monitoring
          </h2>
          <Link
            href='/dashboard/cctv'
            className='text-xs md:text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-strong)] whitespace-nowrap transition-colors'
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
                    href={`/dashboard/cctv/${camera.id}/view?from=dashboard`}
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
