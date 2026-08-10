import type { NextConfig } from "next";

const repositoryName = "math-Hinge-system-81";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: `/${repositoryName}`,
};

export default nextConfig;
