import { NextRequest } from 'next/server';
import { handleCameraAudioSignaling } from '@/lib/camera-audio-signaling';

// POST /api/cctv/[id]/listen - Mendengar mic kamera ("<stream>_audio")
export function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleCameraAudioSignaling(request, context, {
    suffix: '_audio',
    logTag: 'LISTEN',
  });
}
