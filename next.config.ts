import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The CCC Complete Pack moved; keep the old URL working.
      { source: "/ccc-image-resizer", destination: "/ccc-complete-pack", permanent: true },
    ];
  },
};

export default nextConfig;
