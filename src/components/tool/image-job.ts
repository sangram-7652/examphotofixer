"use client";

/**
 * Shared client plumbing for image tools: reading a selected file, tracking
 * object URLs, and running one engine job at a time. Processing itself always
 * happens in the engine worker (loaded on demand).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FORMAT_SNIFF_BYTES,
  detectImageFormat,
  mayHaveTransparency,
  type ImageFormat,
} from "@/lib/image/formats";
import type { ProgressStage, ProcessingErrorCode } from "@/lib/image/pipeline";
import type { ImageProcessingOutcome, ProcessImageOptions } from "@/lib/image/worker/client";
import { checkInputFile } from "@/lib/validation/validate";

/** Enough of the file to read PNG chunks before image data (for transparency detection). */
const HEADER_BYTES = 256 * 1024;

export interface SelectedImage {
  file: File;
  url: string;
  /** Natural (EXIF-oriented) size as the browser displays it. */
  width: number;
  height: number;
  format: ImageFormat;
  mayHaveTransparency: boolean;
}

export type SelectResult =
  { ok: true; image: SelectedImage } | { ok: false; reason: ProcessingErrorCode | "unreadable" };

function loadImageSize(url: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  return image.decode().then(() => ({ width: image.naturalWidth, height: image.naturalHeight }));
}

/**
 * Validates a user's file by content (not extension) and reads its size.
 * `createUrl`/`releaseUrl` come from `useObjectUrls` so the URL is tracked.
 */
export async function readSelectedImage(
  file: File,
  createUrl: (blob: Blob) => string,
  releaseUrl: (url: string) => void,
): Promise<SelectResult> {
  const head = new Uint8Array(
    await file.slice(0, Math.max(FORMAT_SNIFF_BYTES, HEADER_BYTES)).arrayBuffer(),
  );
  const format = detectImageFormat(head);
  const rejection = checkInputFile({ byteLength: file.size, format });
  if (rejection || !format) return { ok: false, reason: rejection ?? "unsupported-format" };
  const url = createUrl(file);
  try {
    const size = await loadImageSize(url);
    if (size.width < 1 || size.height < 1) throw new Error("zero-size image");
    return {
      ok: true,
      image: { file, url, ...size, format, mayHaveTransparency: mayHaveTransparency(head, format) },
    };
  } catch {
    releaseUrl(url);
    return { ok: false, reason: "unreadable" };
  }
}

/** Object URLs owned by a component; all are revoked on `releaseAll` and on unmount. */
export function useObjectUrls() {
  const urls = useRef(new Set<string>());
  const create = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  }, []);
  const release = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }, []);
  const releaseAll = useCallback(() => {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
  }, []);
  useEffect(() => releaseAll, [releaseAll]);
  return { create, release, releaseAll };
}

/**
 * One engine job at a time. `run` resolves to the engine outcome, or `null`
 * if the job was cancelled (reset, a newer job, or unmount).
 */
export function useImageJob() {
  const [stage, setStage] = useState<ProgressStage | null>(null);
  const controller = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  const run = useCallback(
    async (
      file: Blob,
      options: Omit<ProcessImageOptions, "signal" | "onProgress" | "createWorker">,
    ): Promise<ImageProcessingOutcome | null> => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setStage(null);
      let outcome: ImageProcessingOutcome;
      try {
        const { processImage } = await import("@/lib/image/worker/client");
        outcome = await processImage(file, {
          ...options,
          signal: current.signal,
          onProgress: (progress) => {
            if (!current.signal.aborted) setStage(progress.stage);
          },
        });
      } catch {
        outcome = {
          ok: false,
          error: { code: "internal-error", stage: "worker", message: "Processing failed." },
        };
      }
      if (current.signal.aborted) return null;
      controller.current = null;
      return outcome;
    },
    [],
  );

  /** Preloads the engine client (e.g. once a file is chosen). */
  const warmUp = useCallback(() => void import("@/lib/image/worker/client"), []);

  return { stage, run, cancel, warmUp };
}
