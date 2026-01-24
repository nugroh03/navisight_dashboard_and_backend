import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const GPS_API_KEY = process.env.GPS_API_KEY;

const updateLocationSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).optional().default(0),
  heading: z.number().min(0).max(360).optional().default(0),
});

function getRequestApiKey(req: NextRequest): string | null {
  const headerKey = req.headers.get('x-api-key');

  if (headerKey) {
    return headerKey.trim();
  }

  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    return null;
  }

  if (authHeader.toLowerCase().startsWith('apikey ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * POST /api/location-update
 * Update project location from GPS device (API key auth)
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Update Location] Request received');

    if (!GPS_API_KEY) {
      console.error('[Update Location] GPS_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 },
      );
    }

    const providedApiKey = getRequestApiKey(req);

    if (!providedApiKey || providedApiKey !== GPS_API_KEY) {
      console.log('[Update Location] API key invalid');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log('[Update Location] Body parsed:', body);
    } catch (error) {
      console.error('[Update Location] JSON parse error:', error);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    const validation = updateLocationSchema.safeParse(body);

    if (!validation.success) {
      console.log(
        '[Update Location] Validation failed:',
        validation.error.flatten().fieldErrors,
      );
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { projectId, latitude, longitude, speed, heading } = validation.data;
    console.log('[Update Location] Updating location for project:', projectId);

    // Ensure project exists and is active
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        deviceId: true,
        deletedAt: true,
      },
    });

    if (!project) {
      console.log('[Update Location] Project not found or inactive');
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log('[Update Location] Project found:', project.name);

    const now = new Date();

    // Update project location and create position report in a transaction
    const [updatedProject, positionReport] = await prisma.$transaction([
      // Update project's last known position
      prisma.project.update({
        where: { id: projectId },
        data: {
          lastLat: latitude,
          lastLng: longitude,
          lastSpeedKn: speed,
          lastHeadingDeg: heading,
          lastReportedAt: now,
        },
        select: {
          id: true,
          name: true,
          deviceId: true,
          lastLat: true,
          lastLng: true,
          lastSpeedKn: true,
          lastHeadingDeg: true,
          lastReportedAt: true,
          updatedAt: true,
        },
      }),
      // Create position report for history
      prisma.positionReport.create({
        data: {
          projectId,
          reportedAt: now,
          latitude,
          longitude,
          speedKn: speed,
          headingDeg: heading,
        },
        select: {
          id: true,
          reportedAt: true,
          latitude: true,
          longitude: true,
          speedKn: true,
          headingDeg: true,
        },
      }),
    ]);

    console.log('[Update Location] Location updated successfully');

    return NextResponse.json(
      {
        success: true,
        message: 'Location updated successfully',
        project: updatedProject,
        positionReport,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[Update Location] Error:', error);
    if (error instanceof Error) {
      console.error('[Update Location] Error message:', error.message);
      console.error('[Update Location] Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
