/**
 * Offline report over an exported event stream (docs/GROWTH_PLAN.md). Input is newline-
 * delimited JSON, one sanitized `{ "name", "props" }` event per line, exactly what
 * `trackEvent` hands to a provider. No provider is installed yet, so no real export exists.
 *
 * Every rate carries its denominator and is withheld (`null`) below `minSample`: the report
 * never presents a rate from a handful of events. READY and READY_WITH_WARNING stay separate.
 * Rates count events, not people (there are no identifiers), so a rate such as selections per
 * tool view can exceed 100% when one visitor tries several files.
 */

import { funnelRates, type FunnelCounts, type FunnelRates } from "./funnel";

export interface ExportedEvent {
  name: string;
  props: Record<string, string | number | boolean>;
}

export function parseEventExport(text: string): ExportedEvent[] {
  const events: ExportedEvent[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim() === "" || line.trim().startsWith("#")) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`Line ${index + 1}: not JSON.`);
    }
    const event = parsed as Partial<ExportedEvent>;
    if (typeof event.name !== "string" || typeof event.props !== "object" || !event.props) {
      throw new Error(`Line ${index + 1}: expected { "name", "props" }.`);
    }
    events.push({ name: event.name, props: event.props });
  });
  return events;
}

export function funnelCounts(events: readonly ExportedEvent[]): FunnelCounts {
  const count = (name: string, state?: string) =>
    events.filter(
      (event) => event.name === name && (state === undefined || event.props.result_state === state),
    ).length;
  return {
    tool_viewed: count("tool_viewed"),
    // Accepted files only; rejected files are problem signals (see reasonCounts).
    image_selected: events.filter((e) => e.name === "image_selected" && e.props.accepted === true)
      .length,
    processing_started: count("processing_started"),
    processing_completed: count("processing_completed"),
    result_ready: count("result_ready"),
    result_ready_with_warning: count("result_ready_with_warning"),
    validation_failed: count("validation_failed"),
    processing_failed: count("processing_failed"),
    download_started: count("download_started"),
    download_completed: count("download_completed"),
    download_completed_ready: count("download_completed", "READY"),
    download_completed_warning: count("download_completed", "READY_WITH_WARNING"),
  };
}

/** Denominator of each rate in `funnelRates`, so small samples can be withheld. */
function denominators(c: FunnelCounts): Record<keyof FunnelRates, number> {
  return {
    tool_select_rate: c.tool_viewed,
    processing_completion_rate: c.processing_started,
    download_rate: c.processing_completed,
    successful_download_rate: c.result_ready,
    warning_download_rate: c.result_ready_with_warning,
    ready_rate: c.processing_started,
    warning_rate: c.processing_started,
    invalid_rate: c.processing_started,
    error_rate: c.processing_started,
  };
}

export interface GatedRate {
  rate: number | null;
  denominator: number;
  /** false when the denominator is below the minimum sample. */
  sufficient: boolean;
}

export function gatedFunnel(
  counts: FunnelCounts,
  minSample: number,
): Record<keyof FunnelRates, GatedRate> {
  const rates = funnelRates(counts);
  const denoms = denominators(counts);
  const out = {} as Record<keyof FunnelRates, GatedRate>;
  for (const key of Object.keys(rates) as (keyof FunnelRates)[]) {
    const sufficient = denoms[key] >= minSample;
    out[key] = { rate: sufficient ? rates[key] : null, denominator: denoms[key], sufficient };
  }
  return out;
}

/** Funnel per tool_id (pack steps included under the pack's id). */
export function funnelByTool(events: readonly ExportedEvent[]): Map<string, FunnelCounts> {
  const byTool = new Map<string, ExportedEvent[]>();
  for (const event of events) {
    const tool = event.props.tool_id;
    if (typeof tool !== "string") continue;
    (byTool.get(tool) ?? byTool.set(tool, []).get(tool)!).push(event);
  }
  return new Map([...byTool].map(([tool, list]) => [tool, funnelCounts(list)]));
}

export interface ReasonCount {
  key: string;
  count: number;
  /** Share of the event it explains (e.g. of all validation_failed). */
  share: number;
}

/**
 * Problem discovery: how often each reason/error code explains a failed or warning result, or a
 * rejected file. Codes below `minCount` occurrences are reported as insufficient by the caller.
 */
export function reasonCounts(
  events: readonly ExportedEvent[],
): Record<
  "validation_failed" | "result_ready_with_warning" | "processing_failed" | "image_rejected",
  ReasonCount[]
> {
  const tally = (list: readonly ExportedEvent[], prop: string): ReasonCount[] => {
    const counts = new Map<string, number>();
    for (const event of list) {
      const key = String(event.props[prop] ?? "UNSPECIFIED");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts]
      .map(([key, count]) => ({ key, count, share: count / list.length }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  };
  const named = (name: string) => events.filter((event) => event.name === name);
  return {
    validation_failed: tally(named("validation_failed"), "reason_code"),
    result_ready_with_warning: tally(named("result_ready_with_warning"), "reason_code"),
    processing_failed: tally(named("processing_failed"), "error_code"),
    image_rejected: tally(
      named("image_selected").filter((event) => event.props.accepted === false),
      "error_code",
    ),
  };
}

export interface RouteEngagement {
  route: string;
  pageViews: number;
  organicLandings: number;
  /** tool_viewed → image_selected on tool pages; guide_tool_clicked on guides. */
  engaged: number;
  engagementRate: GatedRate;
}

/**
 * Per-route engagement, for joining with Search Console pages: did people who landed on a
 * page use it? Tool pages: image_selected (accepted) per tool_viewed. Guides: guide_tool_clicked
 * per page_view.
 */
export function engagementByRoute(
  events: readonly ExportedEvent[],
  minSample: number,
): RouteEngagement[] {
  const routes = new Map<
    string,
    { views: number; organic: number; toolViews: number; engaged: number; kind: string }
  >();
  for (const event of events) {
    const route = event.props.route;
    if (typeof route !== "string") continue;
    const entry = routes.get(route) ?? {
      views: 0,
      organic: 0,
      toolViews: 0,
      engaged: 0,
      kind: String(event.props.page_category ?? "other"),
    };
    if (event.name === "page_view") {
      entry.views++;
      if (event.props.referrer_category === "organic_search") entry.organic++;
    } else if (event.name === "tool_viewed") {
      entry.toolViews++;
    } else if (event.name === "image_selected" && event.props.accepted === true) {
      entry.engaged++;
    } else if (event.name === "guide_tool_clicked") {
      entry.engaged++;
    }
    routes.set(route, entry);
  }
  return [...routes]
    .map(([route, entry]) => {
      const denominator = entry.kind === "tool" ? entry.toolViews : entry.views;
      const sufficient = denominator >= minSample;
      return {
        route,
        pageViews: entry.views,
        organicLandings: entry.organic,
        engaged: entry.engaged,
        engagementRate: {
          rate: sufficient && denominator > 0 ? entry.engaged / denominator : null,
          denominator,
          sufficient,
        },
      };
    })
    .sort((a, b) => b.pageViews - a.pageViews || a.route.localeCompare(b.route));
}
