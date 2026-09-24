import { afterEach, describe, expect, it } from "vitest";
import { setAnalyticsProvider, sizeBucket, track, type AnalyticsEvent } from ".";

afterEach(() => setAnalyticsProvider(null));

describe("analytics", () => {
  it("forwards events to the registered provider", () => {
    const events: AnalyticsEvent[] = [];
    setAnalyticsProvider((event) => events.push(event));
    track("tool_open", { tool_id: "ccc-photo" });
    expect(events).toEqual([{ name: "tool_open", props: { tool_id: "ccc-photo" } }]);
  });

  it("never throws when a provider fails", () => {
    setAnalyticsProvider(() => {
      throw new Error("provider down");
    });
    expect(() => track("tool_reset")).not.toThrow();
  });

  it("buckets file sizes coarsely", () => {
    expect(sizeBucket(200_000)).toBe("<1MB");
    expect(sizeBucket(3 * 1024 * 1024)).toBe("1-5MB");
    expect(sizeBucket(30 * 1024 * 1024)).toBe(">10MB");
  });
});
