import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth-helpers';

const paramsSchema = z.object({
  id: z.string().uuid('Invalid project ID'),
});

/**
 * GET /api/projects/[id]/position-reports
 * Returns the latest 10 position reports for the project (only for members)
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const parsedParams = paramsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { message: parsedParams.error.issues[0]?.message ?? 'Invalid project' },
        { status: 400 }
      );
    }

    const projectId = parsedParams.data.id;

    // Ensure the user belongs to the project and it's not deleted
    const membership = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: user.id,
        project: { deletedAt: null },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json(
        { message: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    const reports = await prisma.positionReport.findMany({
      where: { projectId },
      orderBy: { reportedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        reportedAt: true,
        latitude: true,
        longitude: true,
        speedKn: true,
        headingDeg: true,
      },
    });

    return NextResponse.json(reports);
  } catch (error) {
    console.error('[Position Reports] Error fetching reports:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
