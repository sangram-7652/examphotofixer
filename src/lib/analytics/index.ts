/**
 * Provider-independent analytics. Application code calls `trackEvent(name,
 * props)`; a provider can be plugged in with `setAnalyticsProvider`. With no
 * provider, events only go to a local DOM event (`epf:analytics`, used by
 * tests and local debugging) — nothing leaves the browser.
 *
 * Guarantees: properties are allowlisted and sanitized; failures are swallowed
 * so analytics can never break a tool; nothing here runs in the image worker.
 * See docs/ANALYTICS.md.
 */

import { browserFamily, deviceClass, normalizeRoute, pageCategory } from "./context";
import { sanitizeProps } from "./sanitize";
import type { AnalyticsEventName, EventProps, PropValue } from "./taxonomy";

export type { AnalyticsEventName, EventProps } from "./taxonomy";
export { fileSizeBucket, megapixelBucket } from "./buckets";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props: Record<string, PropValue>;
}

export type AnalyticsProvider = (event: AnalyticsEvent) => void;

export const ANALYTICS_DOM_EVENT = "epf:analytics";

let provider: AnalyticsProvider | null = null;

export function setAnalyticsProvider(next: AnalyticsProvider | null): void {
  provider = next;
}

/** `NEXT_PUBLIC_ANALYTICS_DISABLED=true` turns every event into a no-op. */
export function analyticsDisabled(): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_DISABLED === "true";
}

function contextProps(): Record<string, PropValue> {
  if (typeof window === "undefined") return {};
  const route = normalizeRoute(window.location.pathname);
  return {
    route,
    page_category: pageCategory(route),
    device_class: deviceClass(window.innerWidth),
    browser_family: browserFamily(window.navigator.userAgent),
  };
}

export function trackEvent<N extends AnalyticsEventName>(name: N, props: EventProps<N> = {}): void {
  if (analyticsDisabled()) return;
  try {
    const event: AnalyticsEvent = {
      name,
      props: sanitizeProps(name, { ...contextProps(), ...props }),
    };
    try {
      provider?.(event);
    } catch {
      // A failing provider must not affect the page or the local event.
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ANALYTICS_DOM_EVENT, { detail: event }));
    }
  } catch {
    // Analytics must never break the tool.
  }
}
