import { NextRequest } from 'next/server';
import { handleCameraAudioSignaling } from '@/lib/camera-audio-signaling';

// POST /api/cctv/[id]/talk - Bicara ke speaker kamera ("<stream>_talk", isapi://)
export function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleCameraAudioSignaling(request, context, {
    suffix: '_talk',
    logTag: 'TALK',
  });
}
