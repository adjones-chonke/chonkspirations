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
| grid poster / image tabs | `next/image` → WebP at grid width | ~50–500 KB |
| lightbox | original bytes from Drive | 1–11 MB |
| video | original file, fetched on play | untouched |

Three rules make this work, and breaking any of them regresses the page:

1. **Videos use `preload="none"` and no `autoPlay`.** A card shows an optimized
   poster until someone clicks it. Nothing video-related crosses the network
   until then. Video quality is never reduced — only deferred.
2. **Grid images go through `next/image`.** Measured on a real 6-item library,
   this took grid images from 36.5 MB to 3.0 MB.
3. **Offscreen videos pause.** An `IntersectionObserver` in `GalleryCard` stops
   cards that scroll out of view from buffering.

### Watch out for Drive throttling

Every *new* image width the optimizer is asked for costs one full-size download
through the Drive API, and Google throttles bulk downloads with an HTML "Sorry..."
page rather than a clean error. Two settings in `next.config.ts` keep that in check:

- `deviceSizes` / `imageSizes` are trimmed to the widths this grid can actually
  request. Next's defaults generate up to 15 variants per image.
- `minimumCacheTTL` is 31 days. Safe here because a new Drive upload gets a new
  file ID, and therefore a new cache key — it appears immediately regardless.
  Only replacing content *inside* an existing file would serve stale.

If you hit the throttle it clears on its own. A service account (option B above)
is far less likely to trip it.

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
