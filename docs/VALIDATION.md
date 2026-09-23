# Validation

Code: `src/lib/validation/`. Framework-free; used by UI and tests.

## Model

```ts
validateAgainstPreset(preset, facts: OutputFacts | null, error?) → ValidationReport
ValidationReport = { presetId, ready, checks: ValidationCheck[] }
ValidationCheck  = { id, status: "pass" | "fail" | "skipped", label, expected, actual, message }
```

Check ids: `processing`, `dimensions`, `aspect-ratio`, `format`, `file-size`, `dpi`, `metadata`.
`ready` is true only when every check passes. When processing fails, a single `processing`
failure is returned and the rest are `skipped`.

`validateAgainstPreset` accepts any `OutputRequirements` (presets satisfy it).
`OutputFacts` must be read from the **final encoded bytes** (`readJpegFacts`) (dimensions, byte length,
magic-byte format, JFIF density) — never from the intended settings.

## Rules

| Check        | Rule                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------- |
| Dimensions   | Exactly `preset.width × preset.height`.                                                     |
| Aspect ratio | Within 1 % of preset ratio (diagnostic: explains _why_ dimensions fail).                    |
| Format       | Detected format ∈ `preset.formats`.                                                         |
| File size    | `minBytes ≤ bytes ≤ maxBytes`, see KB interpretation below.                                 |
| DPI          | Both X and Y density within `[dpi.min, dpi.max]`; missing DPI fails.                        |
| Metadata     | No EXIF, GPS, XMP, ICC, IPTC, comments, thumbnails or vendor segments (`listJpegMetadata`). |

### KB interpretation

Portals differ on whether 1 KB = 1000 or 1024 bytes. We satisfy both:

- `minBytes = min × 1024` (the stricter lower bound)
- `maxBytes = max × 1000` (the stricter upper bound)

CCC photo 5–50 KB → 5 120 – 50 000 bytes. Signature/thumb 5–20 KB → 5 120 – 20 000 bytes.

## UI contract

Display each check in order with ✓ / ✗ and `label`; on failure show `message`
(actionable, plain English). Show "Ready" only when `report.ready`.

## Input pre-flight

`checkInputFile({ byteLength, format })` → `"empty-file" | "file-too-large" | "unsupported-format" | null`.
Supported input: JPEG, PNG, WebP. HEIC is detected but rejected in V1 with a helpful message.
The engine additionally rejects animated images and truncated files (see IMAGE_PROCESSING.md).

## Below-minimum outputs

When the highest-quality output is still under the minimum KB, the engine returns it with
`compression.status = "below_minimum"`; the `file-size` check fails and `ready` is false.
The file is never padded or altered.
