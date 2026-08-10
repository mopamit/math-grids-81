import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Keep the exported site independent of the GitHub repository name.
  // The matching `assets` directory is published beside index.html.
  assetPrefix: "./assets",
};

export default nextConfig;
