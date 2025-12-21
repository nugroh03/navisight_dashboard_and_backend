import { authOptions } from '@/auth/config';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Get current user with their role and projects
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
    let projects;

    // ADMINISTRATOR and CLIENT can only see their projects
    if (roleName === 'ADMINISTRATOR' || roleName === 'CLIENT') {
      const userProjectIds = currentUser.projectUsers.map((pu) => pu.projectId);

      if (userProjectIds.length === 0) {
        return NextResponse.json([]);
      }

      projects = await prisma.project.findMany({
        where: {
          deletedAt: null,
          id: { in: userProjectIds },
        },
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching project options:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
