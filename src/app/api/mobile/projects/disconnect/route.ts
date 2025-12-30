import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-helpers';

const disconnectSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

/**
 * POST /api/mobile/projects/disconnect
 * Disconnect mobile device from a project (set deviceId to null)
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Mobile Disconnect] Request received');

    const authResult = await requireAuth(req);

    if ('error' in authResult) {
      console.log('[Mobile Disconnect] Auth failed:', authResult.error);
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    console.log('[Mobile Disconnect] User authenticated:', user.email);

    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log('[Mobile Disconnect] Body parsed:', body);
    } catch (error) {
      console.error('[Mobile Disconnect] JSON parse error:', error);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validation = disconnectSchema.safeParse(body);

    if (!validation.success) {
      console.log(
        '[Mobile Disconnect] Validation failed:',
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

    const { projectId } = validation.data;
    console.log('[Mobile Disconnect] Disconnecting from project:', projectId);

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
            deviceId: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!projectUser || projectUser.project.deletedAt) {
      console.log('[Mobile Disconnect] Project not found or access denied');
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    console.log(
      '[Mobile Disconnect] User has access to project:',
      projectUser.project.name
    );

    // Check if project has a device connected
    if (!projectUser.project.deviceId) {
      console.log('[Mobile Disconnect] No device connected to this project');
      return NextResponse.json(
        {
          error: 'No device connected',
          message: 'This project does not have a connected device',
        },
        { status: 400 }
      );
    }

    // Disconnect device (set deviceId to null)
    console.log('[Mobile Disconnect] Setting deviceId to null...');
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { deviceId: null },
      select: {
        id: true,
        name: true,
        deviceId: true,
        updatedAt: true,
      },
    });

    console.log('[Mobile Disconnect] Device disconnected successfully');

    return NextResponse.json(
      {
        success: true,
        message: 'Device disconnected successfully',
        project: updatedProject,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Mobile Disconnect] Error:', error);
    if (error instanceof Error) {
      console.error('[Mobile Disconnect] Error message:', error.message);
      console.error('[Mobile Disconnect] Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
