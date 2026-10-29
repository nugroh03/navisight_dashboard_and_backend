import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';
import { findAccessibleCamera } from '@/lib/camera-access';

const GO2RTC_TIMEOUT_MS = 10_000;

// POST /api/cctv/[id]/webrtc - Signaling WebRTC: teruskan SDP offer browser ke
// go2rtc (jaringan internal) dan kembalikan SDP answer. Browser tidak pernah
// mengakses API go2rtc langsung; kredensial go2rtc hanya ada di server.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const { camera } = await findAccessibleCamera(session.user.email, id);

    if (!camera) {
      return NextResponse.json(
        { message: 'Camera not found' },
        { status: 404 }
      );
    }

    if (!camera.go2rtcStream) {
      return NextResponse.json(
        { message: 'Live view belum dikonfigurasi untuk kamera ini' },
        { status: 404 }
      );
    }

    const go2rtcUrl = process.env.GO2RTC_URL;
    if (!go2rtcUrl) {
      console.error('GO2RTC_URL is not configured');
      return NextResponse.json(
        { message: 'Live view belum tersedia' },
        { status: 503 }
      );
    }

    const offer = await request.text();
    if (!offer.startsWith('v=0')) {
      return NextResponse.json(
        { message: 'Invalid SDP offer' },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/sdp',
    };
    const apiUser = process.env.GO2RTC_API_USER;
    const apiPass = process.env.GO2RTC_API_PASS;
    if (apiUser && apiPass) {
      headers.Authorization = `Basic ${Buffer.from(
        `${apiUser}:${apiPass}`
      ).toString('base64')}`;
    }

    const response = await fetch(
      `${go2rtcUrl.replace(/\/$/, '')}/api/webrtc?src=${encodeURIComponent(
        camera.go2rtcStream
      )}`,
      {
        method: 'POST',
        headers,
        body: offer,
        cache: 'no-store',
        signal: AbortSignal.timeout(GO2RTC_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      console.error(
        `go2rtc signaling failed for ${camera.go2rtcStream}: HTTP ${response.status}`
      );
      return NextResponse.json(
        { message: 'Gagal menghubungkan ke server live view' },
        { status: 502 }
      );
    }

    const answer = await response.text();

    return new NextResponse(answer, {
      status: 200,
      headers: {
        'Content-Type': 'application/sdp',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error('Error in WebRTC signaling:', error);
    return NextResponse.json(
      {
        message: isTimeout
          ? 'Server live view tidak merespons'
          : 'Internal server error',
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
