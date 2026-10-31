import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/auth/config';
import { findAccessibleCamera } from '@/lib/camera-access';
import { isapiRequest, IsapiNotConfiguredError } from '@/lib/isapi';

// Kamera hanya mendukung PTZ continuous (bergerak sampai diberi stop).
// Pengaman: selama tombol ditekan, browser mengirim "move" berulang (±400 ms).
// Jika tidak ada "move" baru dalam AUTO_STOP_MS (tab ditutup / koneksi putus),
// server mengirim stop sendiri. Dashboard berjalan sebagai satu proses Node,
// jadi timer di memori cukup.
const AUTO_STOP_MS = 1_500;
const autoStopTimers = new Map<string, ReturnType<typeof setTimeout>>();

const ptzSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('move'),
    pan: z.number().int().min(-100).max(100),
    tilt: z.number().int().min(-100).max(100),
    zoom: z.number().int().min(-100).max(100),
  }),
  z.object({ action: z.literal('stop') }),
  z.object({
    action: z.literal('goto'),
    presetId: z.number().int().min(1).max(300),
  }),
]);

const continuousXml = (pan: number, tilt: number, zoom: number) =>
  `<?xml version="1.0" encoding="UTF-8"?><PTZData><pan>${pan}</pan><tilt>${tilt}</tilt><zoom>${zoom}</zoom></PTZData>`;

const sendContinuous = (host: string, pan: number, tilt: number, zoom: number) =>
  isapiRequest(host, '/ISAPI/PTZCtrl/channels/1/continuous', {
    method: 'PUT',
    body: continuousXml(pan, tilt, zoom),
  });

const clearAutoStop = (cameraId: string) => {
  const timer = autoStopTimers.get(cameraId);
  if (timer) {
    clearTimeout(timer);
    autoStopTimers.delete(cameraId);
  }
};

// PTZ untuk saat ini hanya ADMINISTRATOR; kamera juga harus ptzEnabled & punya isapiHost.
async function authorize(cameraId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    };
  }
  if ((session.user.role as string) !== 'ADMINISTRATOR') {
    return {
      error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
    };
  }
  const { camera } = await findAccessibleCamera(session.user.email, cameraId);
  if (!camera) {
    return {
      error: NextResponse.json(
        { message: 'Camera not found' },
        { status: 404 }
      ),
    };
  }
  if (!camera.ptzEnabled || !camera.isapiHost) {
    return {
      error: NextResponse.json(
        { message: 'PTZ tidak diaktifkan untuk kamera ini' },
        { status: 400 }
      ),
    };
  }
  return { email: session.user.email, camera, host: camera.isapiHost };
}

const handleError = (error: unknown) => {
  if (error instanceof IsapiNotConfiguredError) {
    console.error(error.message);
    return NextResponse.json(
      { message: 'Kontrol PTZ belum dikonfigurasi di server' },
      { status: 503 }
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { message: 'Validation error', errors: error.issues },
      { status: 400 }
    );
  }
  const isTimeout =
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError');
  console.error('Error in PTZ control:', error);
  return NextResponse.json(
    { message: isTimeout ? 'Kamera tidak merespons' : 'Internal server error' },
    { status: isTimeout ? 504 : 500 }
  );
};

// GET /api/cctv/[id]/ptz - Daftar preset PTZ kamera
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const auth = await authorize(id);
    if ('error' in auth) return auth.error;

    const response = await isapiRequest(
      auth.host,
      '/ISAPI/PTZCtrl/channels/1/presets'
    );
    if (!response.ok) {
      console.error(`PTZ presets failed: HTTP ${response.status}`);
      return NextResponse.json(
        { message: 'Gagal mengambil preset dari kamera' },
        { status: 502 }
      );
    }

    const xml = await response.text();
    const presets = Array.from(
      xml.matchAll(/<PTZPreset\b[\s\S]*?<\/PTZPreset>/g)
    )
      .map((match) => {
        const block = match[0];
        const presetId = Number(/<id>(\d+)<\/id>/.exec(block)?.[1]);
        const name = /<presetName>([^<]*)<\/presetName>/.exec(block)?.[1];
        const enabled = /<enabled>(true|false)<\/enabled>/.exec(block)?.[1];
        return { id: presetId, name: name || `Preset ${presetId}`, enabled };
      })
      .filter((preset) => preset.id && preset.enabled !== 'false')
      .map(({ id: presetId, name }) => ({ id: presetId, name }));

    return NextResponse.json(presets);
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/cctv/[id]/ptz - Gerak (continuous), stop, atau ke preset
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const auth = await authorize(id);
    if ('error' in auth) return auth.error;

    const command = ptzSchema.parse(await request.json());
    const { camera, host, email } = auth;
    let response: Response;

    if (command.action === 'move') {
      const isNewMovement = !autoStopTimers.has(camera.id);
      clearAutoStop(camera.id);
      response = await sendContinuous(
        host,
        command.pan,
        command.tilt,
        command.zoom
      );
      autoStopTimers.set(
        camera.id,
        setTimeout(() => {
          autoStopTimers.delete(camera.id);
          sendContinuous(host, 0, 0, 0).catch((error) =>
            console.error('PTZ auto-stop failed:', error)
          );
        }, AUTO_STOP_MS)
      );
      if (isNewMovement) {
        console.info(
          `[PTZ] ${email} move camera=${camera.id} pan=${command.pan} tilt=${command.tilt} zoom=${command.zoom}`
        );
      }
    } else if (command.action === 'stop') {
      clearAutoStop(camera.id);
      response = await sendContinuous(host, 0, 0, 0);
    } else {
      clearAutoStop(camera.id);
      response = await isapiRequest(
        host,
        `/ISAPI/PTZCtrl/channels/1/presets/${command.presetId}/goto`,
        { method: 'PUT' }
      );
      console.info(
        `[PTZ] ${email} goto camera=${camera.id} preset=${command.presetId}`
      );
    }

    if (!response.ok) {
      console.error(`PTZ ${command.action} failed: HTTP ${response.status}`);
      return NextResponse.json(
        { message: 'Kamera menolak perintah PTZ' },
        { status: 502 }
      );
    }
    await response.arrayBuffer().catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
