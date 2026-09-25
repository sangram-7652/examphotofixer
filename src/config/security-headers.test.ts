import { describe, expect, it } from "vitest";
import { alternateHostRedirect, contentSecurityPolicy, securityHeaders } from "./security-headers";

function directives(csp: string): Map<string, string[]> {
  return new Map(
    csp.split(";").map((part) => {
      const [name, ...sources] = part.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

describe("content security policy", () => {
  const prod = directives(contentSecurityPolicy(false));

  it("only allows connections to the site itself (nothing can leave for a third party)", () => {
    expect(prod.get("connect-src")).toEqual(["'self'", "blob:"]);
    expect(prod.get("default-src")).toEqual(["'self'"]);
  });

  it("allows the bundled worker and local blob previews, nothing broader", () => {
    expect(prod.get("worker-src")).toEqual(["'self'"]);
    expect(prod.get("img-src")).toEqual(["'self'", "blob:", "data:"]);
  });

  it("blocks framing, plugins, base-tag and cross-site form hijacking", () => {
    expect(prod.get("frame-ancestors")).toEqual(["'none'"]);
    expect(prod.get("object-src")).toEqual(["'none'"]);
    expect(prod.get("base-uri")).toEqual(["'self'"]);
    expect(prod.get("form-action")).toEqual(["'self'"]);
  });

  it("has no wildcard sources and no unsafe-eval in production", () => {
    const all = [...prod.values()].flat();
    expect(all.some((source) => source.includes("*"))).toBe(false);
    expect(all).not.toContain("'unsafe-eval'");
    expect(all.some((source) => /^https?:/.test(source))).toBe(false);
  });

  it("allows unsafe-eval only for development tooling", () => {
    expect(directives(contentSecurityPolicy(true)).get("script-src")).toContain("'unsafe-eval'");
  });
});

describe("security headers", () => {
  it("sets the full production set", () => {
    const headers = Object.fromEntries(securityHeaders(false).map((h) => [h.key, h.value]));
    expect(Object.keys(headers).sort()).toEqual([
      "Content-Security-Policy",
      "Permissions-Policy",
      "Referrer-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
    ]);
    expect(headers["Strict-Transport-Security"]).toMatch(/^max-age=\d{8,}$/);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Permissions-Policy"]).toContain("geolocation=()");
  });
});

describe("alternate host redirect", () => {
  it("sends www to the apex canonical origin in one hop", () => {
    expect(alternateHostRedirect("https://examphotofixer.com")).toEqual({
      source: "/:path*",
      has: [{ type: "host", value: "www.examphotofixer.com" }],
      destination: "https://examphotofixer.com/:path*",
      permanent: true,
    });
  });

  it("sends the apex to a www canonical origin", () => {
    expect(alternateHostRedirect("https://www.example.org")?.has[0].value).toBe("example.org");
  });

  it("does nothing for local origins", () => {
    expect(alternateHostRedirect("http://localhost:3000")).toBeNull();
    expect(alternateHostRedirect("http://127.0.0.1:4310")).toBeNull();
  });
});
