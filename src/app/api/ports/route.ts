import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth-helpers';

// Validation schema for Port
const portSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

// GET /api/ports - Get all ports (Admin only)
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);

    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const ports = await prisma.port.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(ports, { status: 200 });
  } catch (error) {
    console.error('Error fetching ports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ports' },
      { status: 500 }
    );
  }
}

// POST /api/ports - Create a new port (Admin only)
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);

    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    let body;
    try {
      const text = await req.text();
      console.log('Request body (raw):', text);

      if (!text || text.trim() === '') {
        return NextResponse.json(
          { error: 'Request body is empty' },
          { status: 400 }
        );
      }

      body = JSON.parse(text);
      console.log('Request body (parsed):', body);
    } catch (error) {
      console.error('JSON parse error:', error);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate input
    const validatedData = portSchema.parse(body);

    const port = await prisma.port.create({
      data: {
        name: validatedData.name,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
      },
    });

    return NextResponse.json(port, { status: 201 });
  } catch (error) {
    console.error('Error creating port:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create port' },
      { status: 500 }
    );
  }
}
