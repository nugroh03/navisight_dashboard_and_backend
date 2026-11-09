import { NextRequest, NextResponse } from 'next/server';
import {
  findAgentByToken,
  ingestReport,
  reportSchema,
} from '@/lib/device-monitoring';

// POST /api/monitoring/report - Laporan + heartbeat dari agent PC lokal.
// Auth: Authorization: Bearer <token agent> (bukan sesi user).
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const agent = await findAgentByToken(token);
  if (!agent) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Body harus JSON' }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Format laporan tidak valid', issues: parsed.error.issues.slice(0, 5) },
      { status: 400 }
    );
  }

  try {
    const result = await ingestReport(agent.id, parsed.data);
    return NextResponse.json({ ok: true, ...result, serverTime: new Date().toISOString() });
  } catch (error) {
    console.error('[MONITORING] Gagal memproses laporan:', error);
    return NextResponse.json({ message: 'Gagal memproses laporan' }, { status: 500 });
  }
}
