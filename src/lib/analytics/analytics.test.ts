import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_DOM_EVENT,
  fileSizeBucket,
  megapixelBucket,
  setAnalyticsProvider,
  trackEvent,
  type AnalyticsEvent,
} from ".";
import {
  browserFamily,
  deviceClass,
  normalizeRoute,
  pageCategory,
  referrerCategory,
  utmParams,
} from "./context";
import { funnelRates, rate } from "./funnel";
import { primaryReasonCode, validationReasonCodes } from "./reasons";
import { trackJobResult } from "./tool-events";
import { isSafeValue, sanitizeProps } from "./sanitize";
import { EVENT_PROPS } from "./taxonomy";
import { TOOLS } from "@/lib/tools/registry";
import { guidePath, listGuides } from "@/content/guides";

afterEach(() => {
  setAnalyticsProvider(null);
  vi.unstubAllEnvs();
});

describe("trackEvent", () => {
  it("forwards allowlisted props to the provider", () => {
    const provider = vi.fn();
    setAnalyticsProvider(provider);
    trackEvent("tool_viewed", { tool_id: "ccc-photo", tool_type: "preset", exam_id: "ccc" });
    expect(provider).toHaveBeenCalledWith({
      name: "tool_viewed",
      props: { tool_id: "ccc-photo", tool_type: "preset", exam_id: "ccc" },
    });
  });

  it("drops keys that are not on the event's allowlist", () => {
    const provider = vi.fn();
    setAnalyticsProvider(provider);
    // Deliberately bypass the types, as a careless caller might.
    trackEvent("image_selected", {
      tool_id: "ccc-photo",
      filename: "Ravi_Kumar_passport.jpg",
      gps: "28.6,77.2",
    } as never);
    const event = provider.mock.calls[0][0] as AnalyticsEvent;
    expect(event.props).toEqual({ tool_id: "ccc-photo" });
  });

  it("never throws, even if the provider does", () => {
    setAnalyticsProvider(() => {
      throw new Error("provider down");
    });
    expect(() => trackEvent("page_view")).not.toThrow();
  });

  it("is a no-op without a provider and outside the browser", () => {
    expect(() => trackEvent("result_ready", { tool_id: "ccc-photo" })).not.toThrow();
  });

  it("can be disabled by environment", () => {
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_DISABLED", "true");
    const provider = vi.fn();
    setAnalyticsProvider(provider);
    trackEvent("page_view");
    expect(provider).not.toHaveBeenCalled();
  });

  it("exposes a stable DOM event name", () => {
    expect(ANALYTICS_DOM_EVENT).toBe("epf:analytics");
  });
});

describe("sanitizer", () => {
  it.each([
    "blob:https://example.com/123",
    "data:image/jpeg;base64,AAAA",
    "https://example.com/a.jpg",
    "user@example.com",
    "My Photo.jpg",
    "x".repeat(65),
  ])("rejects %s", (value) => {
    expect(isSafeValue(value)).toBe(false);
  });

  it("accepts controlled identifiers, booleans and bounded numbers", () => {
    expect(isSafeValue("ccc-photo")).toBe(true);
    expect(isSafeValue("/guides/ccc-photo-size")).toBe(true);
    expect(isSafeValue(true)).toBe(true);
    expect(isSafeValue(3)).toBe(true);
    expect(isSafeValue(Number.NaN)).toBe(false);
    expect(isSafeValue(10_000_000)).toBe(false);
  });

  it("keeps context props on every event", () => {
    expect(sanitizeProps("page_view", { route: "/", device_class: "mobile" })).toEqual({
      route: "/",
      device_class: "mobile",
    });
  });

  it("has a small taxonomy with no forbidden property names", () => {
    const names = Object.keys(EVENT_PROPS);
    expect(names).toHaveLength(16);
    const props = Object.values(EVENT_PROPS).flat();
    for (const forbidden of ["filename", "file_name", "url", "email", "phone", "ip", "exif"]) {
      expect(props).not.toContain(forbidden);
    }
  });
});

describe("buckets", () => {
  it("file sizes", () => {
    expect(fileSizeBucket(10 * 1024)).toBe("lt_20kb");
    expect(fileSizeBucket(30 * 1024)).toBe("20_50kb");
    expect(fileSizeBucket(100 * 1024)).toBe("50_200kb");
    expect(fileSizeBucket(500 * 1024)).toBe("200kb_1mb");
    expect(fileSizeBucket(2 * 1024 * 1024)).toBe("1_5mb");
    expect(fileSizeBucket(7 * 1024 * 1024)).toBe("5_10mb");
    expect(fileSizeBucket(20 * 1024 * 1024)).toBe("gte_10mb");
  });

  it("megapixels", () => {
    expect(megapixelBucket(132, 170)).toBe("lt_0.1mp");
    expect(megapixelBucket(800, 600)).toBe("0.1_1mp");
    expect(megapixelBucket(2000, 1500)).toBe("1_4mp");
    expect(megapixelBucket(4000, 3000)).toBe("12_24mp");
    expect(megapixelBucket(8000, 6000)).toBe("gte_24mp");
  });
});

describe("context", () => {
  it("normalizes routes to the pathname only", () => {
    expect(normalizeRoute("/ccc-photo-resizer?name=Ravi")).toBe("/ccc-photo-resizer");
    expect(normalizeRoute("/guides/")).toBe("/guides");
    expect(normalizeRoute("")).toBe("/");
    expect(normalizeRoute("/Ravi Kumar")).toBe("other");
  });

  it("categorizes pages", () => {
    expect(pageCategory("/")).toBe("home");
    expect(pageCategory("/ccc-photo-resizer")).toBe("tool");
    expect(pageCategory("/image-compressor")).toBe("tool");
    expect(pageCategory("/ccc-complete-pack")).toBe("tool");
    expect(pageCategory("/guides")).toBe("guides_index");
    expect(pageCategory("/guides/ibps-photo-size")).toBe("guide");
    expect(pageCategory("/privacy")).toBe("legal");
    expect(pageCategory("/other")).toBe("other");
  });

  it("categorizes every registered tool and guide route (no silent 'other')", () => {
    for (const tool of TOOLS) {
      expect(normalizeRoute(tool.path), tool.id).toBe(tool.path);
      expect(pageCategory(tool.path), tool.id).toBe("tool");
    }
    for (const guide of listGuides()) {
      expect(pageCategory(normalizeRoute(guidePath(guide))), guide.slug).toBe("guide");
    }
  });

  it("classifies devices and browsers", () => {
    expect(deviceClass(390)).toBe("mobile");
    expect(deviceClass(800)).toBe("tablet");
    expect(deviceClass(1280)).toBe("desktop");
    expect(browserFamily("Mozilla/5.0 Chrome/140 Safari/537.36 Edg/140")).toBe("edge");
    expect(browserFamily("Mozilla/5.0 Chrome/140 Safari/537.36")).toBe("chrome");
    expect(browserFamily("Mozilla/5.0 Firefox/142")).toBe("firefox");
    expect(browserFamily("Mozilla/5.0 Version/18 Safari/605")).toBe("safari");
    expect(browserFamily("curl/8")).toBe("other");
  });

  it("categorizes referrers without keeping the URL", () => {
    const host = "examphotofixer.example";
    expect(referrerCategory("", host)).toBe("direct");
    expect(referrerCategory(`https://${host}/guides`, host)).toBe("direct");
    expect(referrerCategory("https://www.google.com/search?q=ccc+photo", host)).toBe(
      "organic_search",
    );
    expect(referrerCategory("https://www.bing.com/", host)).toBe("organic_search");
    expect(referrerCategory("https://l.facebook.com/", host)).toBe("social");
    expect(referrerCategory("https://t.co/abc", host)).toBe("social");
    expect(referrerCategory("https://forum.example.org/thread", host)).toBe("referral");
    expect(referrerCategory("not a url", host)).toBe("other");
  });

  it("keeps only whitelisted, simple UTM values", () => {
    expect(
      utmParams("?utm_source=Newsletter&utm_medium=email&utm_term=ravi&q=secret&name=Ravi"),
    ).toEqual({ utm_source: "newsletter", utm_medium: "email" });
    expect(utmParams("?utm_campaign=ravi%40example.com")).toEqual({});
  });
});

describe("reason codes", () => {
  const check = (id: string, status: string) => ({ id, status }) as never;

  it("maps failed checks in report order", () => {
    const checks = [
      check("dimensions", "pass"),
      check("format", "fail"),
      check("file-size", "fail"),
      check("dpi", "fail"),
      check("metadata", "fail"),
    ];
    expect(
      validationReasonCodes({ checks, compressionStatus: "above_maximum", outputDpi: null }),
    ).toEqual(["FORMAT_MISMATCH", "FILE_TOO_LARGE", "DPI_MISSING", "METADATA_PRESENT"]);
  });

  it("distinguishes too small, too large and DPI out of range", () => {
    const checks = [check("file-size", "fail")];
    expect(primaryReasonCode({ checks, compressionStatus: "below_minimum" })).toBe(
      "FILE_TOO_SMALL",
    );
    expect(primaryReasonCode({ checks, compressionStatus: "within_range" })).toBe(
      "FILE_SIZE_OUT_OF_RANGE",
    );
    expect(primaryReasonCode({ checks: [check("dpi", "fail")], outputDpi: { x: 72, y: 72 } })).toBe(
      "DPI_OUT_OF_RANGE",
    );
  });

  it("returns nothing when every check passed", () => {
    expect(primaryReasonCode({ checks: [check("dimensions", "pass")] })).toBeUndefined();
  });
});

describe("funnel formulas", () => {
  const counts = {
    tool_viewed: 200,
    image_selected: 100,
    processing_started: 80,
    processing_completed: 75, // 50 READY + 10 READY_WITH_WARNING + 15 INVALID
    result_ready: 50,
    result_ready_with_warning: 10,
    validation_failed: 15,
    processing_failed: 5,
    download_started: 45,
    download_completed: 45,
    download_completed_ready: 40,
    download_completed_warning: 5,
  };

  it("computes rates from counts", () => {
    const rates = funnelRates(counts);
    expect(rates.tool_select_rate).toBe(0.5);
    expect(rates.processing_completion_rate).toBe(0.9375);
    expect(rates.download_rate).toBe(0.6);
    expect(rates.successful_download_rate).toBe(0.8);
    expect(rates.warning_download_rate).toBe(0.5);
    expect(rates.ready_rate).toBe(0.625);
    expect(rates.warning_rate).toBe(0.125);
    expect(rates.invalid_rate! + rates.error_rate!).toBe(0.25);
  });

  it("returns null instead of a made-up rate for empty denominators", () => {
    expect(rate(3, 0)).toBeNull();
    expect(funnelRates({ ...counts, tool_viewed: 0 }).tool_select_rate).toBeNull();
    expect(
      funnelRates({ ...counts, result_ready_with_warning: 0 }).warning_download_rate,
    ).toBeNull();
  });
});

describe("trackJobResult", () => {
  const base = { tool_id: "ccc-photo", tool_type: "preset", exam_id: "ccc" };

  it.each([
    ["READY", "result_ready"],
    ["READY_WITH_WARNING", "result_ready_with_warning"],
    ["INVALID", "validation_failed"],
    ["ERROR", "processing_failed"],
  ] as const)("%s → exactly one %s event", (state, name) => {
    const provider = vi.fn();
    setAnalyticsProvider(provider);
    trackJobResult(base, state, { reason_code: "FILE_TOO_SMALL", error_code: "decode-failed" });
    expect(provider).toHaveBeenCalledTimes(1);
    const event = provider.mock.calls[0][0] as AnalyticsEvent;
    expect(event.name).toBe(name);
    expect(event.props.result_state).toBe(state);
    // Reason codes only where they explain the state; error codes only for errors.
    expect("reason_code" in event.props).toBe(
      state === "READY_WITH_WARNING" || state === "INVALID",
    );
    expect("error_code" in event.props).toBe(state === "ERROR");
  });
});
