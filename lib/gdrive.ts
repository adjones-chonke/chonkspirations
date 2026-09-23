import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export interface GalleryItem {
  id: string;
  title: string;
  video_src: string;
  // Originals, proxied through /api/media. Used by the lightbox and playback.
  static_src: string;
  params_src: string;
  // Drive-rendered derivatives for the grid, served via /api/thumb. Rendering
  // these costs no file-download quota, which is what gets rate limited.
  static_thumb: string;
  params_thumb: string;
}

const VIDEO_EXT = /\.(mp4|mov|webm|mkv)$/i;
const IMAGE_EXT = /\.(png|jpg|jpeg|webp)$/i;
const PARAMS_NAME = /param|meta|spec/i;

export interface AssetCandidate {
  name: string;
  mimeType?: string;
}

/**
 * Picks one video, one preview image, and one params image out of a folder.
 * Params image wins on a name match, else falls back to the second image.
 */
export function classifyAssets<T extends AssetCandidate>(files: T[]) {
  const video = files.find(
    (f) => f.mimeType?.startsWith('video/') || VIDEO_EXT.test(f.name)
  );
  const images = files.filter(
    (f) => f.mimeType?.startsWith('image/') || IMAGE_EXT.test(f.name)
  );

  const paramsImg =
    images.find((f) => PARAMS_NAME.test(f.name)) ??
    (images.length > 1 ? images[1] : undefined);
  const staticImg = images.find((f) => f !== paramsImg);

  return { video, staticImg, paramsImg };
}

export function getDriveClient() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) {
    return google.drive({ version: 'v3', auth: apiKey });
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
  }

  return null;
}

export async function fetchGalleryItems(): Promise<GalleryItem[]> {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (drive && folderId) {
    try {
      // 1. Fetch subfolders in the root Google Shared Drive directory
      const folderRes = await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 1000,
        orderBy: 'name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const folders = folderRes.data.files || [];
      const items: GalleryItem[] = [];

      for (const folder of folders) {
        if (!folder.id || !folder.name) continue;

        // Fetch files inside this subfolder
        const filesRes = await drive.files.list({
          q: `'${folder.id}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType)',
          pageSize: 100,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        const files = (filesRes.data.files || []).map((f) => ({
          id: f.id ?? '',
          name: f.name ?? '',
          mimeType: f.mimeType ?? undefined,
        }));

        const { video, staticImg, paramsImg } = classifyAssets(files);
        // Drive renders thumbnails for videos too, so a folder with no preview
        // image still gets a poster.
        const posterId = staticImg?.id || video?.id;

        items.push({
          id: folder.name,
          title: folder.name,
          video_src: video?.id ? `/api/media/${video.id}` : '',
          static_src: staticImg?.id ? `/api/media/${staticImg.id}` : '',
          params_src: paramsImg?.id ? `/api/media/${paramsImg.id}` : '',
          static_thumb: posterId ? `/api/thumb/${posterId}` : '',
          params_thumb: paramsImg?.id ? `/api/thumb/${paramsImg.id}` : '',
        });
      }

      if (items.length > 0) {
        return items;
      }
    } catch (err) {
      console.error('Error fetching from Google Drive API:', err);
    }
  }

  // Local fallback mode when GOOGLE_DRIVE_FOLDER_ID is not configured or fails
  return getLocalGalleryItems();
}

function getLocalGalleryItems(): GalleryItem[] {
  const libDir = path.join(process.cwd(), 'chonk_library');
  if (!fs.existsSync(libDir)) return [];

  const folders = fs.readdirSync(libDir).filter(f => {
    return fs.statSync(path.join(libDir, f)).isDirectory() && !f.startsWith('.');
  });

  const items: GalleryItem[] = [];

  for (const folder of folders.sort()) {
    const folderPath = path.join(libDir, folder);
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => !f.startsWith('.'))
      .map((name) => ({ name }));

    const { video, staticImg, paramsImg } = classifyAssets(files);
    const localSrc = (name?: string) =>
      name ? `/chonk_library/${encodeURIComponent(folder)}/${encodeURIComponent(name)}` : '';

    items.push({
      id: folder,
      title: folder,
      video_src: localSrc(video?.name),
      static_src: localSrc(staticImg?.name),
      params_src: localSrc(paramsImg?.name),
      // No Drive CDN here, so the grid and the lightbox share one file.
      static_thumb: localSrc(staticImg?.name),
      params_thumb: localSrc(paramsImg?.name),
    });
  }

  return items;
}
