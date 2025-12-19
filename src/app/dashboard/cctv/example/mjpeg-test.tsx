'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export function MJPEGTest() {
  const [url, setUrl] = useState(
    'http://218.219.214.248:50000/nphMotionJpeg?Resolution=640x480'
  );
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [testMethod, setTestMethod] = useState<'img' | 'iframe' | 'fetch'>(
    'img'
  );
  const imgRef = useRef<HTMLImageElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const testWithImage = () => {
    setStatus('loading');
    setErrorMessage('');

    const img = new Image();

    img.onload = () => {
      setStatus('success');
      if (imgRef.current) {
        imgRef.current.src = img.src;
      }
    };

    img.onerror = (e) => {
      setStatus('error');
      setErrorMessage(
        'Failed to load image. This could be due to CORS policy or network issues.'
      );
      console.error('Image load error:', e);
    };

    // Try with timestamp to prevent caching
    const separator = url.includes('?') ? '&' : '?';
    img.src = `${url}${separator}t=${Date.now()}`;
  };

  const testWithIframe = () => {
    setStatus('loading');
    setErrorMessage('');

    if (iframeRef.current) {
      iframeRef.current.onload = () => {
        setStatus('success');
      };

      iframeRef.current.onerror = () => {
        setStatus('error');
        setErrorMessage('Failed to load in iframe.');
      };

      iframeRef.current.src = url;
    }
  };

  const testWithFetch = async () => {
    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
      });

      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(`Fetch failed: ${error}`);
      console.error('Fetch error:', error);
    }
  };

  const runTest = () => {
    switch (testMethod) {
      case 'img':
        testWithImage();
        break;
      case 'iframe':
        testWithIframe();
        break;
      case 'fetch':
        testWithFetch();
        break;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'loading':
        return (
          <Badge className='bg-blue-100 text-blue-800'>
            <RefreshCw className='w-3 h-3 mr-1 animate-spin' />
            Testing...
          </Badge>
        );
      case 'success':
        return (
          <Badge className='bg-green-100 text-green-800'>
            <CheckCircle className='w-3 h-3 mr-1' />
            Success
          </Badge>
        );
      case 'error':
        return (
          <Badge className='bg-red-100 text-red-800'>
            <AlertCircle className='w-3 h-3 mr-1' />
            Error
          </Badge>
        );
      default:
        return (
          <Badge className='bg-gray-100 text-gray-800'>Ready to test</Badge>
        );
    }
  };

  return (
    <Card className='w-full max-w-4xl mx-auto'>
      <CardHeader>
        <CardTitle>MJPEG Stream Tester</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <label className='text-sm font-medium'>MJPEG URL:</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder='Enter MJPEG stream URL'
          />
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium'>Test Method:</label>
          <div className='flex gap-2'>
            <Button
              variant={testMethod === 'img' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setTestMethod('img')}
            >
              Image Element
            </Button>
            <Button
              variant={testMethod === 'iframe' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setTestMethod('iframe')}
            >
              Iframe
            </Button>
            <Button
              variant={testMethod === 'fetch' ? 'default' : 'outline'}
              size='sm'
              onClick={() => setTestMethod('fetch')}
            >
              Fetch API
            </Button>
          </div>
        </div>

        <div className='flex items-center gap-4'>
          <Button onClick={runTest} disabled={status === 'loading'}>
            {status === 'loading' ? 'Testing...' : 'Test Stream'}
          </Button>
          {getStatusBadge()}
        </div>

        {errorMessage && (
          <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
            <p className='text-sm text-red-800'>{errorMessage}</p>
          </div>
        )}

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {/* Image Test Result */}
          <div className='space-y-2'>
            <h3 className='text-sm font-medium'>Image Element Test:</h3>
            <div className='border rounded-md p-2 bg-gray-50 min-h-[200px] flex items-center justify-center'>
              <img
                ref={imgRef}
                alt='MJPEG Stream'
                className='max-w-full max-h-[180px] object-contain'
                style={{
                  display:
                    status === 'success' && testMethod === 'img'
                      ? 'block'
                      : 'none',
                }}
              />
              {(status !== 'success' || testMethod !== 'img') && (
                <p className='text-gray-500 text-sm'>No image loaded</p>
              )}
            </div>
          </div>

          {/* Iframe Test Result */}
          <div className='space-y-2'>
            <h3 className='text-sm font-medium'>Iframe Test:</h3>
            <div className='border rounded-md overflow-hidden'>
              <iframe
                ref={iframeRef}
                className='w-full h-[200px]'
                style={{
                  display:
                    status === 'success' && testMethod === 'iframe'
                      ? 'block'
                      : 'none',
                }}
                title='MJPEG Stream'
              />
              {(status !== 'success' || testMethod !== 'iframe') && (
                <div className='h-[200px] bg-gray-50 flex items-center justify-center'>
                  <p className='text-gray-500 text-sm'>No iframe content</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='bg-blue-50 border border-blue-200 rounded-md p-4'>
          <h3 className='text-sm font-medium text-blue-800 mb-2'>
            💡 Troubleshooting Tips:
          </h3>
          <ul className='text-sm text-blue-700 space-y-1'>
            <li>
              • <strong>CORS Error:</strong> The camera server doesnt allow
              cross-origin requests
            </li>
            <li>
              • <strong>Network Error:</strong> Check if the URL is accessible
              from your network
            </li>
            <li>
              • <strong>Authentication:</strong> Some cameras require
              authentication headers
            </li>
            <li>
              • <strong>Format:</strong> Ensure the URL returns MJPEG format
              (multipart/x-mixed-replace)
            </li>
            <li>
              • <strong>Browser Security:</strong> Modern browsers block mixed
              content (HTTP on HTTPS sites)
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
