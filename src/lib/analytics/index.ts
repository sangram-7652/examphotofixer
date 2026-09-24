/**
 * Provider-independent analytics hooks. No provider is installed yet: events
 * are dispatched as a DOM event (`epf:analytics`) and to an optional provider
 * registered with `setAnalyticsProvider`. Never include file names, image
 * contents or anything derived from the image (see docs/ANALYTICS.md).
 */

export type AnalyticsEventName =
  | "tool_open"
  | "image_selected"
  | "crop_started"
  | "crop_completed"
  | "processing_started"
  | "processing_completed"
  | "validation_passed"
  | "validation_warning"
  | "validation_failed"
  | "download_clicked"
  | "download_completed"
  | "tool_reset"
  // Generic tools: which setting changed (never values tied to the user's file).
  | "resize_settings_changed"
  | "compression_settings_changed"
  // Complete Pack. Per-asset steps reuse the events above (tool_id = the pack's id).
  | "pack_open"
  | "pack_download_clicked"
  | "pack_download_completed"
  | "pack_reset";

/** Allowed property values: short, non-identifying primitives only. */
export type AnalyticsProps = Record<string, string | number | boolean>;

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props: AnalyticsProps;
}

export type AnalyticsProvider = (event: AnalyticsEvent) => void;

let provider: AnalyticsProvider | null = null;

export function setAnalyticsProvider(next: AnalyticsProvider | null): void {
  provider = next;
}

export const ANALYTICS_DOM_EVENT = "epf:analytics";

export function track(name: AnalyticsEventName, props: AnalyticsProps = {}): void {
  const event: AnalyticsEvent = { name, props };
  try {
    provider?.(event);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ANALYTICS_DOM_EVENT, { detail: event }));
    }
  } catch {
    // Analytics must never break the tool.
  }
}

/** Coarse size bucket; exact file sizes are not reported. */
export function sizeBucket(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return "<1MB";
  if (mb < 5) return "1-5MB";
  if (mb < 10) return "5-10MB";
  return ">10MB";
}
