import { describe, it } from "vitest";

/**
 * Required coverage for the image pipeline (next phase). Each todo becomes a
 * real test once the browser pipeline exists. See docs/TESTING.md.
 */
describe("image pipeline (to implement)", () => {
  it.todo("portrait input → exact preset dimensions, no distortion");
  it.todo("landscape input → exact preset dimensions, no distortion");
  it.todo("square input → exact preset dimensions, no distortion");
  it.todo("JPG input → JPEG output");
  it.todo("PNG input (with transparency) → JPEG output on white background");
  it.todo("EXIF orientation 6/8/3 is applied before cropping");
  it.todo("huge image (>16.7 MP) is downscaled safely before processing");
  it.todo("invalid / truncated image fails with decode-failed");
  it.todo("output lands inside the file-size window at both boundaries");
  it.todo("output has exact width and height");
  it.todo("output JFIF header carries the chosen DPI");
  it.todo("output format is JPEG (magic bytes)");
});
