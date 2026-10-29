import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';
import { findAccessibleCamera } from '@/lib/camera-access';
import { go2rtcFetch, Go2rtcNotConfiguredError } from '@/lib/go2rtc';

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

    const offer = await request.text();
    if (!offer.startsWith('v=0')) {
      return NextResponse.json(
        { message: 'Invalid SDP offer' },
        { status: 400 }
      );
    }

    const response = await go2rtcFetch(
      `/api/webrtc?src=${encodeURIComponent(camera.go2rtcStream)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer,
      }
    );

    if (response.status === 404) {
      // Nama stream tidak ada di konfigurasi go2rtc: tidak akan pulih dengan mencoba ulang.
      return NextResponse.json(
        {
          message: `Stream "${camera.go2rtcStream}" tidak ditemukan di go2rtc`,
        },
        { status: 404 }
      );
    }

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
    if (error instanceof Go2rtcNotConfiguredError) {
      console.error(error.message);
      return NextResponse.json(
        { message: 'Live view belum tersedia' },
        { status: 503 }
      );
    }
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
