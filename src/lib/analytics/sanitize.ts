import { CONTEXT_PROPS, EVENT_PROPS, type AnalyticsEventName, type PropValue } from "./taxonomy";

/**
 * Only controlled identifiers pass: letters, digits, "_", "-", "." and "/", at
 * most 64 characters. This rejects blob:/data: URLs, spaces, "@", query strings
 * and long free text. Keys must be on the event's allowlist.
 */
const SAFE_STRING = /^[A-Za-z0-9_\-./]{1,64}$/;
const FORBIDDEN = /blob:|data:|base64|https?:|@/i;

export function isSafeValue(value: unknown): value is PropValue {
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value) && Math.abs(value) <= 1_000_000;
  return typeof value === "string" && SAFE_STRING.test(value) && !FORBIDDEN.test(value);
}

export function sanitizeProps(
  name: AnalyticsEventName,
  props: Record<string, unknown>,
): Record<string, PropValue> {
  const allowed = new Set<string>([...EVENT_PROPS[name], ...CONTEXT_PROPS]);
  const clean: Record<string, PropValue> = {};
  for (const [key, value] of Object.entries(props)) {
    if (allowed.has(key) && isSafeValue(value)) clean[key] = value;
  }
  return clean;
}
