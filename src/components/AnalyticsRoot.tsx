"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { normalizeRoute, pageCategory, referrerCategory, utmParams } from "@/lib/analytics/context";

/**
 * Site-wide analytics that server-rendered pages can't do themselves: a
 * `page_view` per route (acquisition on the landing view only), and clicks on
 * links marked with `data-analytics-event` (guide → tool, requirement source).
 * Renders nothing and never blocks the page.
 */
export function AnalyticsRoot() {
  const pathname = usePathname();
  const landed = useRef(false);

  // A layout effect runs before the page's own (passive) effects in the same commit, so the
  // page_view precedes e.g. tool_viewed, on landing and after client-side navigation.
  useLayoutEffect(() => {
    if (landed.current) {
      trackEvent("page_view");
      return;
    }
    landed.current = true;
    trackEvent("page_view", {
      referrer_category: referrerCategory(document.referrer, window.location.hostname),
      ...utmParams(window.location.search),
    });
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("a[data-analytics-event]")
          : null;
      if (!link) return;
      const category = pageCategory(normalizeRoute(window.location.pathname));
      // Nearest context: the link itself (a tool CTA) or the page it's on.
      const toolId =
        link.closest("[data-analytics-tool-id]")?.getAttribute("data-analytics-tool-id") ??
        undefined;
      const guideId =
        link.closest("[data-analytics-guide-id]")?.getAttribute("data-analytics-guide-id") ??
        undefined;
      const name = link.getAttribute("data-analytics-event");
      if (name === "guide_tool_clicked" && toolId && guideId) {
        trackEvent("guide_tool_clicked", {
          guide_id: guideId,
          tool_id: toolId,
          source_page_category: category,
        });
      } else if (name === "requirement_source_opened") {
        trackEvent("requirement_source_opened", {
          source_id: link.getAttribute("data-analytics-source-id") ?? undefined,
          page_category: category,
          tool_id: toolId,
          guide_id: guideId,
        });
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
