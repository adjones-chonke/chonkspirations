import { NextResponse } from 'next/server';
import { fetchGalleryItems } from '@/lib/gdrive';

// Must run per request so the Sync button can force a fresh Drive read.
// Repeat page loads are still absorbed by the Cache-Control header below.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await fetchGalleryItems();
    const isLive = Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID && process.env.GOOGLE_CLIENT_EMAIL);

    return NextResponse.json(
      { items, isLive, count: items.length },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (err) {
    console.error('Error in /api/gallery route:', err);
    return NextResponse.json({ error: 'Failed to fetch gallery items' }, { status: 500 });
  }
}
