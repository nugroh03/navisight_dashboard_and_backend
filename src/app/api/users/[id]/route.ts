import { authOptions } from '@/auth/config';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const allowedRoles = ['CLIENT', 'WORKER'] as const;

const updateUserSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(allowedRoles).optional(),
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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: routeParamId } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminOrClient(session)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const normalizedParamId =
      routeParamId && routeParamId !== 'undefined' && routeParamId !== 'null'
        ? routeParamId
        : undefined;
    const userId = normalizedParamId ?? parsed.data.id;
    if (!userId) {
      return NextResponse.json(
        { message: 'User id is required.' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        role: { select: { name: true } },
        projectUsers: { select: { projectId: true } },
      },
    });

    if (!existingUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // CLIENT hanya bisa update user dengan role WORKER
    if (isClient(session) && existingUser.role?.name !== 'WORKER') {
      return NextResponse.json(
        { message: 'Client hanya dapat mengelola user dengan role Worker.' },
        { status: 403 }
      );
    }

    const nextRole = parsed.data.role ?? existingUser.role?.name;
    if (
      !nextRole ||
      !allowedRoles.includes(nextRole as (typeof allowedRoles)[number])
    ) {
      return NextResponse.json(
        { message: 'Role tidak valid untuk user ini.' },
        { status: 400 }
      );
    }

    // CLIENT tidak bisa mengubah role
    if (
      isClient(session) &&
      parsed.data.role &&
      parsed.data.role !== existingUser.role?.name
    ) {
      return NextResponse.json(
        { message: 'Client tidak dapat mengubah role user.' },
        { status: 403 }
      );
    }

    const desiredProjectIds = parsed.data.projectIds
      ? Array.from(new Set(parsed.data.projectIds.filter((id) => id)))
      : existingUser.projectUsers.map((pu) => pu.projectId);

    if (nextRole === 'WORKER' && desiredProjectIds.length > 1) {
      return NextResponse.json(
        { message: 'Worker hanya boleh memiliki 1 project.' },
        { status: 400 }
      );
    }

    if (parsed.data.projectIds && desiredProjectIds.length > 0) {
      const projects = await prisma.project.findMany({
        where: { id: { in: desiredProjectIds }, deletedAt: null },
        select: { id: true },
      });
      if (projects.length !== desiredProjectIds.length) {
        return NextResponse.json(
          { message: 'Project tidak valid atau sudah dihapus.' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, any> = {};
    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name.trim()
        ? parsed.data.name.trim()
        : null;
    }
    if (parsed.data.email) {
      updateData.email = parsed.data.email;
    }
    if (parsed.data.password) {
      updateData.passwordHash = await hash(parsed.data.password, 10);
    }

    if (parsed.data.role) {
      const roleRecord = await prisma.role.findFirst({
        where: { name: parsed.data.role },
        select: { id: true },
      });
      if (!roleRecord) {
        return NextResponse.json(
          { message: 'Role tidak ditemukan.' },
          { status: 400 }
        );
      }
      updateData.roleId = roleRecord.id;
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: updateData,
        });
      }

      if (parsed.data.projectIds) {
        const existingProjectIds = existingUser.projectUsers.map(
          (pu) => pu.projectId
        );
        const toRemove = existingProjectIds.filter(
          (projectId) => !desiredProjectIds.includes(projectId)
        );
        const toAdd = desiredProjectIds.filter(
          (projectId) => !existingProjectIds.includes(projectId)
        );

        if (toRemove.length > 0) {
          await tx.projectUser.deleteMany({
            where: { userId: existingUser.id, projectId: { in: toRemove } },
          });
        }

        if (toAdd.length > 0) {
          await tx.projectUser.createMany({
            data: toAdd.map((projectId) => ({
              projectId,
              userId: existingUser.id,
              role: 'MEMBER',
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    return NextResponse.json({ message: 'User updated' });
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
    console.error('Error updating user:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: routeParamId } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminOrClient(session)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const userId = routeParamId;
    if (!userId) {
      return NextResponse.json(
        { message: 'User id is required.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        role: { name: { in: [...allowedRoles] } },
      },
      select: { id: true, role: { select: { name: true } } },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // CLIENT hanya bisa delete user dengan role WORKER
    if (isClient(session) && user.role?.name !== 'WORKER') {
      return NextResponse.json(
        { message: 'Client hanya dapat menghapus user dengan role Worker.' },
        { status: 403 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
