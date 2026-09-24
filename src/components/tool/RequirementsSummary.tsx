import { FORMAT_LABELS } from "@/lib/image/formats";
import { dpiShortText } from "@/lib/presets/describe";
import type { ImagePreset } from "@/lib/presets/types";

/** Compact "Required" panel shown above the uploader. Values come from the preset. */
export function RequirementsSummary({
  preset,
  headingLevel = 2,
}: {
  preset: ImagePreset;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const items: [string, string][] = [
    ["Dimensions", `${preset.width} × ${preset.height} px`],
    ["File size", `${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`],
    ["Format", preset.formats.map((format) => FORMAT_LABELS[format]).join(", ")],
    ["DPI", dpiShortText(preset.dpi)],
  ];
  return (
    <section aria-labelledby={`${preset.id}-required`}>
      <Heading id={`${preset.id}-required`} className="text-sm font-semibold text-muted">
        Required
      </Heading>
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
