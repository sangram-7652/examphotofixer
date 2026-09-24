# Image Processing

Status: **engine implemented (P2).** Runs in a Web Worker; not yet wired to the tool UI.

## Pipeline

```
INPUT → decode → EXIF orientation → crop → resize → white background
      → JPEG encode → size-window compression → DPI → strip metadata
      → validate (on final bytes) → Blob + metadata
```

## Architecture

```
React (future P3)                     Web Worker (image.worker.ts)
─────────────────                     ────────────────────────────
processImage(file, { requirements,    runImagePipeline(file, options, report)
  crop, onProgress, signal })          ├─ inspectInput: sniff, animation, integrity, dims
  │  worker/client.ts                  ├─ decode: createImageBitmap (EXIF removed first)
  │  one worker per job, typed         ├─ render: orient + crop + white bg + resize steps
  │  messages, timeout, abort          ├─ encode + findQualityForByteWindow
  └─▶ { ok, result } | { ok, error }   ├─ finalizeJpeg: strip metadata + JFIF DPI
                                        └─ readJpegFacts → validateAgainstPreset
```

| Module (`src/lib/image/`) | Role                                                                 | Environment         |
| ------------------------- | -------------------------------------------------------------------- | ------------------- |
| `worker/client.ts`        | Only API for UI code. Never rejects; returns a typed outcome.        | main thread         |
| `worker/protocol.ts`      | `ImageProcessingRequest/Progress/Result/ErrorInfo`, `WorkerResponse` | shared              |
| `worker/image.worker.ts`  | Worker entry; maps exceptions to structured errors                   | worker              |
| `engine.ts`               | Orchestration using `createImageBitmap` + `OffscreenCanvas`          | worker (any thread) |
| `jpeg.ts`, `exif.ts`      | Byte-level JPEG: segments, SOF size, EOI, EXIF, JFIF DPI, strip      | pure                |
| `formats.ts`              | Magic bytes, PNG/WebP dims, animation, truncation                    | pure                |
| `orientation.ts`          | EXIF 1–8 transforms and rect mapping                                 | pure                |
| `crop.ts`                 | `CropSpec` → rect (auto / rect / viewport+zoom)                      | pure                |
| `resize.ts`               | Resize steps, decode scale                                           | pure                |
| `size-target.ts`          | KB window, quality search                                            | pure                |
| `inspect.ts`              | Facts from final bytes                                               | pure                |

The engine is generic: it takes `OutputRequirements` (width, height, KB range, DPI range, formats).
Presets satisfy that shape; no exam-specific logic lives in `lib/image`.

One worker per job: the worker is terminated after the result, which frees every buffer the job used.

## Stages

**Input.** Sniffed from magic bytes (JPEG, PNG, WebP accepted; SVG, GIF, BMP, HEIC and
unknown rejected). Animated PNG (`acTL`) and animated WebP (VP8X flag / `ANIM`) rejected.
Truncated or incomplete files rejected before decoding (JPEG: no SOF, no quantization tables
(DQT) or no EOI reachable through scan data; PNG: no `IEND`; WebP: RIFF size exceeds file).
The DQT check exists because WebKit silently renders JPEGs without quantization tables, which
the JPEG standard does not allow. Pixel count from the header is checked against
`MAX_INPUT_PIXELS` before decoding (decompression-bomb guard). The declared MIME type and
file extension are ignored: content decides.

**EXIF orientation.** Read from APP1 (`readJpegOrientation`), then the EXIF segment is
removed from a copy of the bytes before decoding, so no browser can auto-rotate. The engine
applies the orientation itself with a canvas transform (`orientationMatrix`), for all eight
values. Result: identical output in every browser. PNG/WebP EXIF orientation is not parsed
(rare); if a decoder rotates anyway, the engine detects the transposed bitmap and adapts.

**Crop.** `CropSpec` in oriented source pixels:
`{ mode: "auto", focus? }` (default, centred), `{ mode: "rect", rect }` (trimmed to target
ratio, never stretched), `{ mode: "viewport", center, zoom }` (for the future cropper UI).
Rounding can shift the ratio by ≤ 1 source pixel.

**Resize.** The first canvas draws the crop region straight from the bitmap at ≤ 8× the
target, then halves (2× steps) to exactly `width × height`. `imageSmoothingQuality = "high"`.
Upscaling (source smaller than target) is a single step and still yields the exact size.

**Transparency.** The first canvas is filled white before drawing, so alpha is composited
onto white; later steps are opaque. Canvases are created with alpha (an `alpha: false`
canvas starts black).

**Encode + compression.** `OffscreenCanvas.convertToBlob({ type: "image/jpeg", quality })`.
The output type is verified (some browsers silently fall back to PNG). Each candidate is
finalised (metadata stripped, DPI written) before measuring, so size decisions use the exact
bytes the user downloads.

`findQualityForByteWindow`:

1. Encode at quality 100. If ≤ max bytes → done (`within_range`, or `below_minimum` if under min).
2. Otherwise binary-search the highest integer quality in [30, 99] that is ≤ max bytes
   (≤ 7 more encodes, cached).
3. None fits → `above_maximum` with the quality-30 output.
4. Encoder throws → `unable_to_process` → `encode-failed` error.

KB window: min × 1024, max × 1000 bytes (satisfies both KB interpretations).

**Locked decision — below minimum.** If maximum quality is still under the minimum, the
engine returns that output unchanged with `status: "below_minimum"` and a message. It never
pads files, adds noise or alters pixels. Validation's file-size check then fails, and the UI
decides how to explain it.

**DPI.** `chooseOutputDpi` (150, clamped into the requirement range) is written as a JFIF 1.01
APP0 segment: units = 1 (dots per inch), X/Y density = DPI, no thumbnail. `writeDpi(blob, dpi)`
/ `readDpi(blob)` expose this for Blobs; `readJpegDpi` reads JFIF (units 1 or 2), falling back
to EXIF X/YResolution. DPI is metadata only and never changes pixel dimensions.

**Metadata privacy.** `finalizeJpeg` rebuilds the header: SOI, a fresh JFIF APP0, the
decoding segments (DQT, SOF, DHT, DRI…) and Adobe APP14 (colour transform, no personal
data). Everything else is dropped: EXIF (GPS, make/model, timestamps, serials), XMP, ICC,
IPTC, MPF and other APPn, comments, JFIF thumbnails, and any trailer after EOI. Image data
(SOS → EOI) is copied byte-for-byte. `listJpegMetadata` verifies the result.

**Validation.** `readJpegFacts` parses the final bytes (SOF size, magic-byte format, JFIF
DPI, metadata kinds) and `validateAgainstPreset` checks dimensions, aspect ratio, format,
file size, DPI and metadata.

## Memory

- Input bytes are read once. The EXIF-free copy handed to the decoder is a byte copy, not pixels.
- Decode scale is chosen so the crop decodes at ~8× the target and within 16.7 MP. A 6000×8000
  photo for a 132×170 target decodes at ~1060×1410, not 48 MP.
- Intermediate canvases are released (`width = height = 0`) right after use; the bitmap is
  closed after rendering; the worker is terminated after each job.
- Remaining peak: the browser's internal full-resolution JPEG decode, which `resizeWidth`
  may or may not avoid depending on the browser.

## Progress

`loading → orientation → cropping → resizing → encoding → dpi → metadata → validation → complete`,
reported as `{ stage, step, totalSteps, fraction }`. DPI and metadata are applied while each
candidate is encoded; their stages verify them on the final bytes.

## Errors

`ImageProcessingErrorInfo { code, stage, message }`. Codes: `invalid-request`, `empty-file`,
`file-too-large`, `unsupported-format`, `animated-image`, `corrupt-file`, `image-too-large`,
`decode-failed`, `encode-failed`, `unsupported-browser`, `worker-failed`, `timeout`,
`aborted`, `internal-error`. Messages live in `PROCESSING_ERROR_MESSAGES`.

## Browser support

Needs module Workers, `OffscreenCanvas` 2D (with `convertToBlob`) and `createImageBitmap`:
Chrome/Edge 69+, Firefox 105+, Safari 16.4+. `isImageProcessingSupported()` (in `support.ts`,
tiny and loaded up front) lets the UI show a fallback message.

Tested with Playwright on Chromium, Firefox and WebKit (desktop) and Chromium on a Pixel 7
viewport; all pass (WebKit run details in TESTING.md).

**Known Firefox limitation.** Firefox runs `createImageBitmap(Blob)` decoding on the main thread
even when called from a worker (measured: main-thread stall ≈ decode time). Nothing else in
the pipeline blocks. Mitigation in `engine.ts`: on Firefox, images up to 2 × 16.7 MP decode at
full size (a plain decode is faster there than a decode-time resize) and the worker's canvas
does the downscaling. Measured stalls (idle machine): 2000×1500 ≈ 50 ms, 12 MP ≈ 165–180 ms,
48 MP ≈ 0.6–1 s. Chromium stays at ~10 ms for all sizes. A JS/WASM decoder in the worker would
remove the stall at a large size/speed cost; not done.
