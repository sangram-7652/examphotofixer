"use client";

import { detectEncodableFormats } from "@/lib/image/support";
import { dpiRoundTrip, runScenario } from "./scenarios";

if (typeof window !== "undefined") {
  window.__engineHarness = { runScenario, dpiRoundTrip, encodableFormats: detectEncodableFormats };
}

export function EngineHarness() {
  return <p className="p-4">Image engine test harness</p>;
}
