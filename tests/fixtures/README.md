# Test fixtures

No binary fixtures are committed. Image engine tests generate their inputs deterministically:

- Node unit tests: synthetic JPEG byte streams and EXIF segments from
  `src/lib/image/testing/` (`buildSyntheticJpeg`, `buildExifSegment`).
- Browser tests: canvas patterns (quadrants, stripes, seeded noise, flat, transparent) drawn in
  the page by `src/app/dev/image-engine/scenarios.ts`, with EXIF injected via `insertExif`.

If a real-world file is ever needed (e.g. a specific camera's EXIF layout), add it here: keep
it under 200 KB, make sure it is synthetic or openly licensed, and never commit real people's
photos or signatures.
