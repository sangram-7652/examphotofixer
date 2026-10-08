import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetGa4ForTests, loadGa4, resolveGa4MeasurementId, sendToGa4 } from "./ga4";
import type { AnalyticsEvent } from "../index";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  __resetGa4ForTests();
});

describe("resolveGa4MeasurementId", () => {
  it("is null with no measurement ID configured", () => {
    expect(resolveGa4MeasurementId()).toBeNull();
  });

  it("is null for a malformed or non-GA4 id", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "UA-12345-1");
    expect(resolveGa4MeasurementId()).toBeNull();
  });

  it("is null when analytics are disabled, even with a valid id", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-ABC1234567");
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_DISABLED", "true");
    expect(resolveGa4MeasurementId()).toBeNull();
  });

  it("returns a trimmed, valid GA4 id", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "  G-ABC1234567  ");
    expect(resolveGa4MeasurementId()).toBe("G-ABC1234567");
  });
});

describe("loadGa4 and sendToGa4 outside the browser", () => {
  it("never throw when window/document don't exist", () => {
    expect(() => loadGa4("G-ABC1234567")).not.toThrow();
    expect(() =>
      sendToGa4({ name: "page_view", props: {} } satisfies AnalyticsEvent),
    ).not.toThrow();
  });
});

describe("loadGa4 and sendToGa4 in the browser", () => {
  let appended: Array<{ src: string; async: boolean }>;

  beforeEach(() => {
    appended = [];
    const fakeWindow = {} as Window & typeof globalThis;
    const fakeDocument = {
      createElement: () => ({ src: "", async: false }) as unknown as HTMLScriptElement,
      head: {
        appendChild: (el: HTMLScriptElement) => appended.push({ src: el.src, async: el.async }),
      },
    } as unknown as Document;
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("document", fakeDocument);
  });

  it("initializes dataLayer, gtag, and configures GA4 cookieless with no automatic page_view", () => {
    loadGa4("G-ABC1234567");
    expect(window.dataLayer).toEqual([
      ["js", expect.any(Date)],
      ["config", "G-ABC1234567", { send_page_view: false, client_storage: "none" }],
    ]);
    expect(appended).toHaveLength(1);
    expect(appended[0].async).toBe(true);
    expect(appended[0].src).toBe("https://www.googletagmanager.com/gtag/js?id=G-ABC1234567");
  });

  it("injects the script only once even if called again", () => {
    loadGa4("G-ABC1234567");
    loadGa4("G-ABC1234567");
    expect(appended).toHaveLength(1);
  });

  it("forwards a sanitized event to gtag under its mapped GA4 name", () => {
    loadGa4("G-ABC1234567");
    sendToGa4({
      name: "tool_viewed",
      props: { tool_id: "ccc-photo", tool_type: "preset", route: "/ccc-photo-resizer" },
    });
    expect(window.dataLayer).toContainEqual([
      "event",
      "tool_viewed",
      { tool_id: "ccc-photo", tool_type: "preset", route: "/ccc-photo-resizer" },
    ]);
  });

  it("stringifies boolean props rather than send a raw boolean", () => {
    loadGa4("G-ABC1234567");
    sendToGa4({ name: "image_selected", props: { accepted: true } });
    expect(window.dataLayer).toContainEqual(["event", "image_selected", { accepted: "true" }]);
  });

  it("does nothing if sendToGa4 is called before loadGa4", () => {
    expect(() => sendToGa4({ name: "page_view", props: {} })).not.toThrow();
    expect(window.dataLayer).toBeUndefined();
  });
});
