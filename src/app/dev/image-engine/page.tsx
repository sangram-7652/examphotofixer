import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EngineHarness } from "./EngineHarness";

export const metadata: Metadata = {
  title: "Image engine harness",
  robots: { index: false, follow: false },
};

/**
 * Browser test harness for the image engine (used by e2e/image-engine.spec.ts).
 * Returns 404 unless the server runs with ENGINE_HARNESS=1, checked per request,
 * so production deployments never expose it.
 */
export default async function ImageEngineHarnessPage() {
  await connection();
  if (process.env.ENGINE_HARNESS !== "1") notFound();
  return <EngineHarness />;
}
