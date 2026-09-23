import { NextResponse } from 'next/server';
import { getDriveClient } from '@/lib/gdrive';

// Grid cards are ~330px wide, so this covers 2x DPR with headroom. The
// lightbox loads the original, so nothing here needs to be print-sharp.
const THUMB_SIZE = 800;

/**
 * Serves Drive's own generated thumbnail for a file.
 *
 * Drive renders these on its CDN, so this path costs no file-download quota —
 * only a cheap metadata lookup. It exists as a proxy rather than a direct link
 * for two reasons: the CDN URLs rotate on every metadata call (so they cannot
 * be cached by the browser), and Chrome refuses to render them cross-origin
 * (ERR_BLOCKED_BY_ORB).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const drive = getDriveClient();

  if (!drive) {
    return NextResponse.json({ error: 'Google Drive credentials not configured' }, { status: 500 });
  }

  try {
    const meta = await drive.files.get({
      fileId,
      fields: 'thumbnailLink',
      supportsAllDrives: true,
    });

    const link = meta.data.thumbnailLink;
    if (!link) {
      return NextResponse.json({ error: 'No thumbnail available' }, { status: 404 });
    }

    // Only ever fetch Google's own CDN, never an arbitrary URL from a response.
    const target = new URL(link.replace(/=s\d+(-c)?$/, `=s${THUMB_SIZE}`));
    if (!target.hostname.endsWith('.googleusercontent.com')) {
      return NextResponse.json({ error: 'Unexpected thumbnail host' }, { status: 502 });
    }

    const upstream = await fetch(target);
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Thumbnail fetch failed' }, { status: 502 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err) {
    console.error(`Error fetching thumbnail for ${fileId}:`, err);
    return NextResponse.json({ error: 'Failed to retrieve thumbnail' }, { status: 500 });
  }
}
