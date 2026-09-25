/**
 * One place that turns a finished job into its single result event, so every
 * tool reports the same mapping: READY → result_ready, READY_WITH_WARNING →
 * result_ready_with_warning, INVALID → validation_failed, ERROR →
 * processing_failed. Exactly one of these is sent per job.
 */

import { trackEvent } from "./index";
import type { ValidationReasonCode } from "./reasons";

export type JobResultState = "READY" | "READY_WITH_WARNING" | "INVALID" | "ERROR";

export interface ToolEventBase {
  tool_id: string;
  tool_type: string;
  exam_id?: string;
  asset_type?: string;
  output_format?: string;
}

export function trackJobResult(
  base: ToolEventBase,
  state: JobResultState,
  detail: { reason_code?: ValidationReasonCode; error_code?: string } = {},
): void {
  switch (state) {
    case "READY":
      trackEvent("result_ready", { ...base, result_state: state });
      return;
    case "READY_WITH_WARNING":
      trackEvent("result_ready_with_warning", {
        ...base,
        result_state: state,
        reason_code: detail.reason_code,
      });
      return;
    case "INVALID":
      trackEvent("validation_failed", {
        ...base,
        result_state: state,
        reason_code: detail.reason_code,
      });
      return;
    case "ERROR":
      trackEvent("processing_failed", {
        ...base,
        result_state: state,
        error_code: detail.error_code,
      });
  }
}
