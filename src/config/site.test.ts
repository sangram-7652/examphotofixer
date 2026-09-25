import { afterEach, describe, expect, it, vi } from "vitest";

async function siteWith(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return (await import("./site")).siteConfig;
}

afterEach(() => vi.unstubAllEnvs());

describe("siteConfig", () => {
  it("normalizes the canonical origin", async () => {
    expect((await siteWith({ NEXT_PUBLIC_SITE_URL: "https://examphotofixer.com/" })).url).toBe(
      "https://examphotofixer.com",
    );
  });

  it("is not indexable unless the flag is exactly true", async () => {
    expect((await siteWith({ NEXT_PUBLIC_SITE_INDEXABLE: "1" })).indexable).toBe(false);
    expect((await siteWith({ NEXT_PUBLIC_SITE_INDEXABLE: "true" })).indexable).toBe(true);
  });

  it("shows a contact address only when a valid one is configured", async () => {
    expect((await siteWith({ NEXT_PUBLIC_CONTACT_EMAIL: "" })).contactEmail).toBeNull();
    expect((await siteWith({ NEXT_PUBLIC_CONTACT_EMAIL: "not an email" })).contactEmail).toBeNull();
    expect(
      (await siteWith({ NEXT_PUBLIC_CONTACT_EMAIL: '"><script>@x.y' })).contactEmail,
    ).toBeNull();
    expect(
      (await siteWith({ NEXT_PUBLIC_CONTACT_EMAIL: " privacy@example.org " })).contactEmail,
    ).toBe("privacy@example.org");
  });
});
