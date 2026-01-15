import { NextRequest } from 'next/server';
import { verify } from 'jsonwebtoken';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/config';

const JWT_SECRET = process.env.NEXTAUTH_SECRET ?? process.env.JWT_SECRET;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  accountType: string;
  canAccessMobile: boolean;
  canAccessDashboard?: boolean;
}

/**
 * Get authenticated user from either:
 * 1. Authorization header (Bearer token for mobile)
 * 2. NextAuth session (cookies for dashboard)
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  // Try to get token from Authorization header first (for mobile)
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      if (!JWT_SECRET) {
        console.error('JWT_SECRET is not defined');
        return null;
      }

      const decoded = verify(token, JWT_SECRET) as {
        sub: string;
        email: string;
        name: string | null;
        role: string | null;
        accountType: string;
        canAccessMobile: boolean;
        canAccessDashboard?: boolean;
      };

      return {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        accountType: decoded.accountType,
        canAccessMobile: decoded.canAccessMobile,
        canAccessDashboard: decoded.canAccessDashboard,
      };
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  // Fallback to NextAuth session (for dashboard)
  const session = await getServerSession(authOptions);

  if (session?.user?.id && session.user.email) {
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || null,
      role: session.user.role || null,
      accountType: session.user.accountType || 'INTERNAL_STAFF',
      canAccessMobile: session.user.canAccessMobile ?? true,
      canAccessDashboard: session.user.canAccessDashboard ?? true,
    };
  }

  return null;
}

/**
 * Check if user is authenticated
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const user = await getAuthUser(req);

  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}

/**
 * Check if user is admin
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const authResult = await requireAuth(req);

  if ('error' in authResult) {
    return authResult;
  }

  if (authResult.user.role !== 'ADMINISTRATOR') {
    return { error: 'Forbidden - Administrator access required', status: 403 };
  }

  return authResult;
}
