import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-helpers';

const connectDeviceSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  deviceId: z.string().min(1, 'Device ID is required').max(255),
});

/**
 * POST /api/mobile/projects/connect-device
 * Connect mobile device to a project
 * Requires: Bearer token authentication
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);

    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validation = connectDeviceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { projectId, deviceId } = validation.data;

    // Check if user has access to this project
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: user.id,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!projectUser || projectUser.project.deletedAt) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Check if device ID is already used by another project
    const existingProject = await prisma.project.findFirst({
      where: {
        deviceId,
        id: { not: projectId },
        deletedAt: null,
      },
    });

    if (existingProject) {
      return NextResponse.json(
        {
          error: 'Device ID already connected to another project',
          message: 'This device is already registered to a different project',
        },
        { status: 409 }
      );
    }

    // Update project with device ID
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { deviceId },
      select: {
        id: true,
        name: true,
        deviceId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Device connected successfully',
        project: updatedProject,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error connecting device:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
