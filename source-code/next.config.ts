import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Keep exported assets relative so the same build works under any
  // GitHub Pages repository name (and not only /math-Hinge-system-81/).
  assetPrefix: ".",
};

export default nextConfig;
