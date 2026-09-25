/**
 * HTTP security headers for every route (applied in next.config.ts).
 *
 * The CSP is the static-compatible variant from the Next.js CSP guide: pages are prerendered,
 * so per-request nonces are impossible without making every page dynamic. `script-src` and
 * `style-src` therefore allow 'unsafe-inline' (Next.js hydration scripts, next/font styles).
 * The directives that matter most for this product are strict:
 *
 * - `connect-src 'self' blob:`: the browser refuses to send data to any other origin (blob: is
 *   the page's own in-memory object URLs, never a network destination), so no image,
 *   file name or analytics payload can leave for a third party, even by mistake.
 * - `worker-src 'self'`: only the bundled image worker may run.
 * - `img-src 'self' blob: data:`: previews use blob: URLs created locally.
 * - `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
 *
 * No `unsafe-eval` in production (development needs it for React's debugging tools), and no
 * wildcard sources. Adding an analytics or monitoring provider requires adding its origin to
 * `connect-src` here (see docs/ANALYTICS.md).
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

export function contentSecurityPolicy(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"],
    // blob: lets page code read its own in-memory object URLs; blob: can't reach the network.
    "connect-src": ["'self'", "blob:"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

export function securityHeaders(isDev: boolean): SecurityHeader[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
    // One year; no includeSubDomains/preload: those affect every subdomain and are hard to undo.
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // The site never uses these APIs. The photo picker's `capture` attribute opens the
    // device camera app through the file input, which this policy does not affect.
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    // Legacy counterpart of frame-ancestors 'none'.
    { key: "X-Frame-Options", value: "DENY" },
  ];
}

/**
 * Redirect for the `www.` variant of the canonical host (or the apex, if the canonical host
 * is `www.`), as a safety net behind the hosting platform's own domain redirect. One hop,
 * straight to the canonical HTTPS origin, so no chains. `null` for localhost/IP origins.
 */
export function alternateHostRedirect(siteUrl: string) {
  const { hostname, origin } = new URL(siteUrl);
  if (!hostname.includes(".") || /^[\d.]+$/.test(hostname)) return null;
  const alternate = hostname.startsWith("www.") ? hostname.slice(4) : `www.${hostname}`;
  return {
    source: "/:path*",
    has: [{ type: "host" as const, value: alternate }],
    destination: `${origin}/:path*`,
    permanent: true,
  };
}
