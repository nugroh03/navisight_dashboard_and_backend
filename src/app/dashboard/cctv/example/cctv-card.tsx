'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Camera,
  MapPin,
  Wifi,
  WifiOff,
  Settings,
  Eye,
  Play,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';
import type { CCTV } from '@/types';
import { RoleName } from '@prisma/client';

interface CCTVCardProps {
  camera: CCTV;
  userRole?: RoleName;
  onDeleteRequest?: (camera: CCTV) => void;
  showActions?: boolean;
  variant?: 'default' | 'compact';
  className?: string;
}

const statusBadgeClass =
  'text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-medium';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ONLINE':
      return (
        <Badge className={`${statusBadgeClass} bg-green-100 text-green-700`}>
          <Wifi className='w-3 h-3' />
          Online
        </Badge>
      );
    case 'OFFLINE':
      return (
        <Badge className={`${statusBadgeClass} bg-red-100 text-red-700`}>
          <WifiOff className='w-3 h-3' />
          Offline
        </Badge>
      );
    case 'MAINTENANCE':
      return (
        <Badge className={`${statusBadgeClass} bg-yellow-100 text-yellow-700`}>
          <Settings className='w-3 h-3' />
          Maintenance
        </Badge>
      );
    default:
      return (
        <Badge variant='outline' className={statusBadgeClass}>
          {status}
        </Badge>
      );
  }
};

export function CCTVCard({
  camera,
  userRole,
  onDeleteRequest,
  showActions = true,
  variant = 'default',
  className = '',
}: CCTVCardProps) {
  const isCompact = variant === 'compact';

  return (
    <Card
      className={`border border-border transition-shadow ${
        isCompact ? 'shadow-sm hover:shadow-md' : 'hover:shadow-lg'
      } ${className}`}
    >
      <CardHeader className={isCompact ? 'px-3 pt-3 pb-2' : undefined}>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex items-center space-x-3'>
            <div
              className={`bg-primary/10 rounded-full flex items-center justify-center ${
                isCompact ? 'w-10 h-10' : 'w-12 h-12'
              }`}
            >
              <Camera className={isCompact ? 'h-5 w-5 text-primary' : 'h-6 w-6 text-primary'} />
            </div>
            <div>
              <CardTitle className={isCompact ? 'text-base' : 'text-lg'}>
                {camera.name}
              </CardTitle>
              <CardDescription className={isCompact ? 'text-xs' : undefined}>
                {camera.description || 'No description'}
              </CardDescription>
            </div>
          </div>
          {getStatusBadge(camera.status)}
        </div>
      </CardHeader>

      <CardContent className={isCompact ? 'px-3 pb-3 pt-0' : undefined}>
        <div className='space-y-3'>
          <div
            className={`bg-muted rounded-lg overflow-hidden flex items-center justify-center ${
              isCompact ? 'aspect-video min-h-[120px]' : 'aspect-video'
            }`}
          >
            <CameraPreview
              url={camera.streamUrl}
              cameraId={camera.id}
              status={camera.status}
            />
          </div>

          <div className='space-y-2'>
            <div
              className={`flex items-center space-x-2 text-muted-foreground ${
                isCompact ? 'text-xs' : 'text-sm'
              }`}
            >
              <MapPin className='w-4 h-4 flex-shrink-0' />
              <span className='truncate'>
                {camera.location || 'Location not set'}
              </span>
            </div>

            <div className={`${isCompact ? 'text-xs' : 'text-sm'}`}>
              <p className='text-muted-foreground'>Project</p>
              <p className='font-medium text-foreground'>
                {camera.project?.name || 'Unassigned'}
              </p>
            </div>
          </div>

          <div className={`${isCompact ? 'text-xs' : 'text-sm'}`}>
            <p className='text-muted-foreground'>Last Activity</p>
            <p className='font-medium text-foreground'>
              {camera.lastActivity
                ? new Date(camera.lastActivity).toLocaleString()
                : 'Never'}
            </p>
          </div>

          {showActions && (
            <div
              className={`flex flex-wrap gap-2 border-t border-border pt-2 ${
                isCompact ? 'mt-2' : 'mt-3'
              }`}
            >
              <Link href={`/cctv/${camera.id}/view`} className='flex-1 min-w-[90px]'>
                <Button
                  variant='outline'
                  size='sm'
                  className={`w-full ${isCompact ? 'h-8 text-xs px-2' : ''}`}
                >
                  <Eye className='w-4 h-4 mr-1' />
                  View
                </Button>
              </Link>
              {camera.status === 'ONLINE' && camera.streamUrl && (
                <Link href={`/cctv/${camera.id}/view`}>
                  <Button
                    variant='outline'
                    size='sm'
                    className={isCompact ? 'h-8 text-xs px-2' : undefined}
                  >
                    <Play className='w-4 h-4 mr-1' />
                    Live
                  </Button>
                </Link>
              )}
              {userRole === RoleName.ADMINISTRATOR && (
                <>
                  <Link href={`/cctv/${camera.id}/edit`}>
                    <Button
                      variant='outline'
                      size='sm'
                      className={isCompact ? 'h-8 w-8' : undefined}
                    >
                      <Edit className='w-4 h-4' />
                    </Button>
                  </Link>
                  <Button
                    variant='outline'
                    size='sm'
                    className={isCompact ? 'h-8 w-8' : undefined}
                    onClick={() => onDeleteRequest?.(camera)}
                  >
                    <Trash2 className='w-4 h-4' />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface CameraPreviewProps {
  url?: string | null;
  cameraId: string;
  status: string;
}

function CameraPreview({ url, cameraId, status }: CameraPreviewProps) {
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

  const isMjpeg =
    /mjpg|mjpeg|faststream\.jpg|video\.cgi|action=stream|mjpegstream/i.test(
      url
    );
  const displayUrl = isMjpeg ? `/api/cctv/${cameraId}/snapshot` : url;

  return (
    <div className='relative w-full h-full bg-black'>
      {isMjpeg ? (
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

      {loading && !error && (
        <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white'>
          <Loader2 className='h-6 w-6 animate-spin mb-2' />
          <span className='text-xs'>Loading preview...</span>
        </div>
      )}

      {error && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs'>
          {error}
        </div>
      )}
    </div>
  );
}
