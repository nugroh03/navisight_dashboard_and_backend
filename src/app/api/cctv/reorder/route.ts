import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helpers';

const reorderSchema = z
  .object({
    projectId: z.string().min(1, 'Project is required'),
    orderedIds: z.array(z.string().uuid()).min(1, 'Order list is required'),
  })
  .refine((data) => new Set(data.orderedIds).size === data.orderedIds.length, {
    message: 'Duplicate camera ids',
  });

// PATCH /api/cctv/reorder - Reorder CCTV cameras within a project (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);

    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await request.json();
    const validatedData = reorderSchema.parse(body);
    const { projectId, orderedIds } = validatedData;

    const projectAccess = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: authResult.user.id,
      },
      select: { id: true },
    });

    if (!projectAccess) {
      return NextResponse.json(
        { message: 'Access denied to this project' },
        { status: 403 }
      );
    }

    const totalCameras = await prisma.camera.count({
      where: { projectId },
    });

    if (orderedIds.length !== totalCameras) {
      return NextResponse.json(
        { message: 'Order list must include all cameras in the project' },
        { status: 400 }
      );
    }

    const cameras = await prisma.camera.findMany({
      where: {
        projectId,
        id: { in: orderedIds },
      },
      select: { id: true },
    });

    if (cameras.length !== orderedIds.length) {
      return NextResponse.json(
        { message: 'Invalid camera ids for this project' },
        { status: 400 }
      );
    }

    const updates = orderedIds.map((id, index) =>
      prisma.camera.update({
        where: { id },
        data: { sortOrder: index + 1 },
      })
    );

    await prisma.$transaction(updates);

    return NextResponse.json({ message: 'Camera order updated' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Validation error', errors: error.issues },
        { status: 400 }
      );
    }

    console.error('Error reordering CCTV cameras:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
