import { authOptions } from '@/auth/config';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const resetSchema = z.object({
  password: z.string().min(8, 'Password minimal 8 karakter').max(72),
});

// POST /api/users/[id]/reset-password - Administrator mengganti password user lain
export async function POST(
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

    const parsed = resetSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
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

    // Password Administrator diganti lewat halaman profil, dengan password lama.
    if (target.role?.name === 'ADMINISTRATOR') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await hash(parsed.data.password, 10) },
    });

    console.info(
      `[USER] ${session.user.email} mereset password ${target.email}`
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
