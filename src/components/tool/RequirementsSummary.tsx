import { FORMAT_LABELS } from "@/lib/image/formats";
import type { ImagePreset } from "@/lib/presets/types";

/** Compact "Required" panel shown above the uploader. Values come from the preset. */
export function RequirementsSummary({ preset }: { preset: ImagePreset }) {
  const items: [string, string][] = [
    ["Dimensions", `${preset.width} × ${preset.height} px`],
    ["File size", `${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`],
    ["Format", preset.formats.map((format) => FORMAT_LABELS[format]).join(", ")],
    ["DPI", `${preset.dpi.min}–${preset.dpi.max}`],
  ];
  return (
    <section aria-labelledby={`${preset.id}-required`}>
      <h2 id={`${preset.id}-required`} className="text-sm font-semibold text-muted">
        Required
      </h2>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface px-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
