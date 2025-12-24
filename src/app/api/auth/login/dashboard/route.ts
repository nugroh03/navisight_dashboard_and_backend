import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * Dashboard Login Endpoint
 * Only allows INTERNAL_STAFF users with canAccessDashboard = true
 * Blocks EXTERNAL_CUSTOMER accounts
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // Find user with platform access info
    const user = await prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      include: {
        role: true,
      },
    });

    // Validate user exists and has password
    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // SECURITY CHECK 1: Block external customers from dashboard
    if (user.accountType === 'EXTERNAL_CUSTOMER') {
      return NextResponse.json(
        {
          error: 'Access denied',
          message:
            'Customer accounts cannot access the dashboard. Please use the mobile app.',
        },
        { status: 403 }
      );
    }

    // SECURITY CHECK 2: Check dashboard access flag
    if (!user.canAccessDashboard) {
      return NextResponse.json(
        {
          error: 'Access denied',
          message:
            'Dashboard access is disabled for this account. Contact administrator.',
        },
        { status: 403 }
      );
    }

    // Success - return user data (exclude sensitive info)
    const { passwordHash, ...safeUser } = user;

    return NextResponse.json({
      success: true,
      user: {
        id: safeUser.id,
        name: safeUser.name,
        email: safeUser.email,
        role: safeUser.role?.name,
        accountType: safeUser.accountType,
      },
      message: 'Dashboard login successful',
    });
  } catch (error) {
    console.error('Dashboard login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
