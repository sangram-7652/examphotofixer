import { readFile } from "node:fs/promises";
import type { Download, Locator, Page } from "@playwright/test";

/**
 * Shared e2e helpers. Test images are generated in the page (deterministic
 * canvas patterns), so no fixture files or network access are needed.
 */

export type Pattern = "noise" | "flat";

/** Encodes a test image in the page and returns its bytes. */
export async function makeImage(
  page: Page,
  pattern: Pattern,
  width: number,
  height: number,
  type = "image/jpeg",
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ pattern, width, height, type }) => {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d")!;
      if (pattern === "flat") {
        ctx.fillStyle = "#d0d0d0";
        ctx.fillRect(0, 0, width, height);
      } else {
        let seed = 7;
        const random = () => {
          seed = (seed * 1103515245 + 12345) & 0x7fffffff;
          return seed / 0x7fffffff;
        };
        const image = ctx.createImageData(width, height);
        for (let i = 0; i < image.data.length; i += 4) {
          image.data[i] = random() * 256;
          image.data[i + 1] = random() * 256;
          image.data[i + 2] = random() * 256;
          image.data[i + 3] = 255;
        }
        ctx.putImageData(image, 0, 0);
      }
      const blob = await canvas.convertToBlob({ type, quality: 0.92 });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(binary);
    },
    { pattern, width, height, type },
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

/** Captures provider-independent analytics event names (call before navigation). */
export async function recordAnalytics(page: Page) {
  await page.addInitScript(() => {
    const events: string[] = [];
    (window as unknown as { __events: string[] }).__events = events;
    window.addEventListener("epf:analytics", (event) =>
      events.push((event as CustomEvent<{ name: string }>).detail.name),
    );
  });
}

export function analyticsEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __events: string[] }).__events);
}

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
