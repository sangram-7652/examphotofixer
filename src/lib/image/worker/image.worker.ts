/**
 * Image worker entry. Keeps heavy decoding, canvas work and encoding off the
 * main thread. One job per worker: the client terminates the worker afterwards,
 * which releases all memory the job used.
 */

import { runImagePipeline } from "../engine";
import { ImageProcessingError, PROCESSING_ERROR_MESSAGES } from "../pipeline";
import {
  progressFor,
  type ImageProcessingErrorInfo,
  type ImageProcessingRequest,
  type WorkerResponse,
} from "./protocol";

interface WorkerScope {
  onmessage: ((event: MessageEvent<ImageProcessingRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

const scope = globalThis as unknown as WorkerScope;

function toErrorInfo(error: unknown): ImageProcessingErrorInfo {
  if (error instanceof ImageProcessingError) {
    return { code: error.code, stage: error.stage, message: error.message };
  }
  return {
    code: "internal-error",
    stage: "worker",
    message: PROCESSING_ERROR_MESSAGES["internal-error"],
  };
}

scope.onmessage = async (event) => {
  const request = event.data;
  if (request?.type !== "process") return;
  const { jobId } = request;
  try {
    const result = await runImagePipeline(
      request.file,
      { requirements: request.requirements, crop: request.crop, encoding: request.encoding },
      (stage) => scope.postMessage({ type: "progress", jobId, progress: progressFor(stage) }),
    );
    scope.postMessage({ type: "result", jobId, result });
  } catch (error) {
    scope.postMessage({ type: "error", jobId, error: toErrorInfo(error) });
  }
};
