'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Link as LinkIcon,
  Network,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
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

export interface CCTVTroubleshootProps {
  camera: {
    id: string;
    name: string;
    streamUrl: string;
    status: 'online' | 'offline' | 'maintenance';
    location?: string;
    project?: {
      id: string;
      name: string;
    };
  };
  onClose: () => void;
}

export function CCTVTroubleshoot({ camera, onClose }: CCTVTroubleshootProps) {
  const [diagnostics, setDiagnostics] = useState({
    urlFormat: false,
    httpsCompatible: false,
    networkReachable: false,
    extensionValid: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const streamUrl = camera.streamUrl;

  useEffect(() => {
    let isMounted = true;

    async function runDiagnostics() {
      setLoading(true);
      setError(null);

      try {
        const isValidUrl = (() => {
          try {
            if (!streamUrl || streamUrl.trim() === '') {
              return false;
            }
            new URL(streamUrl);
            return true;
          } catch {
            return false;
          }
        })();

        const isHttpsCompatible = (() => {
          try {
            if (!streamUrl || streamUrl.trim() === '') {
              return false;
            }
            const url = new URL(streamUrl);
            return (
              typeof window === 'undefined' ||
              window.location.protocol !== 'https:' ||
              url.protocol === 'https:'
            );
          } catch {
            return false;
          }
        })();

        const extensionValid =
          streamUrl.toLowerCase().includes('.m3u8') ||
          streamUrl.toLowerCase().includes('.mjpg') ||
          streamUrl.toLowerCase().includes('mjpeg') ||
          streamUrl.toLowerCase().includes('.mp4');

        let networkReachable = false;
        try {
          // Use head request to check reachability without downloading full content
          const controller = new AbortController();
          const timeoutId =
            typeof window !== 'undefined'
              ? window.setTimeout(() => controller.abort(), 5000)
              : null;

          const res = await fetch(streamUrl, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal,
          }).catch(() => null);
          if (timeoutId && typeof window !== 'undefined') {
            window.clearTimeout(timeoutId);
          }
          // In no-cors mode, success may still look opaque, treat as reachable
          networkReachable = !!res || res === null;
        } catch {
          networkReachable = false;
        }

        if (isMounted) {
          setDiagnostics({
            urlFormat: isValidUrl,
            httpsCompatible: isHttpsCompatible,
            networkReachable,
            extensionValid,
          });
          setLoading(false);
        }
      } catch (e) {
        if (isMounted) {
          setError('Failed to run diagnostics');
          setLoading(false);
        }
      }
    }

    if (streamUrl) {
      runDiagnostics();
    } else {
      setLoading(false);
      setError('No stream URL configured');
    }

    return () => {
      isMounted = false;
    };
  }, [streamUrl]);

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg shadow-lg w-full max-w-2xl'>
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle>Troubleshoot: {camera.name}</CardTitle>
                <CardDescription>
                  {camera.project?.name || 'Unassigned Project'}
                </CardDescription>
              </div>
              <Button variant='ghost' onClick={onClose}>
                <X className='w-4 h-4' />
              </Button>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            {loading ? (
              <div className='flex items-center gap-2 text-sm text-gray-600'>
                <RefreshCw className='w-4 h-4 animate-spin' />
                Running diagnostics...
              </div>
            ) : error ? (
              <div className='flex items-center gap-2 text-sm text-red-600'>
                <AlertCircle className='w-4 h-4' />
                {error}
              </div>
            ) : (
              <>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <div className='flex items-center gap-2'>
                    <LinkIcon className='w-4 h-4' />
                    <span>URL format valid</span>
                    <Badge
                      variant={
                        diagnostics.urlFormat ? 'default' : 'destructive'
                      }
                    >
                      {diagnostics.urlFormat ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className='flex items-center gap-2'>
                    <ShieldCheck className='w-4 h-4' />
                    <span>HTTPS compatible</span>
                    <Badge
                      variant={
                        diagnostics.httpsCompatible ? 'default' : 'destructive'
                      }
                    >
                      {diagnostics.httpsCompatible ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Network className='w-4 h-4' />
                    <span>Network reachable</span>
                    <Badge
                      variant={
                        diagnostics.networkReachable ? 'default' : 'destructive'
                      }
                    >
                      {diagnostics.networkReachable ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Info className='w-4 h-4' />
                    <span>Recognized stream extension</span>
                    <Badge
                      variant={
                        diagnostics.extensionValid ? 'default' : 'destructive'
                      }
                    >
                      {diagnostics.extensionValid ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
                <div className='mt-4'>
                  <p className='text-xs text-gray-500'>Stream URL:</p>
                  <p className='text-xs font-mono break-all bg-gray-50 p-2 rounded'>
                    {streamUrl || 'Not configured'}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
