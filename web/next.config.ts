import type { NextConfig } from "next";

// Static export. The result is fixed and every number is precomputed, so the
// site ships as plain files with no serverless functions and no backend.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
