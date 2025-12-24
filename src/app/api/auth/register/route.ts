import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json(
      { message: 'Email sudah terdaftar' },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, 10);

  // Set default values untuk akun baru
  // INTERNAL_STAFF dengan akses ke dashboard dan mobile
  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      accountType: 'INTERNAL_STAFF',
      canAccessDashboard: true,
      canAccessMobile: true,
    },
  });

  return NextResponse.json({ message: 'Registrasi berhasil' });
}
