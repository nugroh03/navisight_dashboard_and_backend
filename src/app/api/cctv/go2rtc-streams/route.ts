import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';
import { go2rtcFetch, Go2rtcNotConfiguredError } from '@/lib/go2rtc';

// GET /api/cctv/go2rtc-streams - Daftar nama stream yang terdaftar di go2rtc,
// untuk pilihan "Nama Stream go2rtc" di form kamera (khusus ADMINISTRATOR).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user.role as string) !== 'ADMINISTRATOR') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const response = await go2rtcFetch('/api/streams');
    if (!response.ok) {
      console.error(`go2rtc streams list failed: HTTP ${response.status}`);
      return NextResponse.json(
        { message: 'Gagal mengambil daftar stream go2rtc' },
        { status: 502 }
      );
    }

    const streams = (await response.json()) as Record<string, unknown>;
    const names = Object.keys(streams ?? {}).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );

    return NextResponse.json(names);
  } catch (error) {
    if (error instanceof Go2rtcNotConfiguredError) {
      return NextResponse.json(
        { message: 'Live view belum tersedia' },
        { status: 503 }
      );
    }
    console.error('Error fetching go2rtc streams:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
