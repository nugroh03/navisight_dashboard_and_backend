import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * Mobile Login Endpoint
 * Allows both INTERNAL_STAFF and EXTERNAL_CUSTOMER users
 * Only requires canAccessMobile = true
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

    // SECURITY CHECK: Check mobile access flag
    if (!user.canAccessMobile) {
      return NextResponse.json(
        {
          error: 'Access denied',
          message:
            'Mobile access is disabled for this account. Contact administrator.',
        },
        { status: 403 }
      );
    }

    // Success - return user data (exclude sensitive info)
    // Mobile allows both INTERNAL_STAFF and EXTERNAL_CUSTOMER
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
      message: 'Mobile login successful',
    });
  } catch (error) {
    console.error('Mobile login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
