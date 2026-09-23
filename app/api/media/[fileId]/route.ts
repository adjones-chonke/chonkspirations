import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

function getDriveClient() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) {
    return { drive: google.drive({ version: 'v3', auth: apiKey }), apiKey };
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) return null;
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return { drive: google.drive({ version: 'v3', auth }), apiKey: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  if (!fileId) {
    return NextResponse.json({ error: 'Missing file ID' }, { status: 400 });
  }

  const clientInfo = getDriveClient();
  if (!clientInfo) {
    return NextResponse.json({ error: 'Google Drive credentials not configured' }, { status: 500 });
  }

  const { drive, apiKey } = clientInfo;

  try {
    if (apiKey) {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true&key=${apiKey}`;
      const reqHeaders: Record<string, string> = {};
      const rangeHeader = request.headers.get('Range');
      if (rangeHeader) reqHeaders['Range'] = rangeHeader;

      const driveRes = await fetch(url, { headers: reqHeaders });

      if (!driveRes.ok) {
        // Drive answers a genuine permission error with JSON, but answers its
        // bulk-download throttle with an HTML "Sorry..." page. Only the latter
        // is worth telling the user to wait out.
        const throttled = driveRes.headers.get('Content-Type')?.includes('text/html');
        return NextResponse.json(
          { error: throttled ? 'Rate limited by Google Drive' : 'Google Drive refused the request' },
          { status: throttled ? 429 : driveRes.status }
        );
      }

      const headers = new Headers();
      headers.set('Content-Type', driveRes.headers.get('Content-Type') || 'application/octet-stream');
      headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      headers.set('Accept-Ranges', 'bytes');
      if (driveRes.headers.get('Content-Length')) {
        headers.set('Content-Length', driveRes.headers.get('Content-Length')!);
      }
      if (driveRes.headers.get('Content-Range')) {
        headers.set('Content-Range', driveRes.headers.get('Content-Range')!);
      }

      return new Response(driveRes.body, {
        status: driveRes.status,
        headers,
      });
    }

    // Service Account Fallback
    const fileMeta = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size',
      supportsAllDrives: true,
    });

    const mimeType = fileMeta.data.mimeType || 'application/octet-stream';
    const fileSize = fileMeta.data.size ? parseInt(fileMeta.data.size, 10) : null;

    const driveStream = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    headers.set('Accept-Ranges', 'bytes');
    if (fileSize) headers.set('Content-Length', fileSize.toString());

    const stream = new ReadableStream({
      start(controller) {
        driveStream.data.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        driveStream.data.on('end', () => controller.close());
        driveStream.data.on('error', (err: Error) => controller.error(err));
      },
    });

    return new Response(stream, { status: 200, headers });
  } catch (err: unknown) {
    console.error(`Error streaming media file ${fileId}:`, err);
    return NextResponse.json({ error: 'Failed to retrieve media file' }, { status: 500 });
  }
}
