import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';
import { prisma } from '@/lib/prisma';
import { updateCCTVSchema } from '@/lib/validations';
import { findAccessibleCamera } from '@/lib/camera-access';
import { resolveCameraStatus } from '@/lib/camera-status';
import { z } from 'zod';

// GET /api/cctv/[id] - Get single CCTV camera
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Termasuk cek akses project (CLIENT/ADMINISTRATOR hanya kamera di project-nya)
    const { user, camera } = await findAccessibleCamera(
      session.user.email,
      id
    );

    if (!camera) {
      return NextResponse.json(
        { message: 'Camera not found' },
        { status: 404 }
      );
    }

    const isAdmin = user?.role?.name === 'ADMINISTRATOR';

    // Transform to match CCTV interface
    const transformedCamera = {
      id: camera.id,
      name: camera.name || 'Unnamed Camera',
      description: camera.description,
      location: camera.location,
      projectId: camera.projectId,
      streamUrl: isAdmin ? camera.urlCamera : camera.urlCamera, // Still send URL for streaming, but hide in UI for non-admin
      status: await resolveCameraStatus(camera),
      sortOrder: camera.sortOrder,
      go2rtcStream: camera.go2rtcStream,
      isapiHost: isAdmin ? camera.isapiHost : undefined,
      ptzEnabled: camera.ptzEnabled,
      audioEnabled: camera.audioEnabled,
      project: camera.project,
      createdAt: camera.createdAt,
      updatedAt: camera.updatedAt,
    };

    return NextResponse.json(transformedCamera);
  } catch (error) {
    console.error('Error fetching CCTV camera:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/cctv/[id] - Update CCTV camera
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user.role as string) !== 'ADMINISTRATOR') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const validatedData = updateCCTVSchema.parse(body);
    const isAdmin = (session.user.role as string) === 'ADMINISTRATOR';

    // Check if camera exists
    const existingCamera = await prisma.camera.findUnique({
      where: { id },
    });

    if (!existingCamera) {
      return NextResponse.json(
        { message: 'Camera not found' },
        { status: 404 }
      );
    }

    // If projectId is being updated, verify it exists
    if (validatedData.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: validatedData.projectId },
      });

      if (!project) {
        return NextResponse.json(
          { message: 'Project not found' },
          { status: 404 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined)
      updateData.description = validatedData.description;
    if (validatedData.location !== undefined)
      updateData.location = validatedData.location;
    if (validatedData.streamUrl !== undefined)
      updateData.urlCamera = validatedData.streamUrl;
    if (validatedData.status !== undefined)
      updateData.status = validatedData.status;
    if (validatedData.projectId !== undefined)
      updateData.projectId = validatedData.projectId;
    // Field live view hanya dari ADMINISTRATOR; selain itu diabaikan.
    if (isAdmin) {
      if (validatedData.go2rtcStream !== undefined)
        updateData.go2rtcStream = validatedData.go2rtcStream || null;
      if (validatedData.isapiHost !== undefined)
        updateData.isapiHost = validatedData.isapiHost || null;
      if (validatedData.ptzEnabled !== undefined)
        updateData.ptzEnabled = validatedData.ptzEnabled;
      if (validatedData.audioEnabled !== undefined)
        updateData.audioEnabled = validatedData.audioEnabled;
    }

    const camera = await prisma.camera.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Transform to match CCTV interface
    const transformedCamera = {
      id: camera.id,
      name: camera.name || 'Unnamed Camera',
      description: camera.description,
      location: camera.location,
      projectId: camera.projectId,
      streamUrl: camera.urlCamera,
      status: (camera.status || 'OFFLINE') as
        | 'ONLINE'
        | 'OFFLINE'
        | 'MAINTENANCE',
      sortOrder: camera.sortOrder,
      go2rtcStream: camera.go2rtcStream,
      isapiHost: isAdmin ? camera.isapiHost : undefined,
      ptzEnabled: camera.ptzEnabled,
      audioEnabled: camera.audioEnabled,
      project: camera.project,
      createdAt: camera.createdAt,
      updatedAt: camera.updatedAt,
    };

    return NextResponse.json(transformedCamera);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Validation error', errors: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating CCTV camera:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/cctv/[id] - Delete CCTV camera
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if ((session.user.role as string) !== 'ADMINISTRATOR') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    // Check if camera exists
    const existingCamera = await prisma.camera.findUnique({
      where: { id },
    });

    if (!existingCamera) {
      return NextResponse.json(
        { message: 'Camera not found' },
        { status: 404 }
      );
    }

    await prisma.camera.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Camera deleted successfully' });
  } catch (error) {
    console.error('Error deleting CCTV camera:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
