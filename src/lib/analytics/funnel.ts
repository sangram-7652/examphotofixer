/**
 * Conversion formulas over event counts (see docs/ANALYTICS.md). Rates are
 * `null` when the denominator is zero, never a made-up 0 or 100%. READY and
 * READY_WITH_WARNING are always kept apart.
 */

export interface FunnelCounts {
  tool_viewed: number;
  image_selected: number;
  processing_started: number;
  /** Jobs that produced output (READY, READY_WITH_WARNING or INVALID). */
  processing_completed: number;
  result_ready: number;
  result_ready_with_warning: number;
  validation_failed: number;
  processing_failed: number;
  download_started: number;
  download_completed: number;
  /** download_completed events whose result_state is READY. */
  download_completed_ready: number;
  /** download_completed events whose result_state is READY_WITH_WARNING. */
  download_completed_warning: number;
}

export interface FunnelRates {
  /** image_selected ÷ tool_viewed */
  tool_select_rate: number | null;
  /** processing_completed ÷ processing_started */
  processing_completion_rate: number | null;
  /** download_completed ÷ processing_completed */
  download_rate: number | null;
  /** download_completed (READY) ÷ result_ready */
  successful_download_rate: number | null;
  /** download_completed (READY_WITH_WARNING) ÷ result_ready_with_warning */
  warning_download_rate: number | null;
  /** result_ready ÷ processing_started (fully compliant outputs) */
  ready_rate: number | null;
  /** result_ready_with_warning ÷ processing_started (kept separate from READY) */
  warning_rate: number | null;
  /** validation_failed ÷ processing_started */
  invalid_rate: number | null;
  /** processing_failed ÷ processing_started */
  error_rate: number | null;
}

export function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function funnelRates(c: FunnelCounts): FunnelRates {
  return {
    tool_select_rate: rate(c.image_selected, c.tool_viewed),
    processing_completion_rate: rate(c.processing_completed, c.processing_started),
    download_rate: rate(c.download_completed, c.processing_completed),
    successful_download_rate: rate(c.download_completed_ready, c.result_ready),
    warning_download_rate: rate(c.download_completed_warning, c.result_ready_with_warning),
    ready_rate: rate(c.result_ready, c.processing_started),
    warning_rate: rate(c.result_ready_with_warning, c.processing_started),
    invalid_rate: rate(c.validation_failed, c.processing_started),
    error_rate: rate(c.processing_failed, c.processing_started),
  };
}
