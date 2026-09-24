/**
 * Browser image engine. Runs inside the image worker (see ./worker), but has
 * no worker- or React-specific code, so it also runs on any thread that has
 * `createImageBitmap` and `OffscreenCanvas`.
 *
 * Memory: the input file is read once; EXIF is removed from a copy of its
 * bytes (not pixels) so the browser cannot auto-rotate; huge photos are decoded
 * at reduced size; intermediate canvases are small multiples of the target and
 * are released as soon as the next step is drawn.
 */

import { validateAgainstPreset } from "@/lib/validation/validate";
import type { ValidationReport } from "@/lib/validation/types";
import { resolveCropRect, type CropSpec } from "./crop";
import { chooseOutputDpi } from "./dpi";
import {
  SUPPORTED_INPUT_FORMATS,
  detectImageFormat,
  isAnimatedImage,
  isCompletePngOrWebp,
  readPngOrWebpDimensions,
  type ImageFormat,
} from "./formats";
import type { Rect, Size } from "./geometry";
import { readJpegFacts } from "./inspect";
import {
  finalizeJpeg,
  isCompleteJpeg,
  readJpegDimensions,
  readJpegOrientation,
  removeExifSegments,
} from "./jpeg";
import { MAX_CANVAS_PIXELS, MAX_INPUT_BYTES, MAX_INPUT_PIXELS } from "./limits";
import {
  normalizeOrientation,
  orientationMatrix,
  orientedToRawRect,
  swapsDimensions,
  type ExifOrientation,
} from "./orientation";
import {
  ImageProcessingError,
  type OutputFacts,
  type OutputRequirements,
  type ProgressStage,
} from "./pipeline";
import { chooseDecodeScale, planResizeSteps } from "./resize";
import {
  findQualityForByteWindow,
  kbRangeToByteWindow,
  type CompressionStatus,
} from "./size-target";

/** Largest output side accepted from a request. */
export const MAX_OUTPUT_SIDE = 10_000;

const BACKGROUND = "#ffffff";

export interface ProcessOptions {
  requirements: OutputRequirements;
  /** Default: centred automatic crop. */
  crop?: CropSpec;
}

export interface CompressionSummary {
  status: Exclude<CompressionStatus, "unable_to_process">;
  /** JPEG quality used (1–100). */
  quality: number;
  attempts: number;
  /** Explanation for the UI when the status is not `within_range`. */
  message: string | null;
}

export interface SourceInfo {
  format: ImageFormat;
  /** EXIF orientation that was applied (1 = none). */
  orientation: ExifOrientation;
  /** Visual (oriented) size of the original image. */
  width: number;
  height: number;
  /** Size the image was decoded at (smaller for huge photos). */
  decodedWidth: number;
  decodedHeight: number;
}

export interface PipelineOutput {
  blob: Blob;
  facts: OutputFacts;
  compression: CompressionSummary;
  validation: ValidationReport;
  source: SourceInfo;
  /** Crop used, in oriented source pixels. */
  crop: Rect;
}

export type StageReporter = (stage: ProgressStage) => void;

export function isEngineSupported(): boolean {
  return typeof createImageBitmap === "function" && typeof OffscreenCanvas === "function";
}

function assertRequirements(requirements: OutputRequirements): void {
  const { width, height } = requirements;
  const validSide = (side: number) =>
    Number.isInteger(side) && side >= 1 && side <= MAX_OUTPUT_SIDE;
  if (!validSide(width) || !validSide(height) || width * height > MAX_CANVAS_PIXELS) {
    throw new ImageProcessingError("invalid-request", "loading", "Invalid output dimensions");
  }
  if (!requirements.formats.includes("jpeg")) {
    throw new ImageProcessingError("invalid-request", "loading", "Only JPEG output is supported");
  }
  try {
    kbRangeToByteWindow(requirements.fileSizeKB);
    chooseOutputDpi(requirements.dpi);
  } catch (error) {
    throw new ImageProcessingError("invalid-request", "loading", (error as Error).message);
  }
}

interface InspectedInput {
  format: ImageFormat;
  /** Size as stored in the file, before orientation. */
  stored: Size;
  orientation: ExifOrientation;
  /** What to hand to the decoder (JPEG: EXIF removed). */
  decodable: Blob;
}

async function inspectInput(file: Blob): Promise<InspectedInput> {
  if (file.size === 0) throw new ImageProcessingError("empty-file", "loading");
  if (file.size > MAX_INPUT_BYTES) throw new ImageProcessingError("file-too-large", "loading");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectImageFormat(bytes);
  if (format === null || !SUPPORTED_INPUT_FORMATS.includes(format)) {
    throw new ImageProcessingError("unsupported-format", "loading");
  }
  if (isAnimatedImage(bytes, format)) throw new ImageProcessingError("animated-image", "loading");

  if (format === "jpeg") {
    const stored = readJpegDimensions(bytes);
    if (!stored || !isCompleteJpeg(bytes)) {
      throw new ImageProcessingError("corrupt-file", "loading");
    }
    return {
      format,
      stored,
      orientation: normalizeOrientation(readJpegOrientation(bytes)),
      decodable: new Blob([removeExifSegments(bytes)], { type: "image/jpeg" }),
    };
  }

  const pngOrWebp = format as "png" | "webp";
  const stored = readPngOrWebpDimensions(bytes, pngOrWebp);
  if (!stored || !isCompletePngOrWebp(bytes, pngOrWebp)) {
    throw new ImageProcessingError("corrupt-file", "loading");
  }
  // EXIF orientation in PNG/WebP is rare and not parsed; the decoder's default applies.
  return { format, stored, orientation: 1, decodable: file };
}

/**
 * Firefox performs createImageBitmap(Blob) decoding on the main thread, even
 * when called from a worker, and its decode-time resize is slower than a plain
 * decode. There we decode at full size when it fits the memory budget and let
 * the worker's canvas steps do the downscaling off the main thread.
 */
const DECODES_ON_MAIN_THREAD =
  typeof navigator !== "undefined" && /\bFirefox\//.test(navigator.userAgent);
const FULL_DECODE_MAX_PIXELS = 2 * MAX_CANVAS_PIXELS;

async function decode(blob: Blob, stored: Size, scale: number): Promise<ImageBitmap> {
  const preferFullDecode =
    DECODES_ON_MAIN_THREAD && stored.width * stored.height <= FULL_DECODE_MAX_PIXELS;
  const attempts: (ImageBitmapOptions | undefined)[] =
    scale < 1 && !preferFullDecode
      ? [
          {
            resizeWidth: Math.max(1, Math.round(stored.width * scale)),
            resizeHeight: Math.max(1, Math.round(stored.height * scale)),
            resizeQuality: "high",
          },
          undefined, // browsers without resize options
        ]
      : [undefined];
  let lastError: unknown;
  for (const options of attempts) {
    try {
      return options ? await createImageBitmap(blob, options) : await createImageBitmap(blob);
    } catch (error) {
      lastError = error;
    }
  }
  throw new ImageProcessingError(
    "decode-failed",
    "loading",
    lastError instanceof Error ? `Could not decode image: ${lastError.message}` : undefined,
  );
}

function createCanvas(size: Size): OffscreenCanvasRenderingContext2D {
  const canvas = new OffscreenCanvas(size.width, size.height);
  const context = canvas.getContext("2d");
  if (!context) throw new ImageProcessingError("unsupported-browser", "resizing");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
}

function release(context: OffscreenCanvasRenderingContext2D): void {
  context.canvas.width = 0;
  context.canvas.height = 0;
}

/**
 * Draws the raw crop region, oriented and composited on white, through the
 * resize steps. Returns a canvas of exactly `target` size. Transparency is
 * flattened onto white in the first step, so later steps are fully opaque.
 */
function render(
  bitmap: ImageBitmap,
  rawCrop: Rect,
  orientation: ExifOrientation,
  target: Size,
): OffscreenCanvasRenderingContext2D {
  const orientedCrop = swapsDimensions(orientation)
    ? { width: rawCrop.height, height: rawCrop.width }
    : { width: rawCrop.width, height: rawCrop.height };
  const [first, ...rest] = planResizeSteps(orientedCrop, target);

  let current = createCanvas(first);
  current.fillStyle = BACKGROUND;
  current.fillRect(0, 0, first.width, first.height);
  const rawDrawn = swapsDimensions(orientation)
    ? { width: first.height, height: first.width }
    : first;
  current.setTransform(...orientationMatrix(orientation, rawDrawn));
  current.drawImage(
    bitmap,
    rawCrop.x,
    rawCrop.y,
    rawCrop.width,
    rawCrop.height,
    0,
    0,
    rawDrawn.width,
    rawDrawn.height,
  );
  current.setTransform(1, 0, 0, 1, 0, 0);

  for (const step of rest) {
    const next = createCanvas(step);
    next.drawImage(current.canvas, 0, 0, step.width, step.height);
    release(current);
    current = next;
  }
  return current;
}

function compressionMessage(
  status: CompressionSummary["status"],
  byteLength: number,
  requirements: OutputRequirements,
): string | null {
  const kb = (byteLength / 1024).toFixed(1);
  if (status === "below_minimum") {
    return (
      `At the highest quality this image is ${kb} KB, below the ${requirements.fileSizeKB.min} KB ` +
      `minimum. It was not padded or altered. An image with more detail (for example a ` +
      `higher-resolution scan) produces a larger file.`
    );
  }
  if (status === "above_maximum") {
    return (
      `Even at the lowest allowed quality this image is ${kb} KB, above the ` +
      `${requirements.fileSizeKB.max} KB maximum.`
    );
  }
  return null;
}

/**
 * Runs the full pipeline. Throws `ImageProcessingError` for every expected
 * failure; callers should map anything else to `internal-error`.
 */
export async function runImagePipeline(
  file: Blob,
  options: ProcessOptions,
  report: StageReporter = () => {},
): Promise<PipelineOutput> {
  const { requirements } = options;
  const target: Size = { width: requirements.width, height: requirements.height };

  report("loading");
  if (!isEngineSupported()) throw new ImageProcessingError("unsupported-browser", "loading");
  assertRequirements(requirements);
  const input = await inspectInput(file);
  if (input.stored.width * input.stored.height > MAX_INPUT_PIXELS) {
    throw new ImageProcessingError("image-too-large", "loading");
  }

  report("orientation");
  const { orientation } = input;
  const oriented: Size = swapsDimensions(orientation)
    ? { width: input.stored.height, height: input.stored.width }
    : input.stored;

  const resolveCrop = (size: Size) => {
    try {
      return resolveCropRect(size, target, options.crop);
    } catch (error) {
      throw new ImageProcessingError("invalid-request", "cropping", (error as Error).message);
    }
  };
  let crop = resolveCrop(oriented);
  const scale = chooseDecodeScale(input.stored, crop, target);
  const bitmap = await decode(input.decodable, input.stored, scale);

  let canvas: OffscreenCanvasRenderingContext2D;
  let source: SourceInfo;
  try {
    // Decoded pixel space. PNG/WebP decoders may apply their own rotation; if
    // the bitmap came back transposed, treat it as already oriented.
    let visual = oriented;
    const bitmapRatio = bitmap.width / bitmap.height;
    const storedRatio = input.stored.width / input.stored.height;
    if (
      input.format !== "jpeg" &&
      Math.abs(bitmapRatio - 1 / storedRatio) < Math.abs(bitmapRatio - storedRatio)
    ) {
      visual = { width: input.stored.height, height: input.stored.width };
      crop = resolveCrop(visual);
    }
    const decodedRaw: Size = { width: bitmap.width, height: bitmap.height };
    const decodedScale = swapsDimensions(orientation)
      ? bitmap.width / visual.height
      : bitmap.width / visual.width;

    report("cropping");
    const decodedCrop: Rect = {
      x: crop.x * decodedScale,
      y: crop.y * decodedScale,
      width: crop.width * decodedScale,
      height: crop.height * decodedScale,
    };
    const rawCrop = orientedToRawRect(decodedCrop, orientation, decodedRaw);

    report("resizing");
    canvas = render(bitmap, rawCrop, orientation, target);
    source = {
      format: input.format,
      orientation,
      width: visual.width,
      height: visual.height,
      decodedWidth: swapsDimensions(orientation) ? bitmap.height : bitmap.width,
      decodedHeight: swapsDimensions(orientation) ? bitmap.width : bitmap.height,
    };
  } finally {
    bitmap.close();
  }

  report("encoding");
  const dpi = chooseOutputDpi(requirements.dpi);
  const window = kbRangeToByteWindow(requirements.fileSizeKB);
  const encode = async (quality: number) => {
    const blob = await canvas.canvas.convertToBlob({ type: "image/jpeg", quality: quality / 100 });
    if (blob.type !== "image/jpeg") {
      throw new ImageProcessingError("encode-failed", "encoding");
    }
    // Size is measured on the final bytes: metadata stripped, DPI written.
    const bytes = finalizeJpeg(new Uint8Array(await blob.arrayBuffer()), dpi);
    return { byteLength: bytes.length, bytes };
  };
  const compression = await findQualityForByteWindow(encode, window);
  release(canvas);
  if (compression.status === "unable_to_process") {
    throw compression.error instanceof ImageProcessingError
      ? compression.error
      : new ImageProcessingError("encode-failed", "encoding");
  }
  const { bytes } = compression.output;

  // DPI and metadata were applied by finalizeJpeg during encoding; these stages
  // read them back from the final bytes.
  report("dpi");
  report("metadata");
  const facts = readJpegFacts(bytes);
  if (!facts) throw new ImageProcessingError("internal-error", "metadata");

  report("validation");
  const validation = validateAgainstPreset(requirements, facts);

  report("complete");
  return {
    blob: new Blob([bytes], { type: "image/jpeg" }),
    facts,
    compression: {
      status: compression.status,
      quality: compression.quality,
      attempts: compression.attempts,
      message: compressionMessage(compression.status, bytes.length, requirements),
    },
    validation,
    source,
    crop,
  };
}
