import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  typescript: {
    // TypeScript 7 ships an ESM-only native compiler that Next's build-time
    // type-check worker cannot load; types are enforced by `tsc --noEmit`.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
