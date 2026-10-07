import type { NextConfig } from "next";
import { alternateHostRedirect, securityHeaders } from "./src/config/security-headers";
import { siteConfig } from "./src/config/site";

const hostRedirect = alternateHostRedirect(siteConfig.url);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Traces only the files `next start`'s replacement server.js needs — required for a minimal
  // Docker runtime image (docs/DEPLOYMENT.md "Docker"). No effect on routes, headers or output.
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "development"),
      },
    ];
  },
  async redirects() {
    return [
      // www ↔ apex safety net; the hosting platform's domain redirect normally handles it first.
      ...(hostRedirect ? [hostRedirect] : []),
      // The CCC Complete Pack moved; keep the old URL working.
      { source: "/ccc-image-resizer", destination: "/ccc-complete-pack", permanent: true },
    ];
  },
};

export default nextConfig;
