import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { requireAuth } from '@/lib/auth-helpers';
import { GaxiosResponse } from 'gaxios';

function getDriveClient() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

// GET /api/storage/stream/[fileId] - Proxy video stream from Google Drive
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const authResult = await requireAuth(req);

    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    if (user.role === 'WORKER') {
      return NextResponse.json(
        { error: 'Forbidden - Access denied' },
        { status: 403 }
      );
    }

    const { fileId } = await params;
    const drive = getDriveClient();

    // Get file metadata first
    const meta = await drive.files.get({
      fileId,
      fields: 'id, name, size, mimeType',
    });

    const mimeType = meta.data.mimeType ?? 'video/mp4';
    const fileSize = parseInt(meta.data.size ?? '0', 10);

    // Handle Range requests for video seek support
    const rangeHeader = req.headers.get('range');
    let start = 0;
    let end = fileSize - 1;
    let status = 200;
    const headers: Record<string, string> = {
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    };

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        start = parseInt(match[1], 10);
        end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
        headers['Content-Length'] = String(end - start + 1);
        status = 206;
      }
    } else if (fileSize > 0) {
      headers['Content-Length'] = String(fileSize);
    }

    // Fetch file content from Drive
    const driveResponse = (await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      {
        responseType: 'stream',
        headers: rangeHeader ? { Range: `bytes=${start}-${end}` } : {},
      }
    )) as GaxiosResponse<NodeJS.ReadableStream>;

    const stream = driveResponse.data;

    // Convert Node.js ReadableStream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err: Error) => controller.error(err));
      },
    });

    return new NextResponse(webStream, { status, headers });
  } catch (error) {
    console.error('Error streaming file:', error);
    return NextResponse.json(
      { error: 'Failed to stream file' },
      { status: 500 }
    );
  }
}
