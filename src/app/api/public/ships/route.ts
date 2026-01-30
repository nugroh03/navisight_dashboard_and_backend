import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetch all active projects (ships)
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        lastLat: true,
        lastLng: true,
        lastSpeedKn: true,
        lastHeadingDeg: true,
        lastReportedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching public ships:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
