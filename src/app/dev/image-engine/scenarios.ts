/**
 * Harness scenarios: build deterministic fixture images in the browser, run
 * them through the real worker via the public client API, and return a
 * JSON-serialisable summary for Playwright assertions.
 */

import type { CropSpec } from "@/lib/image/crop";
import { readDpi, writeDpi } from "@/lib/image/dpi";
import { detectImageFormat } from "@/lib/image/formats";
import { listJpegMetadata } from "@/lib/image/jpeg";
import type { OutputRequirements } from "@/lib/image/pipeline";
import { insertExif, type ExifFixture } from "@/lib/image/testing/exif-builder";
import { processImage, type ImageProcessingErrorInfo } from "@/lib/image/worker/client";
import type { ImageProcessingResult } from "@/lib/image/worker/protocol";

declare global {
  interface Window {
    /** Installed by EngineHarness; driven by Playwright. */
    __engineHarness?: { runScenario: typeof runScenario; dpiRoundTrip: typeof dpiRoundTrip };
  }
}

export type Pattern =
  "quadrants" | "stripes" | "noise" | "flat" | "transparent" | "semi-transparent" | "opaque";

export interface FixtureSpec {
  pattern: Pattern;
  width: number;
  height: number;
  type: "image/jpeg" | "image/png" | "image/webp";
  quality?: number;
  exif?: ExifFixture;
  /** Keep only the first N bytes (simulates a broken download). */
  truncateTo?: number;
}

export type InputSpec = { fixture: FixtureSpec } | { bytes: number[]; type: string };

export interface Scenario {
  input: InputSpec;
  requirements: OutputRequirements;
  crop?: CropSpec;
  /** Output pixel coordinates to sample. */
  samples?: [number, number][];
  timeoutMs?: number;
}

export interface ScenarioOutcome {
  ok: boolean;
  error: ImageProcessingErrorInfo | null;
  progress: string[];
  input: { byteLength: number; metadata: string[] };
  result: (Omit<ImageProcessingResult, "blob"> & { blobType: string; magic: string }) | null;
  samples: { x: number; y: number; rgba: number[] }[];
  /** Longest main-thread stall observed while the worker ran. */
  mainThreadMaxGapMs: number;
  durationMs: number;
}

/** Quadrant colours: TL red, TR green, BL blue, BR yellow. Stripes use the same, left→right. */
const COLORS = ["#ff0000", "#00ff00", "#0000ff", "#ffff00"];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function draw(spec: FixtureSpec): OffscreenCanvas {
  const { width: w, height: h } = spec;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  switch (spec.pattern) {
    case "quadrants":
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].forEach(([qx, qy], index) => {
        ctx.fillStyle = COLORS[index];
        ctx.fillRect((qx * w) / 2, (qy * h) / 2, w / 2, h / 2);
      });
      break;
    case "stripes":
      COLORS.forEach((color, index) => {
        ctx.fillStyle = color;
        ctx.fillRect((index * w) / 4, 0, w / 4, h);
      });
      break;
    case "noise": {
      const random = mulberry32(42);
      const image = ctx.createImageData(w, h);
      for (let i = 0; i < image.data.length; i += 4) {
        image.data[i] = random() * 256;
        image.data[i + 1] = random() * 256;
        image.data[i + 2] = random() * 256;
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      break;
    }
    case "flat":
      ctx.fillStyle = "#d0d0d0";
      ctx.fillRect(0, 0, w, h);
      break;
    case "transparent":
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#000000";
      ctx.fillRect(w / 3, h / 3, w / 3, h / 3);
      break;
    case "semi-transparent":
      ctx.fillStyle = "rgba(0, 0, 255, 0.5)";
      ctx.fillRect(0, 0, w, h);
      break;
    case "opaque":
      ctx.fillStyle = "#c81e1e";
      ctx.fillRect(0, 0, w, h);
      break;
  }
  return canvas;
}

async function buildInput(input: InputSpec): Promise<Blob> {
  if ("bytes" in input) return new Blob([new Uint8Array(input.bytes)], { type: input.type });
  const spec = input.fixture;
  const canvas = draw(spec);
  const encoded = await canvas.convertToBlob({ type: spec.type, quality: spec.quality ?? 0.95 });
  canvas.width = 0;
  canvas.height = 0;
  let bytes: Uint8Array<ArrayBuffer> = new Uint8Array(await encoded.arrayBuffer());
  if (spec.exif) bytes = insertExif(bytes, spec.exif);
  if (spec.truncateTo !== undefined) bytes = bytes.slice(0, spec.truncateTo);
  return new Blob([bytes], { type: spec.type });
}

async function sample(blob: Blob, points: [number, number][]) {
  if (points.length === 0) return [];
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return points.map(([x, y]) => ({ x, y, rgba: [...ctx.getImageData(x, y, 1, 1).data] }));
}

export async function runScenario(scenario: Scenario): Promise<ScenarioOutcome> {
  const file = await buildInput(scenario.input);
  const inputBytes = new Uint8Array(await file.arrayBuffer());
  const progress: string[] = [];

  // Measure main-thread responsiveness while the worker runs.
  let last = performance.now();
  let maxGap = 0;
  const ticker = setInterval(() => {
    const now = performance.now();
    maxGap = Math.max(maxGap, now - last);
    last = now;
  }, 10);

  const started = performance.now();
  const outcome = await processImage(file, {
    requirements: scenario.requirements,
    crop: scenario.crop,
    timeoutMs: scenario.timeoutMs,
    onProgress: (p) => progress.push(p.stage),
  });
  const durationMs = performance.now() - started;
  clearInterval(ticker);

  const base = {
    progress,
    input: {
      byteLength: inputBytes.length,
      metadata: detectImageFormat(inputBytes) === "jpeg" ? listJpegMetadata(inputBytes) : [],
    },
    mainThreadMaxGapMs: Math.round(maxGap),
    durationMs: Math.round(durationMs),
  };
  if (!outcome.ok) {
    return { ...base, ok: false, error: outcome.error, result: null, samples: [] };
  }
  const { blob, ...rest } = outcome.result;
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return {
    ...base,
    ok: true,
    error: null,
    result: {
      ...rest,
      blobType: blob.type,
      magic: [...head].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    },
    samples: await sample(blob, scenario.samples ?? []),
  };
}

/** writeDpi → readDpi on a real browser-encoded JPEG. */
export async function dpiRoundTrip(dpi: number) {
  const canvas = draw({ pattern: "quadrants", width: 40, height: 40, type: "image/jpeg" });
  const jpeg = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.9 });
  const before = await readDpi(jpeg);
  const written = await writeDpi(jpeg, dpi);
  const bitmap = await createImageBitmap(written);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return { before, after: await readDpi(written), size };
}
