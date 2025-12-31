import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';
import { prisma } from '@/lib/prisma';
import { detectStreamType } from '@/lib/stream-utils';
import { getPublicOrigin } from '@/lib/http';

const HLS_MIME = 'application/vnd.apple.mpegurl';

const rewritePlaylistUrls = (
  playlist: string,
  baseUrl: URL,
  request: NextRequest,
  cameraId: string
) => {
  const origin = getPublicOrigin(request);
  const proxyBase = `${origin}/api/cctv/${cameraId}/stream`;
  const lines = playlist.split(/\r?\n/);

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return line;
      }

      if (trimmed.startsWith('#')) {
        if (!line.includes('URI="')) {
          return line;
        }

        return line.replace(/URI="([^"]+)"/gi, (_, uri) => {
          try {
            const rewritten = new URL(uri, baseUrl);
            return `URI="${proxyBase}?resource=${encodeURIComponent(
              rewritten.toString()
            )}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }

      try {
        const resourceUrl = new URL(trimmed, baseUrl);
        return `${proxyBase}?resource=${encodeURIComponent(
          resourceUrl.toString()
        )}`;
      } catch {
        return line;
      }
    })
    .join('\n');
};

type SupportedMethods = 'GET' | 'HEAD';

const proxyHlsStream = async (
  request: NextRequest,
  cameraId: string,
  streamUrl: string,
  method: SupportedMethods
) => {
  const baseUrl = new URL(streamUrl);
  const resourceParam = request.nextUrl.searchParams.get('resource');

  let targetUrl: URL;
  try {
    targetUrl = resourceParam ? new URL(resourceParam) : baseUrl;
  } catch {
    return NextResponse.json(
      { message: 'Invalid resource parameter' },
      { status: 400 }
    );
  }

  if (targetUrl.origin !== baseUrl.origin) {
    return NextResponse.json(
      { message: 'Resource host mismatch' },
      { status: 400 }
    );
  }

  const headers = new Headers({
    'User-Agent': 'Navisight-CCTV-Proxy/1.0',
    'Accept': targetUrl.pathname.toLowerCase().endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl,application/x-mpegurl,*/*;q=0.1'
      : '*/*',
    'Referer': `${baseUrl.origin}/`,
    'Origin': baseUrl.origin,
  });

  const upstream = await fetch(targetUrl.toString(), {
    method,
    headers,
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Cache-Control', 'no-store');
  responseHeaders.set('X-Upstream-Status', `${upstream.status}`);

  if (method === 'HEAD') {
    return new NextResponse(null, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  if (!upstream.ok) {
    const errorBody = await upstream.text().catch(() => 'Upstream error');
    return new NextResponse(errorBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  const contentType =
    upstream.headers.get('content-type') || 'application/octet-stream';
  const shouldRewrite =
    targetUrl.pathname.toLowerCase().endsWith('.m3u8') ||
    contentType.toLowerCase().includes('mpegurl');

  if (shouldRewrite) {
    const playlist = await upstream.text();
    const hasExtM3u = playlist.trimStart().toUpperCase().startsWith('#EXTM3U');

    if (!hasExtM3u) {
      responseHeaders.set('Content-Type', 'text/plain');
      const preview = playlist.slice(0, 200);
      return new NextResponse(
        `Upstream returned invalid HLS manifest (missing #EXTM3U).\n` +
          `Status: ${upstream.status}\n` +
          `Body (first 200 chars): ${preview}`,
        {
          status: 502,
          headers: responseHeaders,
        }
      );
    }

    const rewritten = rewritePlaylistUrls(
      playlist,
      targetUrl,
      request,
      cameraId
    );
    responseHeaders.set('Content-Type', HLS_MIME);
    return new NextResponse(rewritten, {
      status: 200,
      headers: responseHeaders,
    });
  }

  if (!upstream.body) {
    const fallbackBuffer = await upstream.arrayBuffer();
    responseHeaders.set('Content-Type', contentType);
    return new NextResponse(fallbackBuffer, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  responseHeaders.set('Content-Type', contentType);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
};

const handleRequest = async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  method: SupportedMethods
) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const camera = await prisma.camera.findUnique({
      where: { id },
      select: { urlCamera: true },
    });

    if (!camera?.urlCamera) {
      return NextResponse.json(
        { message: 'Stream URL not configured' },
        { status: 404 }
      );
    }

    const streamType = detectStreamType(camera.urlCamera);

    if (streamType !== 'hls') {
      return NextResponse.json(
        { message: 'Stream proxy is only available for HLS sources.' },
        { status: 400 }
      );
    }

    return proxyHlsStream(request, id, camera.urlCamera, method);
  } catch (error) {
    console.error('Error proxying CCTV stream:', error);
    return NextResponse.json(
      { message: 'Unable to proxy CCTV stream' },
      { status: 502 }
    );
  }
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleRequest(request, context, 'GET');
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleRequest(request, context, 'HEAD');
}
