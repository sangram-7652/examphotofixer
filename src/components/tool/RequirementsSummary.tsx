import { FORMAT_LABELS } from "@/lib/image/formats";
import { dpiShortText } from "@/lib/presets/describe";
import {
  formatIsoDate,
  formatPages,
  isVerifiedSource,
  presetSourcePages,
  versionFragment,
} from "@/lib/presets/source";
import type { ImagePreset } from "@/lib/presets/types";

/** Compact "Required" card shown above the uploader. Values and source come from the preset. */
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
  const { source } = preset;
  const pages = formatPages(presetSourcePages(preset));
  return (
    <section aria-labelledby={`${preset.id}-required`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Heading id={`${preset.id}-required`} className="eyebrow">
          Required
        </Heading>
        {preset.preferredDimensions ? (
          <p className="text-xs text-muted">Pixel size stated as preferred</p>
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-border sm:grid-cols-4">
        {items.map(([label, value], index) => (
          <div
            key={label}
            className={`bg-surface px-3 py-2.5 ${index % 2 === 1 ? "border-l border-border" : ""} ${index >= 2 ? "border-t border-border sm:border-t-0" : ""} ${index === 2 ? "sm:border-l" : ""}`}
          >
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="spec-value mt-0.5 text-base text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {isVerifiedSource(source) ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1 font-semibold text-success">
            <span aria-hidden="true">✓</span> Verified requirement
          </span>
          <span className="hidden sm:inline">
            {source.authority} {source.document ? `· ${source.document}` : ""}
            {versionFragment(source) ? ` · version ${versionFragment(source)}` : ""}
            {pages ? ` · ${pages}` : ""} · checked{" "}
            <time dateTime={source.verifiedOn!}>{formatIsoDate(source.verifiedOn!)}</time>
          </span>
          <a href="#source" className="text-link">
            Source details
          </a>
        </p>
      ) : null}
    </section>
  );
}
