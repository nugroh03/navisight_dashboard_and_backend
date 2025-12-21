import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';
import { prisma } from '@/lib/prisma';
import { createCCTVSchema } from '@/lib/validations';
import { z } from 'zod';

// GET /api/cctv - Get all CCTV cameras
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Get current user with their projects
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        role: true,
        projectUsers: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!currentUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    const roleName = currentUser.role?.name as string | undefined;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const projectIdFilter = searchParams.get('projectId');

    // Build where clause based on user role
    const whereClause: any = {};

    // If user is CLIENT, ADMINISTRATOR, or WORKER, only show cameras from their projects
    if (roleName === 'CLIENT' || roleName === 'ADMINISTRATOR' || roleName === 'WORKER') {
      const userProjectIds = currentUser.projectUsers.map((pu) => pu.projectId);

      if (userProjectIds.length === 0) {
        // User has no projects, return empty array
        return NextResponse.json([]);
      }

      whereClause.projectId = {
        in: userProjectIds,
      };

      // If projectId filter is provided, further filter
      if (projectIdFilter) {
        // Check if user has access to this project
        if (userProjectIds.includes(projectIdFilter)) {
          whereClause.projectId = projectIdFilter;
        } else {
          // User doesn't have access to this project
          return NextResponse.json(
            { message: 'Access denied to this project' },
            { status: 403 }
          );
        }
      }
    }

    const cameras = await prisma.camera.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform to match CCTV interface
    const transformedCameras = cameras.map((camera) => ({
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
      project: camera.project,
      createdAt: camera.createdAt,
      updatedAt: camera.updatedAt,
    }));

    return NextResponse.json(transformedCameras);
  } catch (error) {
    console.error('Error fetching CCTV cameras:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/cctv - Create new CCTV camera
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createCCTVSchema.parse(body);

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: validatedData.projectId },
    });

    if (!project) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      );
    }

    const camera = await prisma.camera.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        location: validatedData.location,
        urlCamera: validatedData.streamUrl,
        status: validatedData.status,
        projectId: validatedData.projectId,
      },
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
      project: camera.project,
      createdAt: camera.createdAt,
      updatedAt: camera.updatedAt,
    };

    return NextResponse.json(transformedCamera, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Validation error', errors: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating CCTV camera:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
