/**
 * The analytics event taxonomy: a small, stable set of events, each with an
 * allowlist of non-sensitive properties. Anything not listed is dropped by the
 * sanitizer, so a caller can't accidentally send a filename or image data.
 * Purposes are documented in docs/ANALYTICS.md.
 */

/** Added automatically to every event (see context.ts). */
export const CONTEXT_PROPS = ["route", "page_category", "device_class", "browser_family"] as const;

const TOOL = ["tool_id", "tool_type", "exam_id", "asset_type"] as const;

export const EVENT_PROPS = {
  page_view: ["referrer_category", "utm_source", "utm_medium", "utm_campaign"],
  tool_viewed: ["tool_id", "tool_type", "exam_id"],
  exam_selected: ["exam_id", "destination_tool_id", "source_page_category"],
  image_selected: [
    ...TOOL,
    "accepted",
    "input_format",
    "input_size_bucket",
    "input_megapixel_bucket",
    "error_code",
  ],
  processing_started: [...TOOL, "output_format"],
  processing_completed: [
    ...TOOL,
    "output_format",
    "result_state",
    "output_size_bucket",
    "output_megapixel_bucket",
  ],
  processing_failed: [...TOOL, "output_format", "result_state", "error_code"],
  validation_failed: [...TOOL, "output_format", "result_state", "reason_code"],
  result_ready: [...TOOL, "output_format", "result_state"],
  result_ready_with_warning: [...TOOL, "output_format", "result_state", "reason_code"],
  download_started: [...TOOL, "output_format", "result_state"],
  download_completed: [...TOOL, "output_format", "result_state"],
  pack_asset_completed: [...TOOL, "result_state"],
  pack_completed: ["tool_id", "tool_type", "exam_id", "result_state", "asset_count"],
  guide_tool_clicked: ["guide_id", "tool_id", "source_page_category"],
  requirement_source_opened: ["source_id", "page_category", "tool_id", "guide_id"],
} as const satisfies Record<string, readonly string[]>;

export type AnalyticsEventName = keyof typeof EVENT_PROPS;

export type PropValue = string | number | boolean;

export type EventProps<N extends AnalyticsEventName> = Partial<
  Record<(typeof EVENT_PROPS)[N][number], PropValue>
>;

/** Events that may be triggered from server-rendered links via data attributes. */
export const LINK_EVENTS = ["guide_tool_clicked", "requirement_source_opened"] as const;

export function isEventName(name: string): name is AnalyticsEventName {
  return Object.prototype.hasOwnProperty.call(EVENT_PROPS, name);
}
