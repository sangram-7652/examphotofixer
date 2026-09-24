import { PROCESSING_ERROR_MESSAGES, type ProcessingErrorCode } from "@/lib/image/pipeline";

export const ERROR_COPY = {
  unsupported: "This image format isn't supported. Please choose JPG, PNG or WebP.",
  unreadable: "We couldn't read this image. Please try another file.",
  processing: "We couldn't process this image. Please try again.",
  browser: "This browser does not support the image features required by this tool.",
} as const;

/** Friendly, non-technical message for an engine error code. */
export function errorMessageFor(code: ProcessingErrorCode): string {
  switch (code) {
    case "unsupported-format":
    case "animated-image":
      return ERROR_COPY.unsupported;
    case "empty-file":
    case "corrupt-file":
    case "decode-failed":
      return ERROR_COPY.unreadable;
    case "unsupported-browser":
      return ERROR_COPY.browser;
    case "file-too-large":
    case "image-too-large":
    case "timeout":
      return PROCESSING_ERROR_MESSAGES[code];
    default:
      return ERROR_COPY.processing;
  }
}

/** Whether retrying the same file can help. */
export function isRetryable(code: ProcessingErrorCode): boolean {
  return ["worker-failed", "timeout", "internal-error", "encode-failed"].includes(code);
}
