import { CropMarks } from "@/components/CropMarks";
import type { ImagePreset } from "@/lib/presets/types";

/**
 * The preset's exact shape drawn as a spec diagram: a frame with the required aspect ratio and
 * dimension callouts along the top and side. Every number comes from the preset.
 */
export function SpecFrame({
  preset,
  maxHeight = 208,
}: {
  preset: ImagePreset;
  maxHeight?: number;
}) {
  const ratio = preset.width / preset.height;
  // Fit inside a maxHeight × (maxHeight × 1.2) box, never distorted.
  const maxWidth = maxHeight * 1.2;
  const height = ratio > maxWidth / maxHeight ? maxWidth / ratio : maxHeight;
  const width = height * ratio;
  return (
    <figure
      className="inline-grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-2"
      aria-label={`Required shape: ${preset.width} by ${preset.height} pixels`}
    >
      <figcaption className="col-start-1 flex items-center gap-2 text-xs text-muted">
        <span aria-hidden="true" className="h-px flex-1 bg-border-strong" />
        <span className="spec-value text-foreground">{preset.width} px</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border-strong" />
      </figcaption>
      <span />
      <div
        className="relative rounded-sm border border-dashed border-brand/50 bg-[repeating-linear-gradient(135deg,transparent_0_10px,var(--brand-soft)_10px_11px)]"
        style={{ width, height }}
      >
        <CropMarks inset="-3px" />
      </div>
      <span className="flex h-full flex-col items-center gap-2 text-xs" aria-hidden="true">
        <span className="w-px flex-1 bg-border-strong" />
        <span className="spec-value text-foreground [writing-mode:vertical-rl]">
          {preset.height} px
        </span>
        <span className="w-px flex-1 bg-border-strong" />
      </span>
    </figure>
  );
}
