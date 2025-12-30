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

// GET /api/ports/[id] - Get a specific port (Admin only)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(req);

    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { id } = await params;

    const port = await prisma.port.findUnique({
      where: { id },
    });

    if (!port) {
      return NextResponse.json({ error: 'Port not found' }, { status: 404 });
    }

    return NextResponse.json(port, { status: 200 });
  } catch (error) {
    console.error('Error fetching port:', error);
    return NextResponse.json(
      { error: 'Failed to fetch port' },
      { status: 500 }
    );
  }
}

// PUT /api/ports/[id] - Update a port (Admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(req);

    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { id } = await params;
    const body = await req.json();

    // Validate input
    const validatedData = portSchema.parse(body);

    // Check if port exists
    const existingPort = await prisma.port.findUnique({
      where: { id },
    });

    if (!existingPort) {
      return NextResponse.json({ error: 'Port not found' }, { status: 404 });
    }

    const port = await prisma.port.update({
      where: { id },
      data: {
        name: validatedData.name,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
      },
    });

    return NextResponse.json(port, { status: 200 });
  } catch (error) {
    console.error('Error updating port:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update port' },
      { status: 500 }
    );
  }
}

// DELETE /api/ports/[id] - Delete a port (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin(req);

    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { id } = await params;

    // Check if port exists
    const existingPort = await prisma.port.findUnique({
      where: { id },
    });

    if (!existingPort) {
      return NextResponse.json({ error: 'Port not found' }, { status: 404 });
    }

    await prisma.port.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: 'Port deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting port:', error);
    return NextResponse.json(
      { error: 'Failed to delete port' },
      { status: 500 }
    );
  }
}
