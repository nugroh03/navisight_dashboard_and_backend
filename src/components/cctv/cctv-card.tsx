'use client';

import { useEffect, useRef, useState } from 'react';
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
import Hls from 'hls.js';
import { detectStreamType, type StreamType } from '@/lib/stream-utils';

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
              <Camera
                className={
                  isCompact ? 'h-5 w-5 text-primary' : 'h-6 w-6 text-primary'
                }
              />
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
              isCompact ? 'aspect-video min-h-30' : 'aspect-video'
            }`}
            style={{ position: 'relative' }}
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
              <MapPin className='w-4 h-4 shrink-0' />
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

          {showActions && (
            <div
              className={`flex flex-wrap gap-2 border-t border-border pt-2 ${
                isCompact ? 'mt-2' : 'mt-3'
              }`}
            >
              <Link
                href={`/dashboard/cctv/${camera.id}/view`}
                className='flex-1 min-w-22.5'
              >
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
                <Link href={`/dashboard/cctv/${camera.id}/view`}>
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
                  <Link href={`/dashboard/cctv/${camera.id}/edit`}>
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
  const [streamType, setStreamType] = useState<StreamType>('iframe');
  const [reloadKey, setReloadKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [timestamp] = useState(() => Date.now());

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

  useEffect(() => {
    const nextType = detectStreamType(url);
    setStreamType(nextType);
    setError(null);
    setLoading(true);
    setReloadKey((prev) => prev + 1);
  }, [url]);

  const isMjpeg = streamType === 'mjpeg';
  const isHls = streamType === 'hls';
  const displayUrl = isHls ? `/api/cctv/${cameraId}/stream` : url;

  useEffect(() => {
    if (streamType !== 'hls' || !displayUrl) {
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
      setError('HLS tidak didukung browser ini.');
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
  }, [displayUrl, streamType, reloadKey]);

  // Some CCTV endpoints render an HTML page with its own margins/scrollbars.
  // We can't style inside a cross-origin iframe, so we slightly overscan the
  // iframe within an overflow-hidden container to hide any scrollbars.
  const iframeOverscanPx = 20;

  return (
    <div className='relative w-full h-full bg-black overflow-hidden'>
      {streamType === 'hls' ? (
        <video
          key={`hls-preview-${reloadKey}`}
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
          key={`iframe-preview-${reloadKey}`}
          src={displayUrl}
          className='border-0 absolute'
          style={{
            top: -iframeOverscanPx / 2,
            left: -iframeOverscanPx / 2,
            width: `calc(100% + ${iframeOverscanPx}px)`,
            height: `calc(100% + ${iframeOverscanPx}px)`,
            overflow: 'hidden',
            margin: 0,
            padding: 0,
            display: 'block',
          }}
          allow='autoplay; fullscreen; picture-in-picture'
          allowFullScreen
          loading='lazy'
          scrolling='no'
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
