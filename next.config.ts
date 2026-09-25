import type { NextConfig } from "next";
import { alternateHostRedirect, securityHeaders } from "./src/config/security-headers";
import { siteConfig } from "./src/config/site";

const hostRedirect = alternateHostRedirect(siteConfig.url);

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
