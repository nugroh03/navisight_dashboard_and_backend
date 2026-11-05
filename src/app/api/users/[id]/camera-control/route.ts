import { authOptions } from '@/auth/config';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({ enabled: z.boolean() });

// PATCH /api/users/[id]/camera-control - Administrator memberi atau mencabut
// izin kontrol kamera (PTZ, mic, dengarkan) untuk user CLIENT.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMINISTRATOR') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Data tidak valid' },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const target = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true, role: { select: { name: true } } },
    });

    if (!target) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Hanya CLIENT: akses kamera CLIENT dibatasi project-nya.
    if (target.role?.name !== 'CLIENT') {
      return NextResponse.json(
        { message: 'Izin kontrol kamera hanya untuk user Client.' },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { canControlCamera: parsed.data.enabled },
    });

    console.info(
      `[USER] ${session.user.email} ${parsed.data.enabled ? 'memberi' : 'mencabut'} izin kontrol kamera ${target.email}`
    );
    return NextResponse.json({ ok: true, canControlCamera: parsed.data.enabled });
  } catch (error) {
    console.error('Error updating camera control permission:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
