import type { NextConfig } from "next";

// Grid images are already-resized thumbnails from /api/thumb and are rendered
// with `unoptimized`, so Next's image optimizer is intentionally not used.
const nextConfig: NextConfig = {};

export default nextConfig;
