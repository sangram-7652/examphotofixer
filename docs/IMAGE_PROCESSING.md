# Image Processing

Status: **contract + pure helpers implemented; browser pipeline not yet built.**

## Pipeline

```
INPUT → load → read metadata → EXIF orientation → target aspect ratio
      → smart/manual crop → resize → JPEG encode → size-window compression
      → DPI metadata → final validation → download
```

Stage names and error codes are fixed in `src/lib/image/pipeline.ts`.

| Stage            | Implementation plan                                                                                                          | Status                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Sniff format     | `detectImageFormat` (magic bytes, never trust extension/MIME)                                                                | ✅ `formats.ts`                          |
| Input limits     | `checkInputFile`, `MAX_INPUT_BYTES`, `MAX_INPUT_PIXELS`                                                                      | ✅ `validation/validate.ts`, `limits.ts` |
| Load / decode    | `createImageBitmap(file, { imageOrientation: "from-image" })`                                                                | ⏳                                       |
| EXIF orientation | Rely on `imageOrientation`; fall back to parsing APP1 orientation; `orientedSize` for dimension swap                         | ✅ helper, ⏳ parser                     |
| Huge images      | `scaleToFitPixelBudget` against `MAX_CANVAS_PIXELS` (16.7 MP, iOS limit), downscale on decode via `resizeWidth/resizeHeight` | ✅ helper                                |
| Crop             | `computeCoverCrop(source, target, focus)`; manual crop overrides                                                             | ✅ `geometry.ts`                         |
| Resize           | Canvas `drawImage` with `imageSmoothingQuality = "high"`; multi-step halving for > 2× reductions                             | ⏳                                       |
| Transparency     | Fill white before drawing (JPEG has no alpha)                                                                                | ⏳                                       |
| Encode           | `OffscreenCanvas.convertToBlob({ type: "image/jpeg", quality })`                                                             | ⏳                                       |
| Compress         | `findQualityForByteWindow(encode, kbRangeToByteWindow(preset.fileSizeKB))`                                                   | ✅ `size-target.ts`                      |
| DPI              | Write JFIF APP0 density (units = 1, X/Y density) with `chooseOutputDpi(preset.dpi)`                                          | ✅ choice, ⏳ writer                     |
| Validate         | `validateAgainstPreset(preset, facts)` on the **final bytes**                                                                | ✅                                       |

## Quality rules

- **Never stretch.** Crop to target aspect ratio first, then scale uniformly.
- **Don't aim for the minimum KB.** Target the highest quality that fits under
  `ceilingBytes` (max minus a 2 % / 256 B safety margin). Default quality 92; go
  above 92 only to reach the minimum size.
- **Deterministic search.** Binary search on integer quality, ≤ ~8 encodes, cached.
  Tested with a fake encoder (`size-target.test.ts`).
- **Too small at quality 100** (tiny, flat images, e.g. a signature on white): status
  `too-small`. Open decision: pad with a JPEG COM segment vs. mild noise vs. report. Decide
  before implementing; padding must be proven acceptable to target portals.
- **Too large at quality 30:** status `too-large` → report as `size-target-unreachable`.
- **DPI:** `PREFERRED_OUTPUT_DPI = 150`, clamped into the preset range — strictly inside
  both CCC ranges so edge-of-range checks can't reject it. DPI is metadata only; it does not
  change pixels.
- Strip all other metadata (EXIF GPS, camera data) from output — privacy.

## Performance

- Run the pipeline in a Web Worker; transfer `ImageBitmap`s.
- Decode at reduced size when source ≫ target.
- Release bitmaps (`close()`) and object URLs promptly.
