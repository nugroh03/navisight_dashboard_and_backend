import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-helpers';

const connectSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  deviceId: z.string().min(1, 'Device ID is required').max(255),
});

/**
 * POST /api/mobile/projects/connect
 * Connect mobile device to a project and return full project details
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Mobile Connect] Request received');

    const authResult = await requireAuth(req);

    if ('error' in authResult) {
      console.log('[Mobile Connect] Auth failed:', authResult.error);
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    console.log('[Mobile Connect] User authenticated:', user.email);

    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log('[Mobile Connect] Body parsed:', body);
    } catch (error) {
      console.error('[Mobile Connect] JSON parse error:', error);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validation = connectSchema.safeParse(body);

    if (!validation.success) {
      console.log(
        '[Mobile Connect] Validation failed:',
        validation.error.flatten().fieldErrors
      );
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { projectId, deviceId } = validation.data;
    console.log('[Mobile Connect] Connecting device:', { projectId, deviceId });

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
      console.log('[Mobile Connect] Project not found or access denied');
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    console.log(
      '[Mobile Connect] User has access to project:',
      projectUser.project.name
    );

    // Check if device ID is already used by another project
    const existingProject = await prisma.project.findFirst({
      where: {
        deviceId,
        id: { not: projectId },
        deletedAt: null,
      },
    });

    if (existingProject) {
      console.log(
        '[Mobile Connect] Device already connected to another project'
      );
      return NextResponse.json(
        {
          error: 'Device already connected',
          message: 'This device is already registered to another project',
        },
        { status: 409 }
      );
    }

    // Update project with device ID
    console.log('[Mobile Connect] Updating project with deviceId...');
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { deviceId },
      select: {
        id: true,
        name: true,
        deviceId: true,
        lastLat: true,
        lastLng: true,
        lastSpeedKn: true,
        lastHeadingDeg: true,
        lastReportedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('[Mobile Connect] Device connected successfully');

    return NextResponse.json(
      {
        success: true,
        message: 'Device connected successfully',
        project: updatedProject,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Mobile Connect] Error:', error);
    if (error instanceof Error) {
      console.error('[Mobile Connect] Error message:', error.message);
      console.error('[Mobile Connect] Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
