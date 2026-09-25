import { readFile } from "node:fs/promises";
import type { Download, Locator, Page } from "@playwright/test";

/**
 * Shared e2e helpers. Test images are generated in the page (deterministic
 * canvas patterns), so no fixture files or network access are needed.
 */

export type Pattern = "noise" | "flat" | "textured" | "transparent";

/**
 * Encodes a deterministic test image in the page and returns its bytes.
 * - noise: random pixels (hard to compress)  - flat: one grey (tiny files)
 * - textured: smooth gradients with light detail (photo-like compressibility)
 * - transparent: transparent background with an opaque square (use PNG/WebP)
 */
export async function makeImage(
  page: Page,
  pattern: Pattern,
  width: number,
  height: number,
  type = "image/jpeg",
  quality = 0.92,
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ pattern, width, height, type, quality }) => {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d")!;
      let seed = 7;
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      if (pattern === "flat") {
        ctx.fillStyle = "#d0d0d0";
        ctx.fillRect(0, 0, width, height);
      } else if (pattern === "transparent") {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "#1d4ed8";
        ctx.fillRect(width / 4, height / 4, width / 2, height / 2);
      } else if (pattern === "textured") {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#7aa5c8");
        gradient.addColorStop(0.5, "#e2c290");
        gradient.addColorStop(1, "#3b5d4a");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        for (let i = 0; i < (width * height) / 400; i++) {
          ctx.fillStyle = `rgba(${Math.floor(random() * 255)}, ${Math.floor(random() * 255)}, 90, 0.35)`;
          ctx.fillRect(random() * width, random() * height, 2 + random() * 6, 2 + random() * 6);
        }
      } else {
        const image = ctx.createImageData(width, height);
        for (let i = 0; i < image.data.length; i += 4) {
          image.data[i] = random() * 256;
          image.data[i + 1] = random() * 256;
          image.data[i + 2] = random() * 256;
          image.data[i + 3] = 255;
        }
        ctx.putImageData(image, 0, 0);
      }
      const blob = await canvas.convertToBlob({ type, quality });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(binary);
    },
    { pattern, width, height, type, quality },
  );
  return Buffer.from(base64, "base64");
}

/** Hands a file to the (visually hidden) file input inside `scope`. */
export async function upload(
  scope: Page | Locator,
  buffer: Buffer,
  name = "my-image.jpg",
  mimeType = "image/jpeg",
) {
  await scope.getByTestId("file-input").setInputFiles({ name, mimeType, buffer });
}

export interface RecordedEvent {
  name: string;
  props: Record<string, string | number | boolean>;
}

/**
 * Captures provider-independent analytics events (call before navigation):
 * names in `__events`, full payloads in `__payloads`. Survives reloads.
 */
export async function recordAnalytics(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __events: string[]; __payloads: unknown[] };
    w.__events = [];
    w.__payloads = [];
    window.addEventListener("epf:analytics", (event) => {
      const detail = (event as CustomEvent<{ name: string }>).detail;
      w.__events.push(detail.name);
      w.__payloads.push(JSON.parse(JSON.stringify(detail)));
    });
  });
}

export function analyticsEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __events: string[] }).__events);
}

export function analyticsPayloads(page: Page): Promise<RecordedEvent[]> {
  return page.evaluate(() => (window as unknown as { __payloads: RecordedEvent[] }).__payloads);
}

/** Result events: exactly one per finished job. */
export const RESULT_EVENTS = [
  "result_ready",
  "result_ready_with_warning",
  "validation_failed",
  "processing_failed",
];

/** Records every non-GET request (an image upload would be a POST/PUT). */
export function recordNonGetRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
  });
  return requests;
}

export function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}

export async function downloadBytes(download: Download): Promise<Uint8Array> {
  return new Uint8Array(await readFile((await download.path())!));
}
