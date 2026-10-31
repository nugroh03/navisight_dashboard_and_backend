import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';
import { findAccessibleCamera } from '@/lib/camera-access';
import { go2rtcFetch, Go2rtcNotConfiguredError } from '@/lib/go2rtc';

// POST /api/cctv/[id]/talk - Signaling WebRTC untuk bicara ke speaker kamera.
// Memakai stream terpisah "<go2rtcStream>_talk" (sumber isapi:// di go2rtc VPS)
// yang namanya ditentukan server, sehingga penonton biasa tidak bisa mengirim suara.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user.role as string) !== 'ADMINISTRATOR') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const { camera } = await findAccessibleCamera(session.user.email, id);

    if (!camera) {
      return NextResponse.json(
        { message: 'Camera not found' },
        { status: 404 }
      );
    }

    if (!camera.audioEnabled || !camera.go2rtcStream) {
      return NextResponse.json(
        { message: 'Audio tidak diaktifkan untuk kamera ini' },
        { status: 400 }
      );
    }

    const offer = await request.text();
    if (!offer.startsWith('v=0')) {
      return NextResponse.json(
        { message: 'Invalid SDP offer' },
        { status: 400 }
      );
    }

    const stream = `${camera.go2rtcStream}_talk`;
    const response = await go2rtcFetch(
      `/api/webrtc?src=${encodeURIComponent(stream)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offer,
      }
    );

    if (response.status === 404) {
      return NextResponse.json(
        { message: `Stream "${stream}" tidak ditemukan di go2rtc` },
        { status: 404 }
      );
    }

    if (!response.ok) {
      console.error(`go2rtc talk failed for ${stream}: HTTP ${response.status}`);
      return NextResponse.json(
        { message: 'Gagal menyambungkan audio ke kamera' },
        { status: 502 }
      );
    }

    console.info(`[TALK] ${session.user.email} start camera=${camera.id}`);

    return new NextResponse(await response.text(), {
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
        { message: 'Audio belum tersedia' },
        { status: 503 }
      );
    }
    const isTimeout =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error('Error in talk signaling:', error);
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
