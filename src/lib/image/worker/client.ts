/**
 * Main-thread API for image processing. React components use only this module:
 * it hides the worker, its protocol and all browser plumbing.
 *
 * `processImage` never rejects. It resolves to `{ ok: true, result }` or
 * `{ ok: false, error }` with a structured, user-presentable error.
 */

import type { CropSpec } from "../crop";
import { isImageProcessingSupported } from "../support";
import {
  PROCESSING_ERROR_MESSAGES,
  type OutputRequirements,
  type ProcessingErrorCode,
  type ProcessingStage,
} from "../pipeline";
import type {
  ImageProcessingErrorInfo,
  ImageProcessingProgress,
  ImageProcessingRequest,
  ImageProcessingResult,
  WorkerResponse,
} from "./protocol";

export type {
  ImageProcessingErrorInfo,
  ImageProcessingProgress,
  ImageProcessingResult,
} from "./protocol";

export type ImageProcessingOutcome =
  { ok: true; result: ImageProcessingResult } | { ok: false; error: ImageProcessingErrorInfo };

/** The subset of `Worker` the client relies on (lets tests inject a fake). */
export interface WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: ImageProcessingRequest): void;
  terminate(): void;
}

export interface ProcessImageOptions {
  requirements: OutputRequirements;
  crop?: CropSpec;
  onProgress?: (progress: ImageProcessingProgress) => void;
  signal?: AbortSignal;
  /** Default 60 s. */
  timeoutMs?: number;
  /** Test hook; defaults to the bundled image worker. */
  createWorker?: () => WorkerLike;
}

export const DEFAULT_TIMEOUT_MS = 60_000;

function createImageWorker(): WorkerLike {
  return new Worker(new URL("./image.worker.ts", import.meta.url), {
    type: "module",
    name: "image-processor",
  }) as WorkerLike;
}

export { isImageProcessingSupported };

let jobCounter = 0;

function failure(
  code: ProcessingErrorCode,
  stage: ProcessingStage = "worker",
): ImageProcessingOutcome {
  return { ok: false, error: { code, stage, message: PROCESSING_ERROR_MESSAGES[code] } };
}

export function processImage(
  file: Blob,
  options: ProcessImageOptions,
): Promise<ImageProcessingOutcome> {
  const { signal, onProgress, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  if (signal?.aborted) return Promise.resolve(failure("aborted"));
  if (!options.createWorker && !isImageProcessingSupported()) {
    return Promise.resolve(failure("unsupported-browser", "loading"));
  }

  return new Promise((resolve) => {
    const jobId = `job-${Date.now().toString(36)}-${++jobCounter}`;
    let worker: WorkerLike;
    try {
      worker = (options.createWorker ?? createImageWorker)();
    } catch {
      resolve(failure("unsupported-browser", "loading"));
      return;
    }

    let settled = false;
    const finish = (outcome: ImageProcessingOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      resolve(outcome);
    };
    const onAbort = () => finish(failure("aborted"));
    const timer = setTimeout(() => finish(failure("timeout")), timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });

    worker.onmessage = (event) => {
      const message = event.data;
      if (!message || message.jobId !== jobId) return;
      if (message.type === "progress") {
        onProgress?.(message.progress);
      } else if (message.type === "result") {
        finish({ ok: true, result: message.result });
      } else if (message.type === "error") {
        finish({ ok: false, error: message.error });
      }
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      finish(failure("worker-failed"));
    };
    worker.onmessageerror = () => finish(failure("worker-failed"));

    try {
      worker.postMessage({
        type: "process",
        jobId,
        file,
        requirements: options.requirements,
        crop: options.crop,
      });
    } catch {
      finish(failure("worker-failed"));
    }
  });
}
