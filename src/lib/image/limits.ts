/**
 * Safety limits for browser-side processing. Inputs beyond these are rejected
 * or downscaled before touching a canvas, to avoid tab crashes on low-end phones.
 */

/** Largest input file accepted, in bytes. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** Largest decoded pixel count accepted at all (e.g. 100 MP). */
export const MAX_INPUT_PIXELS = 100_000_000;

/** Working canvas budget; iOS Safari fails above ~16.7 MP. */
export const MAX_CANVAS_PIXELS = 16_777_216;
