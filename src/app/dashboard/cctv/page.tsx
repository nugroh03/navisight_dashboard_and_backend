'use client';

import { useEffect, useRef, useState } from 'react';
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
  MapPin,
  Building2,
} from 'lucide-react';
import { useCCTV } from '@/hooks/use-cctv';
import { useProjects } from '@/hooks/use-projects';
import { RoleName } from '@prisma/client';
import type { CCTV } from '@/types';
import Link from 'next/link';
import { CCTVDeleteModal } from '@/components/cctv/cctv-delete-modal';
import { useSession } from 'next-auth/react';
import Hls from 'hls.js';
import { detectStreamType, type StreamType } from '@/lib/stream-utils';

const STATUS_VARIANTS = {
  ONLINE: {
    label: 'Online',
    icon: Wifi,
    badgeClass:
      'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm',
    dotClass: 'bg-emerald-400',
    previewRing: 'ring-1 ring-emerald-200/80',
  },
  OFFLINE: {
    label: 'Offline',
    icon: WifiOff,
    badgeClass:
      'bg-red-50 text-red-700 border border-red-200 shadow-sm text-red-600',
    dotClass: 'bg-red-400',
    previewRing: 'ring-1 ring-red-200/70',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    icon: Settings,
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm',
    dotClass: 'bg-amber-400',
    previewRing: 'ring-1 ring-amber-200/70',
  },
  UNKNOWN: {
    label: 'Unknown',
    icon: Camera,
    badgeClass: 'bg-gray-100 text-gray-600 border border-gray-200 shadow-sm',
    dotClass: 'bg-gray-400',
    previewRing: 'ring-1 ring-gray-200/70',
  },
} as const;

type StatusKey = keyof typeof STATUS_VARIANTS;

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
  const isWorker = user.role === RoleName.WORKER;

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
            {/* Project Filter Dropdown (hidden for worker) */}
            {!isWorker && (
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
            )}

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
            const variant =
              STATUS_VARIANTS[camera.status as StatusKey] ||
              STATUS_VARIANTS.UNKNOWN;
            const StatusIcon = variant.icon;

            return (
              <article
                key={camera.id}
                className='card p-0 overflow-hidden flex flex-col'
              >
                {/* Camera Preview */}
                <div
                  className={`relative bg-gray-900 aspect-video overflow-hidden ${variant.previewRing}`}
                >
                  {camera.status === 'ONLINE' && camera.streamUrl ? (
                    <CameraPreview
                      cameraId={camera.id}
                      url={camera.streamUrl}
                    />
                  ) : (
                    <div className='absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900/80 to-slate-800 text-white px-8 text-center'>
                      <Camera className='h-12 w-12 opacity-60 mb-3' />
                      <p className='text-sm font-medium tracking-wide'>
                        Kamera {variant.label.toLowerCase()}
                      </p>
                      <span className='mt-1 text-xs text-white/70'>
                        {camera.location || 'Belum ada lokasi terdaftar'}
                      </span>
                    </div>
                  )}

                  <div className='absolute top-3 left-3 flex flex-wrap gap-2'>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${variant.badgeClass}`}
                    >
                      <StatusIcon className='w-4 h-4' />
                      {variant.label}
                    </span>
                    {camera.project?.name && (
                      <span className='inline-flex items-center rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur'>
                        {camera.project.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Camera Info */}
                <div className='p-5 space-y-5 flex flex-col flex-1'>
                  <div className='flex items-start gap-3'>
                    <div className='w-12 h-12 bg-[var(--color-primary)]/8 rounded-2xl flex items-center justify-center text-[var(--color-primary-strong)] shrink-0'>
                      <Camera className='h-5 w-5' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <h3 className='font-semibold text-[var(--color-text)] text-lg break-words'>
                        {camera.name}
                      </h3>
                      <p className='text-sm text-[var(--color-muted)]'>
                        {camera.description || 'Tidak ada deskripsi'}
                      </p>
                    </div>
                  </div>

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm'>
                    <div className='rounded-2xl border border-[var(--color-border)] bg-slate-50 p-3 flex items-start gap-3'>
                      <MapPin className='h-4 w-4 text-[var(--color-primary-strong)] mt-1' />
                      <div>
                        <p className='text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]'>
                          Lokasi
                        </p>
                        <p className='font-semibold text-[var(--color-text)] leading-snug'>
                          {camera.location || 'Lokasi tidak diset'}
                        </p>
                      </div>
                    </div>
                    <div className='rounded-2xl border border-[var(--color-border)] bg-slate-50 p-3 flex items-start gap-3'>
                      <Building2 className='h-4 w-4 text-[var(--color-primary-strong)] mt-1' />
                      <div>
                        <p className='text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]'>
                          Project
                        </p>
                        <p className='font-semibold text-[var(--color-text)] leading-snug'>
                          {camera.project?.name || 'Belum ditetapkan'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className='mt-auto flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 md:flex-row md:items-center md:justify-between'>
                    <Link
                      href={`/dashboard/cctv/${camera.id}/view?from=cctv`}
                      className='inline-flex w-full md:flex-1 items-center justify-center gap-2 rounded-full border border-[var(--color-primary-strong)]/40 bg-[var(--color-primary-strong)]/10 px-4 py-2 text-sm font-semibold text-[var(--color-primary-strong)] transition hover:bg-[var(--color-primary-strong)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-strong)]/30'
                    >
                      <Eye className='w-4 h-4' />
                      Lihat
                    </Link>

                    {user.role === RoleName.ADMINISTRATOR && (
                      <div className='flex items-center gap-2'>
                        <Link
                          href={`/dashboard/cctv/${camera.id}/edit`}
                          className='h-10 w-10 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-primary-strong)] transition hover:border-[var(--color-primary-strong)] hover:bg-[var(--color-primary-strong)]/10'
                        >
                          <Edit className='w-4 h-4' />
                        </Link>
                        <button
                          onClick={() => {
                            setSelectedCamera(camera);
                            setDeleteModalOpen(true);
                          }}
                          className='h-10 w-10 rounded-full border border-red-200 text-red-600 transition hover:bg-red-50 flex items-center justify-center'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
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

type PreviewProps = {
  url?: string | null;
  cameraId: string;
};

function CameraPreview({ url, cameraId }: PreviewProps) {
  const [streamType, setStreamType] = useState<StreamType>('iframe');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [timestamp] = useState(() => Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const nextType = detectStreamType(url);
    setStreamType(nextType);
    setLoading(true);
    setError(null);
    setReloadKey((prev) => prev + 1);
  }, [url]);

  const isHls = streamType === 'hls';
  const isMjpeg = streamType === 'mjpeg';
  const displayUrl = isHls ? `/api/cctv/${cameraId}/stream` : url || '';

  useEffect(() => {
    if (!isHls || !displayUrl) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };

    const nativeSupport =
      video.canPlayType('application/vnd.apple.mpegurl') ||
      video.canPlayType('application/x-mpegurl');

    if (!Hls.isSupported() && nativeSupport !== 'probably') {
      setError('HLS tidak didukung di browser ini.');
      setLoading(false);
      return cleanup;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;
      hls.attachMedia(video);
      hls.loadSource(displayUrl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video
          .play()
          .then(() => {
            setLoading(false);
            setError(null);
          })
          .catch(() => {
            setLoading(false);
            setError('Tidak dapat memutar HLS.');
          });
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        setError('Gagal memuat HLS.');
        if (data?.fatal && hlsRef.current) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hlsRef.current.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hlsRef.current.recoverMediaError();
              break;
            default:
              hlsRef.current.destroy();
              hlsRef.current = null;
          }
        }
      });
      return cleanup;
    }

    if (nativeSupport === 'probably') {
      video.src = displayUrl;
      video
        .play()
        .then(() => {
          setLoading(false);
          setError(null);
        })
        .catch(() => {
          setLoading(false);
          setError('Tidak dapat memutar HLS.');
        });
      return cleanup;
    }

    return cleanup;
  }, [displayUrl, isHls, reloadKey]);

  return (
    <div className='absolute inset-0 bg-black'>
      {isHls ? (
        <video
          key={`hls-card-${reloadKey}`}
          ref={videoRef}
          className='w-full h-full object-cover'
          muted
          playsInline
          autoPlay
          controls={false}
          crossOrigin='anonymous'
          onLoadedData={() => setLoading(false)}
          onError={() => {
            setError('Tidak dapat memutar HLS.');
            setLoading(false);
          }}
        />
      ) : isMjpeg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${displayUrl}?t=${timestamp}`}
          alt='Preview'
          className='w-full h-full object-cover'
          onLoad={() => setLoading(false)}
          onError={() => {
            setError('Gagal memuat preview.');
            setLoading(false);
          }}
        />
      ) : (
        <iframe
          key={`iframe-card-${reloadKey}`}
          src={displayUrl}
          className='w-full h-full border-0'
          allow='autoplay; fullscreen; picture-in-picture'
          allowFullScreen
          loading='lazy'
          onLoad={() => setLoading(false)}
          onError={() => {
            setError('Gagal memuat preview.');
            setLoading(false);
          }}
        />
      )}

      {loading && !error && (
        <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white text-xs gap-2'>
          <span className='h-4 w-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin'></span>
          <span>Loading preview...</span>
        </div>
      )}

      {error && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/60 text-white text-xs px-3 text-center'>
          {error}
        </div>
      )}
    </div>
  );
}
