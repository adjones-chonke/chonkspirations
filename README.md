# Chonk Gallery

A Next.js gallery that reads a Google Drive folder and renders each subfolder as a
card with a video, a preview image, and a parameters screenshot.

Drive stays the source of truth. Nothing is uploaded or copied into the repo — the
app proxies Drive on request and serves compressed derivatives for the grid.

## Setup

Create `.env.local`:

```bash
GOOGLE_DRIVE_FOLDER_ID=<id of the parent folder>

# Option A — API key. Simplest, but only reads publicly-shared files and is
# subject to Google's anti-abuse throttling on bulk downloads.
GOOGLE_API_KEY=<key>

# Option B — service account. Preferred: real authenticated quota, reads files
# shared with the service account, and enables the "Live" badge.
GOOGLE_CLIENT_EMAIL=<service account email>
GOOGLE_PRIVATE_KEY=<private key, newlines escaped as \n>
```

If both are present the API key wins. Then:

```bash
npm install
npm run dev
```

## Drive folder layout

One subfolder per gallery item. The subfolder name becomes the card title.

```
<parent folder>/
  Lurking/
    lurking.mp4        → video
    lurking.png        → preview image
    params.png         → parameters screenshot
```

Files are classified by `classifyAssets` in `lib/gdrive.ts`:

- **Video** — first file with a `video/*` mime type or an `.mp4/.mov/.webm/.mkv` extension.
- **Params image** — first image whose name matches `param`, `meta`, or `spec`;
  otherwise the second image in the folder.
- **Preview image** — the first image that is not the params image.

Extra images beyond the first two are ignored.

## How the weight is kept down

The grid and the lightbox deliberately load different things.

| | source | typical size |
|---|---|---|
| grid poster / image tabs | Drive-rendered thumbnail via `/api/thumb` | ~285 KB |
| lightbox | original bytes via `/api/media` | 1–11 MB |
| video | original file, fetched on play | untouched |

Three rules make this work, and breaking any of them regresses the page:

1. **Videos use `preload="none"` and no `autoPlay`.** A card shows a thumbnail
   poster until someone clicks it. Nothing video-related crosses the network
   until then. Video quality is never reduced — only deferred.
2. **Grid images never touch the originals.** All six posters together come to
   ~1.7 MB, against 36.5 MB if the grid loaded originals.
3. **Offscreen videos pause.** An `IntersectionObserver` in `GalleryCard` stops
   cards that scroll out of view from buffering.

### Why `/api/thumb` exists

Drive renders its own thumbnails and serves them from `lh3.googleusercontent.com`.
Requesting one costs a cheap **metadata** call and no **file-download** quota —
and file downloads are the thing Google rate limits. That makes browsing the grid
essentially free against the quota that matters.

It is a proxy rather than a direct link for two reasons, both of which are easy
to rediscover the hard way:

- **The URLs rotate.** `thumbnailLink` returns a different signed token on every
  metadata call, so a direct link can never be cached by a browser or CDN.
  Keying the route on the stable Drive file ID fixes that.
- **Chrome refuses to render them cross-origin**, failing with
  `ERR_BLOCKED_BY_ORB` even though the response is a valid `image/jpeg`.
  Same-origin proxying sidesteps it.

`next/image` is deliberately **not** used: these are already resized, and the
rotating source URLs would make the optimizer's cache miss every single time.

### If you do hit the throttle

Bulk file downloads can still trip Google's protection — it answers `403` with an
HTML "Sorry..." page, which reads exactly like a permissions error. To check
whether a credential is actually broken, call a metadata endpoint with it. If
`files.list` returns `200` while `alt=media` returns `403`, the key is fine and
only downloads are limited. It clears on its own; a new key does not help.

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build + typecheck
npm test        # unit tests (node:test, no test framework dependency)
npm run lint    # eslint
```

## Known limitations

- `lib/gdrive.ts` lists folders sequentially, so a cold read costs one Drive API
  call per subfolder. Fine at a dozen items; parallelize before it grows large.
- The grid renders every item with no virtualization.
- The `chonk_library/` local fallback is not currently served — those paths
  resolve under `/chonk_library/...`, which would need the directory inside
  `public/`.
