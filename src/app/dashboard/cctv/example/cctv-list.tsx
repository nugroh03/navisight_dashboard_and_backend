'use client';

import { useState } from 'react';
import { Plus, Search, Camera, Wifi, WifiOff, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useCCTV } from '@/hooks/use-cctv';
import { RoleName } from '@prisma/client';
import type { CCTV } from '@/types';
import { CCTVListProps } from '@/types';
import Link from 'next/link';
import { CCTVDeleteModal } from './cctv-delete-modal';
import { CCTVCard } from './cctv-card';

export function CCTVList({ user }: CCTVListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<CCTV | null>(null);

  const { data: cameras, isLoading, error } = useCCTV();

  const filteredCameras =
    cameras?.filter((camera: CCTV) => {
      const matchesSearch =
        camera.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        camera.location?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'ALL' || camera.status === statusFilter;
      const matchesProject =
        projectFilter === 'ALL' || camera.projectId === projectFilter;
      const matchesLocation =
        locationFilter === 'ALL' || camera.location === locationFilter;
      return (
        matchesSearch && matchesStatus && matchesProject && matchesLocation
      );
    }) || [];

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
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
      {/* Header Actions */}
      <div className='flex flex-col sm:flex-row gap-4 justify-between'>
        <div className='flex-1 max-w-md'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
            <Input
              placeholder='Search cameras...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='pl-10'
            />
          </div>
        </div>

        <div className='flex gap-2'>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className='px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm'
          >
            <option value='ALL'>All Status</option>
            <option value='ONLINE'>Online</option>
            <option value='OFFLINE'>Offline</option>
            <option value='MAINTENANCE'>Maintenance</option>
          </select>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className='px-3 py-2 border border-input bg-background text-foreground rounded-md text-sm'
          >
            <option value='ALL'>All Projects</option>
            {/* TODO: Load projects dynamically */}
          </select>

          {user.role === RoleName.ADMINISTRATOR && (
            <Link href='/cctv/add'>
              <Button>
                <Plus className='mr-2 h-4 w-4' />
                Add Camera
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Cameras Grid */}
      {filteredCameras.length === 0 ? (
        <div className='text-center py-12'>
          <div className='w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4'>
            <Camera className='h-12 w-12 text-muted-foreground' />
          </div>
          <h3 className='text-lg font-medium mb-2'>No cameras found</h3>
          <p className='text-muted-foreground mb-4'>
            {searchTerm || statusFilter !== 'ALL' || projectFilter !== 'ALL'
              ? 'No cameras match your search criteria.'
              : 'Get started by adding your first camera.'}
          </p>
          {user.role === RoleName.ADMINISTRATOR &&
            !searchTerm &&
            statusFilter === 'ALL' &&
            projectFilter === 'ALL' && (
              <Link href='/cctv/add'>
                <Button>
                  <Plus className='mr-2 h-4 w-4' />
                  Add Camera
                </Button>
              </Link>
            )}
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {filteredCameras.map((camera: CCTV) => (
            <CCTVCard
              key={camera.id}
              camera={camera}
              userRole={user.role}
              onDeleteRequest={(selected) => {
                setSelectedCamera(selected);
                setDeleteModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Summary Stats */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <Card className='border border-border'>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-2'>
              <div className='w-8 h-8 bg-green-100 rounded-full flex items-center justify-center'>
                <Wifi className='h-4 w-4 text-green-600' />
              </div>
              <div>
                <p className='text-sm text-muted-foreground'>Online</p>
                <p className='text-lg font-semibold'>
                  {cameras?.filter((c: CCTV) => c.status === 'ONLINE').length ||
                    0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='border border-border'>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-2'>
              <div className='w-8 h-8 bg-red-100 rounded-full flex items-center justify-center'>
                <WifiOff className='h-4 w-4 text-red-600' />
              </div>
              <div>
                <p className='text-sm text-muted-foreground'>Offline</p>
                <p className='text-lg font-semibold'>
                  {cameras?.filter((c: CCTV) => c.status === 'OFFLINE')
                    .length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='border border-border'>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-2'>
              <div className='w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center'>
                <Settings className='h-4 w-4 text-yellow-600' />
              </div>
              <div>
                <p className='text-sm text-muted-foreground'>Maintenance</p>
                <p className='text-lg font-semibold'>
                  {cameras?.filter((c: CCTV) => c.status === 'MAINTENANCE')
                    .length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='border border-border'>
          <CardContent className='p-4'>
            <div className='flex items-center space-x-2'>
              <div className='w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center'>
                <Camera className='h-4 w-4 text-blue-600' />
              </div>
              <div>
                <p className='text-sm text-muted-foreground'>Total</p>
                <p className='text-lg font-semibold'>{cameras?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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

// Lightweight live preview for camera cards
function CameraPreview({
  url,
  cameraId,
  status,
}: {
  url?: string | null;
  cameraId: string;
  status: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!url || status !== 'ONLINE') {
    return (
      <div className='w-full h-full flex items-center justify-center bg-muted'>
        <div className='text-center'>
          <Camera className='h-8 w-8 text-muted-foreground mx-auto mb-2' />
          <p className='text-sm text-muted-foreground'>
            Camera {status.toLowerCase()}
          </p>
        </div>
      </div>
    );
  }

  // Detect if stream is MJPEG and use proxy if needed
  const isMjpeg =
    /mjpg|mjpeg|faststream\.jpg|video\.cgi|action=stream|mjpegstream/i.test(
      url
    );
  // For card preview, prefer snapshot (single JPEG) to avoid long-lived connections
  const displayUrl = isMjpeg ? `/api/cctv/${cameraId}/snapshot` : url;

  return (
    <div className='relative w-full h-full bg-black'>
      {isMjpeg ? (
        // Snapshot preview for MJPEG
        <img
          src={`${displayUrl}?t=${Date.now()}`}
          alt='CCTV Preview'
          className='w-full h-full object-cover'
          onLoad={() => setLoading(false)}
          onError={() => {
            setError('Preview unavailable');
            setLoading(false);
          }}
        />
      ) : (
        // Generic preview using <iframe>
        <iframe
          src={displayUrl}
          className='w-full h-full'
          allow='autoplay; fullscreen; picture-in-picture'
          allowFullScreen
          loading='lazy'
          onLoad={() => setLoading(false)}
          onError={() => {
            setError('Preview unavailable');
            setLoading(false);
          }}
        />
      )}

      {/* Loading overlay */}
      {loading && !error && (
        <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white'>
          <Loader2 className='h-6 w-6 animate-spin mb-2' />
          <span className='text-xs'>Loading preview...</span>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs'>
          {error}
        </div>
      )}
    </div>
  );
}
