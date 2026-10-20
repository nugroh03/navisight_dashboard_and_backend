import { NextRequest, NextResponse } from 'next/server';
import { google, drive_v3 } from 'googleapis';
import { requireAuth } from '@/lib/auth-helpers';

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

// Drive membatasi jumlah item per halaman, jadi ikuti nextPageToken
// sampai semua item terambil.
async function listAllFiles(
  drive: drive_v3.Drive,
  params: { q: string; fields: string; orderBy?: string }
): Promise<drive_v3.Schema$File[]> {
  const files: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: params.q,
      orderBy: params.orderBy,
      fields: `nextPageToken, ${params.fields}`,
      pageSize: 1000,
      pageToken,
    });
    files.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

// GET /api/storage?folderId=xxx
// Returns subfolders and/or video files in the given folder.
// If folderId is omitted, defaults to GOOGLE_DRIVE_FOLDER_ID (root).
export async function GET(req: NextRequest) {
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

    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootFolderId) {
      return NextResponse.json(
        { error: 'GOOGLE_DRIVE_FOLDER_ID is not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId') || rootFolderId;

    const drive = getDriveClient();

    // Run both queries in parallel
    // withSizes=1 : video files are direct children of each folder (date level)
    // withSizes=2 : video files are grandchildren (camera level → date → video)
    const withSizes = searchParams.get('withSizes');

    const [rawFolders, videos] = await Promise.all([
      listAllFiles(drive, {
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'name desc',
      }),
      listAllFiles(drive, {
        q: `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
        fields: 'files(id, name, size, createdTime, modifiedTime, thumbnailLink, mimeType)',
        orderBy: 'createdTime desc',
      }),
    ]);

    const toFolder = (f: typeof rawFolders[number], extra?: { totalSize: number; fileCount: number }) => ({
      id: f.id ?? '',
      name: f.name ?? '',
      modifiedTime: f.modifiedTime ?? '',
      ...extra,
    });

    let folders = rawFolders.map((f) => toFolder(f));

    if (withSizes === '1' && rawFolders.length > 0) {
      // Direct children: 1 query per folder
      const sizeResults = await Promise.all(
        rawFolders.map((folder) =>
          drive.files.list({
            q: `'${folder.id}' in parents and mimeType contains 'video/' and trashed = false`,
            fields: 'files(size)',
            pageSize: 1000,
          })
        )
      );
      folders = rawFolders.map((folder, i) => {
        const videoFiles = sizeResults[i].data.files ?? [];
        const totalSize = videoFiles.reduce((sum, f) => sum + parseInt(f.size ?? '0', 10), 0);
        return toFolder(folder, { totalSize, fileCount: videoFiles.length });
      });
    } else if (withSizes === '2' && rawFolders.length > 0) {
      // Grandchildren: get date subfolders first, then batch-query all their videos
      const subfoldersResults = await Promise.all(
        rawFolders.map((folder) =>
          drive.files.list({
            q: `'${folder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id)',
            pageSize: 100,
          })
        )
      );

      const videoSizeResults = await Promise.all(
        rawFolders.map(async (folder, i) => {
          const subfolders = subfoldersResults[i].data.files ?? [];
          if (subfolders.length === 0) {
            // No date subfolders — check for direct video children
            const res = await drive.files.list({
              q: `'${folder.id}' in parents and mimeType contains 'video/' and trashed = false`,
              fields: 'files(size)',
              pageSize: 1000,
            });
            return res.data.files ?? [];
          }
          // Batch query: all videos inside any of the date subfolders in one request
          const parentClauses = subfolders.map((sf) => `'${sf.id}' in parents`).join(' or ');
          const res = await drive.files.list({
            q: `(${parentClauses}) and mimeType contains 'video/' and trashed = false`,
            fields: 'files(size)',
            pageSize: 1000,
          });
          return res.data.files ?? [];
        })
      );

      folders = rawFolders.map((folder, i) => {
        const videoFiles = videoSizeResults[i];
        const totalSize = videoFiles.reduce((sum, f) => sum + parseInt(f.size ?? '0', 10), 0);
        return toFolder(folder, { totalSize, fileCount: videoFiles.length });
      });
    }

    return NextResponse.json({
      folders,
      files: videos,
    });
  } catch (error) {
    console.error('Error fetching storage contents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch storage contents' },
      { status: 500 }
    );
  }
}
