import { authOptions } from '@/auth/config';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const allowedRoles = ['CLIENT', 'WORKER'] as const;
type AllowedRole = (typeof allowedRoles)[number];

const EMAIL_DOMAIN = 'translautjatim.com';

const normalizeEmailInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const localPart = trimmed.split('@')[0].trim();
  return localPart ? `${localPart}@${EMAIL_DOMAIN}` : '';
};

const emailSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => normalizeEmailInput(value))
  .refine((value) => z.string().email().safeParse(value).success, {
    message: 'Format email tidak valid.',
  });

const createUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: emailSchema,
  password: z.string().min(6),
  role: z.enum(allowedRoles),
  projectIds: z.array(z.string().uuid()).optional(),
});

function isAdmin(session: Session | null) {
  return session?.user?.role === 'ADMINISTRATOR';
}

function isClient(session: Session | null) {
  return session?.user?.role === 'CLIENT';
}

function isAdminOrClient(session: Session | null) {
  return isAdmin(session) || isClient(session);
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminOrClient(session)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // CLIENT hanya bisa melihat user dengan role WORKER
    // ADMINISTRATOR bisa melihat semua user (CLIENT & WORKER)
    const roleFilter: AllowedRole[] = isClient(session)
      ? (['WORKER'] as AllowedRole[])
      : [...allowedRoles];

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        role: { name: { in: roleFilter } },
      },
      include: {
        role: { select: { name: true } },
        projectUsers: {
          where: { project: { deletedAt: null } },
          include: { project: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const payload = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name ?? null,
      projects: user.projectUsers.map((pu) => pu.project),
    }));

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminOrClient(session)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password, role, projectIds } = parsed.data;

    // CLIENT hanya bisa create user dengan role WORKER
    if (isClient(session) && role !== 'WORKER') {
      return NextResponse.json(
        { message: 'Client hanya dapat membuat user dengan role Worker.' },
        { status: 403 }
      );
    }

    const uniqueProjectIds = Array.from(
      new Set((projectIds ?? []).filter((id) => id))
    );

    if (role === 'WORKER' && uniqueProjectIds.length > 1) {
      return NextResponse.json(
        { message: 'Worker hanya boleh memiliki 1 project.' },
        { status: 400 }
      );
    }

    const roleRecord = await prisma.role.findFirst({
      where: { name: role },
      select: { id: true },
    });
    if (!roleRecord) {
      return NextResponse.json(
        { message: 'Role tidak ditemukan.' },
        { status: 400 }
      );
    }

    if (uniqueProjectIds.length > 0) {
      const projects = await prisma.project.findMany({
        where: { id: { in: uniqueProjectIds }, deletedAt: null },
        select: { id: true },
      });
      if (projects.length !== uniqueProjectIds.length) {
        return NextResponse.json(
          { message: 'Project tidak valid atau sudah dihapus.' },
          { status: 400 }
        );
      }
    }

    const passwordHash = await hash(password, 10);

    // Tentukan accountType berdasarkan role
    // CLIENT = EXTERNAL_CUSTOMER (mobile only)
    // WORKER = INTERNAL_STAFF (bisa mobile + dashboard)
    const accountType =
      role === 'CLIENT' ? 'EXTERNAL_CUSTOMER' : 'INTERNAL_STAFF';
    const canAccessDashboard = role === 'WORKER'; // Worker bisa dashboard, Client tidak
    const canAccessMobile = true; // Semua user bisa mobile

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name?.trim() ? name.trim() : null,
          email,
          passwordHash,
          roleId: roleRecord.id,
          accountType,
          canAccessDashboard,
          canAccessMobile,
        },
      });

      if (uniqueProjectIds.length > 0) {
        await tx.projectUser.createMany({
          data: uniqueProjectIds.map((projectId) => ({
            projectId,
            userId: user.id,
            role: 'MEMBER',
          })),
          skipDuplicates: true,
        });
      }

      return user;
    });

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { message: 'Email sudah digunakan.' },
        { status: 409 }
      );
    }
    if (error?.code === 'P2003') {
      return NextResponse.json(
        { message: 'Project tidak valid atau tidak ditemukan.' },
        { status: 400 }
      );
    }
    console.error('Error creating user:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
