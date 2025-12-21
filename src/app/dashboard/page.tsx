'use client';

import { useState } from 'react';
import { useCCTV } from '@/hooks/use-cctv';
import { useProjects } from '@/hooks/use-projects';
import {
  Camera,
  FolderKanban,
  ChevronDown,
  MapPin,
  Building2,
  Clock3,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { APP_CONFIG } from '@/config/app';
import { useSession } from 'next-auth/react';

type StatusStyle = {
  label: string;
  badgeClass: string;
  dotClass: string;
  previewRing: string;
};

const getStatusStyles = (status?: string): StatusStyle => {
  switch (status) {
    case 'ONLINE':
      return {
        label: 'Online',
        badgeClass: 'bg-green-50 text-green-700 border-green-200',
        dotClass: 'bg-green-400',
        previewRing: 'ring-1 ring-green-300/60',
      };
    case 'MAINTENANCE':
      return {
        label: 'Maintenance',
        badgeClass: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        dotClass: 'bg-yellow-400',
        previewRing: 'ring-1 ring-yellow-200/70',
      };
    case 'OFFLINE':
      return {
        label: 'Offline',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        dotClass: 'bg-red-400',
        previewRing: 'ring-1 ring-red-200/60',
      };
    default:
      return {
        label: 'Unknown',
        badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
        dotClass: 'bg-gray-400',
        previewRing: 'ring-1 ring-gray-200/60',
      };
  }
};

const formatLastActivity = (lastActivity?: Date | string | null) => {
  if (!lastActivity) return null;
  const date = new Date(lastActivity);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formatter = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
  let duration = (date.getTime() - Date.now()) / 1000;

  const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ];

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return formatter.format(Math.round(duration), 'year');
};

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
            Lihat Semua ›
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
            {cameras.slice(0, 6).map((camera) => {
              const statusStyles = getStatusStyles(camera.status);
              const lastActivityText = formatLastActivity(camera.lastActivity);
              const infoItems = [
                {
                  label: 'Lokasi',
                  value: camera.location || 'Belum ditentukan',
                  icon: MapPin,
                },
                {
                  label: 'Project',
                  value: camera.project?.name || 'Tanpa project',
                  icon: Building2,
                },
                // {
                //   label: 'Terakhir Aktif',
                //   value: lastActivityText || 'Belum ada data',
                //   icon: Clock3,
                // },
              ];

              return (
                <article
                  key={camera.id}
                  className='card border-[var(--color-border)] overflow-hidden transition-shadow duration-300 hover:shadow-xl focus-within:ring-2 focus-within:ring-[var(--color-primary)]/30'
                >
                  {/* Preview Stream */}
                  <div
                    className={`relative bg-gray-900 aspect-video overflow-hidden ${statusStyles.previewRing}`}
                  >
                    {camera.status === 'ONLINE' && camera.streamUrl ? (
                      <iframe
                        src={camera.streamUrl}
                        className='w-full h-full absolute inset-0'
                        allow='autoplay; fullscreen; picture-in-picture'
                        title={camera.name}
                      />
                    ) : (
                      <div className='absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900 text-white px-4 text-center'>
                        <Camera className='h-12 w-12 opacity-60 mb-3' />
                        <p className='text-sm font-medium'>
                          Kamera {statusStyles.label.toLowerCase()}
                        </p>
                        <span className='mt-1 text-xs text-white/70'>
                          {camera.location
                            ? `Lokasi ${camera.location}`
                            : 'Hubungi tim untuk pengecekan'}
                        </span>
                      </div>
                    )}
                    {camera.project?.name && (
                      <div className='absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm'>
                        {camera.project.name}
                      </div>
                    )}
                    <div className='absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 py-3 text-white'>
                      <div className='flex items-center gap-2 text-sm font-semibold'>
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${statusStyles.dotClass}`}
                        ></span>
                        {statusStyles.label}
                      </div>
                      {lastActivityText && (
                        <div className='flex items-center gap-1 text-xs text-white/80'>
                          <Clock3 className='h-3.5 w-3.5' />
                          {lastActivityText}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className='p-4 space-y-4'>
                    <div className='space-y-1'>
                      <div className='flex items-center gap-2'>
                        <h3 className='font-semibold text-[var(--color-text)] text-base break-words'>
                          {camera.name || 'Unnamed Camera'}
                        </h3>
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wide rounded-full border px-2 py-0.5 ${statusStyles.badgeClass}`}
                        >
                          {statusStyles.label}
                        </span>
                      </div>
                      {camera.description ? (
                        <p className='text-sm text-[var(--color-muted)] line-clamp-2 md:line-clamp-none'>
                          {camera.description}
                        </p>
                      ) : (
                        <p className='text-sm text-[var(--color-muted)] line-clamp-2 md:line-clamp-none'>
                          {camera.location ||
                            'Tambahkan catatan singkat agar tim memahami konteks kamera.'}
                        </p>
                      )}
                    </div>

                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 text-sm'>
                      {infoItems.map((info) => {
                        const Icon = info.icon;
                        return (
                          <div
                            key={info.label}
                            className='flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-slate-50 p-3'
                          >
                            <Icon className='h-4 w-4 text-[var(--color-primary)] shrink-0' />
                            <div className='min-w-0'>
                              <p className='text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]'>
                                {info.label}
                              </p>
                              <p className='font-semibold text-[var(--color-text)] break-words leading-tight'>
                                {info.value}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className='flex justify-end'>
                      <Link
                        href={`/dashboard/cctv/${camera.id}/view?from=dashboard`}
                        className='btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-md transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-strong)]/40'
                      >
                        Buka Live View
                        <ArrowUpRight className='h-4 w-4' />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
