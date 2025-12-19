'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Maximize,
  RotateCcw,
  Loader2,
  AlertCircle,
  Camera,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCCTVCamera } from '@/hooks/use-cctv';
import { Role } from '@prisma/client';
import Link from 'next/link';
import { CCTVTroubleshoot } from './cctv-troubleshoot';

import { CCTVViewerProps } from '@/types';

export function CCTVViewer({ cameraId }: CCTVViewerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [streamType, setStreamType] = useState<
    'mjpeg' | 'hls' | 'mp4' | 'unknown'
  >('unknown');
  const { data: camera, isLoading: cameraLoading } = useCCTVCamera(cameraId);

  // Detect stream type from URL
  const detectStreamType = (
    url: string
  ): 'mjpeg' | 'hls' | 'mp4' | 'unknown' => {
    const lower = url.toLowerCase();
    // Common MJPEG patterns (various vendors)
    const looksLikeMjpeg =
      lower.includes('mjpg') ||
      lower.includes('mjpeg') ||
      lower.includes('axis-cgi/mjpg') ||
      lower.includes('cgi-bin/faststream.jpg') ||
      lower.includes('mjpegstream.cgi') ||
      lower.includes('mjpg/video.cgi') ||
      lower.includes('video.cgi') ||
      lower.includes('action=stream') ||
      (lower.endsWith('.jpg') && lower.includes('stream='));

    if (looksLikeMjpeg) return 'mjpeg';

    if (lower.endsWith('.m3u8') || lower.includes('m3u8')) return 'hls';
    if (lower.endsWith('.mp4') || lower.includes('mp4')) return 'mp4';
    return 'unknown';
  };

  const addCacheBuster = (url: string) =>
    `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;

  // Prefer internal HTTPS-safe proxy for MJPEG
  const getDisplayUrl = () => {
    if (!camera) return '';
    if (streamType === 'mjpeg') {
      const proxyUrl = `/api/cctv/${camera.id}/stream`;
      console.log(
        '[CCTV Viewer] Using MJPEG proxy:',
        proxyUrl,
        'for original URL:',
        camera.streamUrl
      );
      return proxyUrl;
    }
    return camera.streamUrl || '';
  };

  useEffect(() => {
    if (camera?.streamUrl) {
      const detectedType = detectStreamType(camera.streamUrl);
      console.log(
        '[CCTV Viewer] Stream type detected:',
        detectedType,
        'for URL:',
        camera.streamUrl
      );
      setStreamType(detectedType);
    }
  }, [camera?.streamUrl]);

  useEffect(() => {
    // Only attach video event listeners when using <video>
    if (camera?.streamUrl && videoRef.current) {
      const video = videoRef.current;

      const handleLoadStart = () => {
        setIsLoading(true);
        setHasError(false);
      };

      const handleCanPlay = () => {
        setIsLoading(false);
        setHasError(false);
      };

      const handleError = (e: Event) => {
        setIsLoading(false);
        setHasError(true);

        const target = e.target as HTMLVideoElement;
        const error = target.error;

        let message = 'Failed to load video stream.';

        if (error) {
          switch (error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              message = 'Video loading was aborted. Please try again.';
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              message =
                'Network error occurred. Check your internet connection and stream URL.';
              break;
            case MediaError.MEDIA_ERR_DECODE:
              message = 'Video format not supported or corrupted stream.';
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              message =
                'Stream URL not supported. This may be due to CORS policy or HTTPS/HTTP mixed content restrictions.';
              break;
            default:
              message = 'Unknown video error occurred.';
          }
        }

        if (camera?.streamUrl) {
          try {
            const streamUrl = new URL(camera.streamUrl);
            if (typeof window !== 'undefined') {
              const currentProtocol = window.location.protocol;
              if (
                currentProtocol === 'https:' &&
                streamUrl.protocol === 'http:'
              ) {
                message +=
                  ' Note: You are trying to load an HTTP stream on an HTTPS page, which may be blocked by your browser for security reasons.';
              }
            }
          } catch (urlError) {
            message += ' Invalid stream URL format.';
          }
        }

        setErrorMessage(message);
        console.error('Video error:', e, error);
      };

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);

      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);

      return () => {
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
      };
    }
  }, [camera?.streamUrl]);

  // MJPEG (<img>) load/error handling
  useEffect(() => {
    if (streamType === 'mjpeg' && imgRef.current && camera?.streamUrl) {
      const img = imgRef.current;
      setIsLoading(true);
      setHasError(false);

      const handleLoad = () => {
        setIsLoading(false);
        setHasError(false);
      };

      const handleError = () => {
        setIsLoading(false);
        setHasError(true);
        let message = 'Failed to load MJPEG stream.';
        try {
          if (camera.streamUrl) {
            const streamUrl = new URL(camera.streamUrl);
            if (
              typeof window !== 'undefined' &&
              window.location.protocol === 'https:' &&
              streamUrl.protocol === 'http:'
            ) {
              message +=
                ' Note: HTTP stream on an HTTPS page may be blocked by your browser (mixed content).';
            }
          }
        } catch (urlError) {
          message += ' Invalid stream URL format.';
        }
        setErrorMessage(message);
      };

      img.addEventListener('load', handleLoad);
      img.addEventListener('error', handleError);

      // Fallback: if first frame already rendered before listeners attached
      if (img.naturalWidth > 0 || img.complete) {
        setIsLoading(false);
        setHasError(false);
      }

      // Extra fallback for MJPEG: some browsers don't fire onLoad on continuous streams
      const fallbackTimer =
        typeof window !== 'undefined'
          ? window.setTimeout(() => {
              if (!hasError) {
                setIsLoading(false);
              }
            }, 1500)
          : null;

      return () => {
        img.removeEventListener('load', handleLoad);
        img.removeEventListener('error', handleError);
        if (fallbackTimer && typeof window !== 'undefined') {
          window.clearTimeout(fallbackTimer);
        }
      };
    }
  }, [streamType, camera?.streamUrl]);

  // Iframe load handling (used when not MJPEG)
  useEffect(() => {
    if (streamType !== 'mjpeg' && iframeRef.current && camera?.streamUrl) {
      const iframe = iframeRef.current;
      setIsLoading(true);
      setHasError(false);

      const handleLoad = () => {
        setIsLoading(false);
        setHasError(false);
      };

      iframe.addEventListener('load', handleLoad);
      return () => {
        iframe.removeEventListener('load', handleLoad);
      };
    }
  }, [streamType, camera?.streamUrl]);

  const togglePlay = () => {
    if (streamType === 'mjpeg') return; // No play/pause for MJPEG
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch((error) => {
          console.error('Play error:', error);
          setHasError(true);
          setErrorMessage('Failed to play video. Please try again.');
        });
      }
    }
  };

  const toggleMute = () => {
    if (streamType === 'mjpeg') return; // No audio for MJPEG
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    const el =
      containerRef.current ||
      (streamType === 'mjpeg' ? imgRef.current : iframeRef.current);
    if (el && typeof document !== 'undefined') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        el.requestFullscreen().catch((error) => {
          console.error('Fullscreen error:', error);
        });
      }
    }
  };

  const refreshStream = () => {
    if (camera?.streamUrl) {
      setIsLoading(true);
      setHasError(false);
      const url = getDisplayUrl();
      if (streamType === 'mjpeg' && imgRef.current) {
        imgRef.current.src = addCacheBuster(url);
      } else if (iframeRef.current) {
        iframeRef.current.src = addCacheBuster(url);
      }
    }
  };

  // Quick connectivity check via HEAD to our proxy
  const diagnoseStream = async () => {
    if (!camera) return;
    try {
      setIsLoading(true);
      const res = await fetch(`/api/cctv/${camera.id}/stream`, {
        method: 'HEAD',
        cache: 'no-store',
      });
      setIsLoading(false);
      if (!res.ok) {
        const upstream = res.headers.get('X-Upstream-Status');
        setHasError(true);
        setErrorMessage(
          `Stream unreachable. Proxy status ${res.status}$${
            upstream ? ` (camera status ${upstream})` : ''
          }`.replace('$$', '')
        );
      } else {
        setErrorMessage('Connection OK. Try Retry.');
      }
    } catch (e) {
      setIsLoading(false);
      setHasError(true);
      setErrorMessage('Network error while diagnosing stream.');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'default';
      case 'OFFLINE':
        return 'secondary';
      case 'MAINTENANCE':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (cameraLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='h-8 w-8 animate-spin' />
      </div>
    );
  }

  if (!camera) {
    return (
      <div className='text-center py-8'>
        <p className='text-muted-foreground'>Camera not found</p>
        <Button onClick={() => router.push('/cctv')} className='mt-4'>
          Back to CCTV List
        </Button>
      </div>
    );
  }

  return (
    <div className='max-w-6xl mx-auto space-y-6'>
      {/* Camera Info Header */}
      <Card>
        <CardHeader>
          <div className='flex items-center gap-4'>
            <Link href='/cctv'>
              <Button variant='ghost' size='icon'>
                <ArrowLeft className='h-4 w-4' />
              </Button>
            </Link>
            <div className='flex items-center gap-3 flex-1'>
              <div className='w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center'>
                <Camera className='h-5 w-5 text-blue-600' />
              </div>
              <div>
                <CardTitle>{camera.name}</CardTitle>
                <CardDescription>
                  {camera.location} • {camera.project?.name}
                </CardDescription>
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Badge variant={getStatusBadgeVariant(camera.status)}>
                {camera.status}
              </Badge>
              {/* Removed resolution/fps badge */}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Video Player */}
      <Card>
        <CardContent className='p-0'>
          <div className='relative bg-black rounded-lg overflow-hidden'>
            {/* Video Element */}
            <div className='relative aspect-video'>
              {camera.streamUrl ? (
                <>
                  {streamType === 'mjpeg' ? (
                    <img
                      ref={imgRef}
                      src={getDisplayUrl()}
                      alt={camera.name}
                      className='w-full h-full object-contain select-none'
                      onLoad={() => {
                        setIsLoading(false);
                        setHasError(false);
                      }}
                      onError={() => {
                        setIsLoading(false);
                        setHasError(true);
                        setErrorMessage('Failed to load MJPEG stream.');
                      }}
                    />
                  ) : (
                    <iframe
                      ref={iframeRef}
                      src={getDisplayUrl()}
                      title={camera.name}
                      className='w-full h-full'
                      allow='autoplay; fullscreen; picture-in-picture'
                      allowFullScreen
                      onLoad={() => {
                        setIsLoading(false);
                        setHasError(false);
                      }}
                    />
                  )}
                  {/* Loading Overlay */}
                  {isLoading && (
                    <div className='absolute inset-0 flex items-center justify-center bg-black bg-opacity-50'>
                      <div className='text-center text-white'>
                        <Loader2 className='h-8 w-8 animate-spin mx-auto mb-2' />
                        <p>Loading stream...</p>
                      </div>
                    </div>
                  )}

                  {/* Error Overlay */}
                  {hasError && (
                    <div className='absolute inset-0 flex items-center justify-center bg-black bg-opacity-75'>
                      <div className='text-center text-white max-w-md px-4'>
                        <AlertCircle className='h-12 w-12 mx-auto mb-4 text-red-400' />
                        <h3 className='text-lg font-semibold mb-2'>
                          Stream Error
                        </h3>
                        <p className='text-sm text-white/70 mb-4'>
                          {errorMessage}
                        </p>
                        <div className='flex gap-2 justify-center'>
                          <Button
                            onClick={refreshStream}
                            variant='outline'
                            size='sm'
                          >
                            <RotateCcw className='h-4 w-4 mr-2' />
                            Retry
                          </Button>
                          <Button
                            onClick={diagnoseStream}
                            variant='outline'
                            size='sm'
                          >
                            <Settings className='h-4 w-4 mr-2' />
                            Diagnose
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className='absolute inset-0 flex items-center justify-center bg-gray-900'>
                  <div className='text-center text-white'>
                    <Camera className='h-12 w-12 mx-auto mb-4 text-white/40' />
                    <h3 className='text-lg font-semibold mb-2'>
                      No Stream URL
                    </h3>
                    <p className='text-sm text-white/60'>
                      This camera doesn have a configured stream URL
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Video Controls */}
            {camera.streamUrl && (
              <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4'>
                <div className='flex items-center justify-end'>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={refreshStream}
                      className='text-white hover:bg-white/20'
                    >
                      <RotateCcw className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={toggleFullscreen}
                      className='text-white hover:bg-white/20'
                      disabled={hasError}
                    >
                      <Maximize className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Camera & Stream Details */}
      <div className='grid grid-cols-1 gap-6'>
        <Card>
          <CardHeader>
            <CardTitle>Camera & Stream Information</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-3 text-sm'>
              <div>
                <p className='text-muted-foreground'>Type URL/Stream</p>
                <div className='mt-1'>
                  <Badge variant='outline'>{streamType.toUpperCase()}</Badge>
                </div>
              </div>
              <div>
                <p className='text-muted-foreground'>Stream URL</p>
                <p className='font-mono text-xs bg-muted p-2 rounded break-all'>
                  {camera.streamUrl || 'Not configured'}
                </p>
              </div>
              {camera.description && (
                <div>
                  <p className='text-muted-foreground text-sm'>Description</p>
                  <p className='text-sm'>{camera.description}</p>
                </div>
              )}
              <div>
                <p className='text-muted-foreground'>Status</p>
                <Badge variant={getStatusBadgeVariant(camera.status)}>
                  {camera.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Troubleshoot Modal */}
      {showTroubleshoot && camera && (
        <CCTVTroubleshoot
          camera={{
            id: camera.id,
            name: camera.name,
            streamUrl: camera.streamUrl || '',
            status: camera.status as 'online' | 'offline' | 'maintenance',
            location: camera.location || undefined,
            project: camera.project
              ? {
                  id: camera.project.id,
                  name: camera.project.name,
                }
              : undefined,
          }}
          onClose={() => setShowTroubleshoot(false)}
        />
      )}
    </div>
  );
}
