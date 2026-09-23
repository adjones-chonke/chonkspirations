import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export interface GalleryItem {
  id: string;
  title: string;
  video_src: string;
  static_src: string;
  params_src: string;
}

function getDriveClient() {
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

        const files = filesRes.data.files || [];

        // Classify video, static image, params image
        const videoFile = files.find(f => 
          f.mimeType?.startsWith('video/') || 
          /\.(mp4|mov|webm|mkv)$/i.test(f.name || '')
        );

        const imgFiles = files.filter(f => 
          f.mimeType?.startsWith('image/') || 
          /\.(png|jpg|jpeg|webp)$/i.test(f.name || '')
        );

        const paramsImg = imgFiles.find(f => 
          /param|meta|spec/i.test(f.name || '')
        ) || (imgFiles.length > 1 ? imgFiles[1] : undefined);

        const staticImg = imgFiles.find(f => f.id !== paramsImg?.id) || 
          (imgFiles.length > 0 && imgFiles[0].id !== paramsImg?.id ? imgFiles[0] : undefined);

        items.push({
          id: folder.name,
          title: folder.name,
          video_src: videoFile?.id ? `/api/media/${videoFile.id}` : '',
          static_src: staticImg?.id ? `/api/media/${staticImg.id}` : '',
          params_src: paramsImg?.id ? `/api/media/${paramsImg.id}` : '',
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
    const files = fs.readdirSync(folderPath).filter(f => !f.startsWith('.'));

    const video = files.find(f => /\.(mp4|mov|webm|mkv)$/i.test(f));
    const imgs = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
    const paramsImg = imgs.find(f => /param|meta|spec/i.test(f)) || (imgs.length > 1 ? imgs[1] : undefined);
    const staticImg = imgs.find(f => f !== paramsImg) || (imgs.length > 0 && imgs[0] !== paramsImg ? imgs[0] : undefined);

    items.push({
      id: folder,
      title: folder,
      video_src: video ? `/chonk_library/${encodeURIComponent(folder)}/${encodeURIComponent(video)}` : '',
      static_src: staticImg ? `/chonk_library/${encodeURIComponent(folder)}/${encodeURIComponent(staticImg)}` : '',
      params_src: paramsImg ? `/chonk_library/${encodeURIComponent(folder)}/${encodeURIComponent(paramsImg)}` : '',
    });
  }

  return items;
}
