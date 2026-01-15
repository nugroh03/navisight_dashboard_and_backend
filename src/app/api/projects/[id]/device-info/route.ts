import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';

/**
 * GET /api/projects/[id]/device-info
 * Get device information for a project (dashboard only)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Get user ID
    let userId = session.user.id;
    if (!userId) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      userId = user.id;
    }

    // Check if user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        projectUsers: {
          some: {
            userId: userId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        deviceId: true,
        lastReportedAt: true,
        lastLat: true,
        lastLng: true,
        projectUsers: {
          where: {
            user: {
              deletedAt: null,
            },
          },
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                accountType: true,
              },
            },
            role: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      deviceId: project.deviceId,
      isConnected: !!project.deviceId,
      lastReportedAt: project.lastReportedAt,
      lastPosition:
        project.lastLat && project.lastLng
          ? {
              latitude: project.lastLat,
              longitude: project.lastLng,
            }
          : null,
      connectedUsers: project.projectUsers.map((pu) => ({
        id: pu.user.id,
        name: pu.user.name,
        email: pu.user.email,
        accountType: pu.user.accountType,
        role: pu.role,
      })),
    });
  } catch (error) {
    console.error('Error fetching device info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
