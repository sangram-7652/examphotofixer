/**
 * GA4 (gtag.js) provider adapter: the one place that knows GA4 exists. Loads
 * only in the browser, only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set to a
 * valid GA4 ID and analytics are not disabled, and configures GA4 cookieless
 * (`client_storage: "none"`) so it never sets `_ga`/`_ga_*` cookies — the
 * product's "no cookies" commitment (docs/PRIVACY.md) holds with GA4 enabled
 * too, at the cost of session/returning-visitor accuracy in GA4's own reports.
 *
 * `trackEvent` (see ../index.ts) has already allowlisted and sanitized
 * `event.props` before this module ever sees an event; nothing here adds a
 * value back in, so the same privacy guarantees apply to what GA4 receives.
 */
import { analyticsDisabled } from "../index";
import type { AnalyticsEvent } from "../index";
import type { AnalyticsEventName, PropValue } from "../taxonomy";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * ExamPhotoFixer event name → GA4 event name. Identity for every event today:
 * existing names are kept rather than renamed to GA4's recommended names.
 * Exhaustive over `AnalyticsEventName`, so adding an event to the taxonomy
 * without updating this map is a type error, never a silent gap.
 */
const GA4_EVENT_NAME: Record<AnalyticsEventName, string> = {
  page_view: "page_view",
  tool_viewed: "tool_viewed",
  exam_selected: "exam_selected",
  image_selected: "image_selected",
  processing_started: "processing_started",
  processing_completed: "processing_completed",
  processing_failed: "processing_failed",
  validation_failed: "validation_failed",
  result_ready: "result_ready",
  result_ready_with_warning: "result_ready_with_warning",
  download_started: "download_started",
  download_completed: "download_completed",
  pack_asset_completed: "pack_asset_completed",
  pack_completed: "pack_completed",
  guide_tool_clicked: "guide_tool_clicked",
  requirement_source_opened: "requirement_source_opened",
};

// A GA4 property's measurement ID always starts with "G-"; a Universal Analytics
// "UA-..." property ID (or anything else) is rejected rather than sent to gtag.js.
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

/**
 * The configured measurement ID, or `null` if GA4 must not run: analytics are
 * disabled, the variable is unset, or it doesn't look like a GA4 ID.
 */
export function resolveGa4MeasurementId(): string | null {
  if (analyticsDisabled()) return null;
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id && MEASUREMENT_ID_PATTERN.test(id) ? id : null;
}

let loaded = false;

/**
 * Injects the gtag.js script once and configures GA4 cookieless, with its own
 * automatic page_view turned off — `AnalyticsRoot` already sends exactly one
 * `page_view` per route through `trackEvent`, and GA4 must not send a second.
 */
export function loadGa4(measurementId: string): void {
  if (typeof window === "undefined" || loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  const dataLayer = window.dataLayer;
  window.gtag = function gtag(...args: unknown[]) {
    dataLayer.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false,
    client_storage: "none",
  });
  if (typeof document === "undefined") return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

function toGa4Param(value: PropValue): string | number {
  // GA4 custom event parameters are string or numeric; booleans are stringified
  // rather than risk silent coercion/drop by gtag.js or the Measurement Protocol.
  return typeof value === "boolean" ? String(value) : value;
}

/** The `AnalyticsProvider` registered with `setAnalyticsProvider` when GA4 is enabled. */
export function sendToGa4(event: AnalyticsEvent): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(event.props)) {
    params[key] = toGa4Param(value);
  }
  window.gtag("event", GA4_EVENT_NAME[event.name], params);
}

/** Test-only: clears the "script already injected" guard between tests. */
export function __resetGa4ForTests(): void {
  loaded = false;
}
