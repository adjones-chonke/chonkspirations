import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Each unused width variant costs a full-size pull through the Drive API,
    // which Google rate-limits. Keep the srcset to widths this grid can hit.
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [384],
    // Safe to keep long: new Drive uploads get new file IDs, so they are new
    // cache keys and appear immediately. Only in-place edits would go stale.
    minimumCacheTTL: 2678400,
  },
};

export default nextConfig;
