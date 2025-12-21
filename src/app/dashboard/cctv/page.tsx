'use client';

import { useState } from 'react';
import {
  Plus,
  Search,
  Camera,
  Wifi,
  WifiOff,
  Settings,
  Eye,
  Edit,
  Trash2,
  FolderKanban,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { useCCTV } from '@/hooks/use-cctv';
import { useProjects } from '@/hooks/use-projects';
import { RoleName } from '@prisma/client';
import type { CCTV } from '@/types';
import Link from 'next/link';
import { CCTVDeleteModal } from '@/components/cctv/cctv-delete-modal';
import { useSession } from 'next-auth/react';

export default function CCTVPage() {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<CCTV | null>(null);

  // Fetch projects for filter dropdown
  const { data: projects } = useProjects();

  // Fetch CCTVs filtered by selected project
  const {
    data: cameras,
    isLoading,
    error,
  } = useCCTV(projectFilter !== 'ALL' ? projectFilter : undefined);

  const user = {
    id: session?.user?.id || '',
    name: session?.user?.name || null,
    email: session?.user?.email || '',
    role: (session?.user?.role as RoleName) || RoleName.CLIENT,
    image: session?.user?.image || null,
  };

  const filteredCameras =
    cameras?.filter((camera: CCTV) => {
      const matchesSearch =
        camera.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        camera.location?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'ALL' || camera.status === statusFilter;
      return matchesSearch && matchesStatus;
    }) || [];

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-strong)]'></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='text-center py-12'>
        <p className='text-red-600'>
          Error loading CCTV cameras: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='card border-[var(--color-border)] bg-white p-8 shadow-lg'>
        <p className='text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-primary-strong)]'>
          CCTV
        </p>
        <h1 className='mt-3 text-2xl font-semibold text-[var(--color-text)]'>
          Monitoring CCTV
        </h1>
        <p className='mt-2 text-[var(--color-muted)]'>
          Kelola dan pantau semua kamera CCTV Anda dalam satu tempat.
        </p>
      </div>

      {/* Filters and Actions */}
      <div className='card p-6'>
        <div className='flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center'>
          <div className='flex-1 max-w-md w-full'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-muted)] h-5 w-5' />
              <input
                type='text'
                placeholder='Cari kamera...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='input-field w-full pl-10 pr-4 py-2.5 border border-[var(--color-border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent'
              />
            </div>
          </div>

          <div className='flex gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap'>
            {/* Project Filter Dropdown */}
            <div className='relative flex-1 sm:flex-none sm:min-w-[180px]'>
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

            {/* Status Filter Dropdown */}
            <div className='relative flex-1 sm:flex-none sm:min-w-[180px]'>
              <div className='absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none'>
                <Filter className='h-4 w-4 text-[var(--color-primary)]' />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className='w-full appearance-none pl-10 pr-9 py-2.5 border border-[var(--color-border)] bg-white text-[var(--color-text)] rounded-lg text-sm font-medium 
                  hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-strong)] focus:border-transparent
                  transition-colors duration-200 cursor-pointer'
              >
                <option value='ALL'>Semua Status</option>
                <option value='ONLINE'>Online</option>
                <option value='OFFLINE'>Offline</option>
                <option value='MAINTENANCE'>Maintenance</option>
              </select>
              <div className='absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none'>
                <ChevronDown className='h-4 w-4 text-[var(--color-muted)]' />
              </div>
            </div>

            {user.role === RoleName.ADMINISTRATOR && (
              <Link
                href='/dashboard/cctv/create'
                className='btn-primary inline-flex items-center gap-2'
              >
                <Plus className='h-5 w-5' />
                <span>Tambah Kamera</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='card p-5'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center'>
              <Wifi className='h-6 w-6 text-green-600' />
            </div>
            <div>
              <p className='text-sm text-[var(--color-muted)]'>Online</p>
              <p className='text-2xl font-bold text-[var(--color-text)]'>
                {cameras?.filter((c: CCTV) => c.status === 'ONLINE').length ||
                  0}
              </p>
            </div>
          </div>
        </div>

        <div className='card p-5'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center'>
              <WifiOff className='h-6 w-6 text-red-600' />
            </div>
            <div>
              <p className='text-sm text-[var(--color-muted)]'>Offline</p>
              <p className='text-2xl font-bold text-[var(--color-text)]'>
                {cameras?.filter((c: CCTV) => c.status === 'OFFLINE').length ||
                  0}
              </p>
            </div>
          </div>
        </div>

        <div className='card p-5'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center'>
              <Settings className='h-6 w-6 text-yellow-600' />
            </div>
            <div>
              <p className='text-sm text-[var(--color-muted)]'>Maintenance</p>
              <p className='text-2xl font-bold text-[var(--color-text)]'>
                {cameras?.filter((c: CCTV) => c.status === 'MAINTENANCE')
                  .length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className='card p-5'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center'>
              <Camera className='h-6 w-6 text-blue-600' />
            </div>
            <div>
              <p className='text-sm text-[var(--color-muted)]'>Total</p>
              <p className='text-2xl font-bold text-[var(--color-text)]'>
                {cameras?.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cameras Grid */}
      {filteredCameras.length === 0 ? (
        <div className='card p-12 text-center'>
          <div className='w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
            <Camera className='h-12 w-12 text-[var(--color-muted)]' />
          </div>
          <h3 className='text-lg font-semibold text-[var(--color-text)] mb-2'>
            Tidak ada kamera
          </h3>
          <p className='text-[var(--color-muted)] mb-4'>
            {searchTerm || statusFilter !== 'ALL'
              ? 'Tidak ada kamera yang sesuai dengan kriteria pencarian.'
              : 'Mulai dengan menambahkan kamera pertama Anda.'}
          </p>
          {user.role === RoleName.ADMINISTRATOR &&
            !searchTerm &&
            statusFilter === 'ALL' && (
              <Link
                href='/dashboard/cctv/create'
                className='btn-primary inline-flex items-center gap-2'
              >
                <Plus className='h-5 w-5' />
                <span>Tambah Kamera</span>
              </Link>
            )}
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {filteredCameras.map((camera: CCTV) => {
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
              <div key={camera.id} className='card p-0 overflow-hidden'>
                {/* Camera Preview */}
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
                        Camera {camera.status.toLowerCase()}
                      </p>
                    </div>
                  )}
                  <div className='absolute top-3 right-3 z-10'>
                    {getStatusBadge(camera.status)}
                  </div>
                </div>

                {/* Camera Info */}
                <div className='p-5'>
                  <div className='flex items-start justify-between mb-3'>
                    <div className='flex items-center gap-3'>
                      <div className='w-10 h-10 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center shrink-0'>
                        <Camera className='h-5 w-5 text-[var(--color-primary-strong)]' />
                      </div>
                      <div>
                        <h3 className='font-semibold text-[var(--color-text)]'>
                          {camera.name}
                        </h3>
                        <p className='text-sm text-[var(--color-muted)]'>
                          {camera.description || 'Tidak ada deskripsi'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className='space-y-2 mb-4'>
                    <div className='flex items-center gap-2 text-sm text-[var(--color-muted)]'>
                      <p className='font-medium text-[var(--color-text)]'>
                        {camera.location || 'Lokasi tidak diset'}
                      </p>
                    </div>
                    <div className='text-sm'>
                      <p className='text-[var(--color-muted)]'>Project</p>
                      <p className='font-medium text-[var(--color-text)]'>
                        {camera.project?.name || 'Unassigned'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className='flex gap-2 pt-4 border-t border-[var(--color-border)]'>
                    <Link
                      href={`/dashboard/cctv/${camera.id}/view?from=cctv`}
                      className='flex-1 px-3 py-2 text-sm font-medium text-[var(--color-primary-strong)] border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2'
                    >
                      <Eye className='w-4 h-4' />
                      Lihat
                    </Link>
                    {user.role === RoleName.ADMINISTRATOR && (
                      <>
                        <Link
                          href={`/dashboard/cctv/${camera.id}/edit`}
                          className='px-3 py-2 text-sm font-medium text-[var(--color-primary-strong)] border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center'
                        >
                          <Edit className='w-4 h-4' />
                        </Link>
                        <button
                          onClick={() => {
                            setSelectedCamera(camera);
                            setDeleteModalOpen(true);
                          }}
                          className='px-3 py-2 text-sm font-medium text-red-600 border border-[var(--color-border)] rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Modal */}
      {selectedCamera && (
        <CCTVDeleteModal
          camera={selectedCamera}
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedCamera(null);
          }}
          onSuccess={() => {
            setDeleteModalOpen(false);
            setSelectedCamera(null);
          }}
        />
      )}
    </div>
  );
}
