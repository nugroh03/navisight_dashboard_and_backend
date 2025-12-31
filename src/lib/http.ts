import { NextRequest } from 'next/server';

export const getPublicOrigin = (req: NextRequest) => {
  const proto =
    req.headers.get('x-forwarded-proto') ??
    req.headers.get('x-forwarded-protocol') ??
    'https';

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');

  if (!host) {
    throw new Error('Cannot determine public host');
  }

  return `${proto}://${host}`;
};
