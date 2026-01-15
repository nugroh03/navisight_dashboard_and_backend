import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const JWT_SECRET = process.env.NEXTAUTH_SECRET ?? process.env.JWT_SECRET;

/**
 * Mobile Login Endpoint
 * Allows both INTERNAL_STAFF and EXTERNAL_CUSTOMER users
 * Only requires canAccessMobile = true
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Mobile Login] Request received');

    let body;
    try {
      body = await req.json();
      console.log('[Mobile Login] Body parsed:', { email: body.email });
    } catch (e) {
      console.error('[Mobile Login] JSON parse error:', e);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      console.log(
        '[Mobile Login] Validation failed:',
        validation.error.flatten().fieldErrors
      );
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;
    console.log('[Mobile Login] Looking up user:', email);

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

    console.log('[Mobile Login] User found:', !!user);

    // Validate user exists and has password
    if (!user?.passwordHash) {
      console.log('[Mobile Login] User not found or no password hash');
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    console.log('[Mobile Login] Verifying password...');
    // Verify password
    const isPasswordValid = await compare(password, user.passwordHash);
    console.log('[Mobile Login] Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // SECURITY CHECK: Check mobile access flag
    if (!user.canAccessMobile) {
      console.log('[Mobile Login] Mobile access denied for user');
      return NextResponse.json(
        {
          error: 'Access denied',
          message:
            'Mobile access is disabled for this account. Contact administrator.',
        },
        { status: 403 }
      );
    }

    console.log('[Mobile Login] Generating JWT token...');
    // Success - generate JWT for mobile clients
    // Mobile allows both INTERNAL_STAFF and EXTERNAL_CUSTOMER
    const { passwordHash: _passwordHash, ...safeUser } = user;

    if (!JWT_SECRET) {
      console.error('[Mobile Login] Missing JWT secret');
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    const tokenPayload = {
      sub: safeUser.id,
      email: safeUser.email,
      name: safeUser.name,
      role: safeUser.role?.name ?? null,
      accountType: safeUser.accountType,
      canAccessMobile: safeUser.canAccessMobile,
    };

    console.log('[Mobile Login] Token payload:', {
      ...tokenPayload,
      sub: '***',
    });
    const token = sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    console.log('[Mobile Login] Token generated successfully');

    return NextResponse.json({
      success: true,
      token: token,
    });
  } catch (error) {
    console.error('[Mobile Login] Error:', error);
    if (error instanceof Error) {
      console.error('[Mobile Login] Error message:', error.message);
      console.error('[Mobile Login] Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
