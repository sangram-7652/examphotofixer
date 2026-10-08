import type { NextConfig } from "next";
import { resolveGa4MeasurementId } from "./src/lib/analytics/providers/ga4";
import { alternateHostRedirect, securityHeaders } from "./src/config/security-headers";
import { siteConfig } from "./src/config/site";

const hostRedirect = alternateHostRedirect(siteConfig.url);
// Build-time only, like every NEXT_PUBLIC_* value: widens the CSP to GA4's origins only when a
// real measurement ID is configured (docs/ANALYTICS.md), never unconditionally.
const gaEnabled = resolveGa4MeasurementId() !== null;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Traces only the files `next start`'s replacement server.js needs — required for a minimal
  // Docker runtime image (docs/DEPLOYMENT.md "Docker"). No effect on routes, headers or output.
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV === "development", gaEnabled),
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
