import { FORMAT_LABELS } from "@/lib/image/formats";
import { sourceCitation } from "@/lib/presets/source";
import type { ImagePreset } from "@/lib/presets/types";
import { SourceLink } from "./SourceLink";

/** Renders a preset's requirements. All numbers come from the preset — never hard-code them here. */
export function RequirementsTable({ preset }: { preset: ImagePreset }) {
  const rows: [string, string][] = [
    ["Dimensions", `${preset.width} × ${preset.height} pixels (width × height)`],
    ["File size", `${preset.fileSizeKB.min}–${preset.fileSizeKB.max} KB`],
    ["Format", preset.formats.map((format) => FORMAT_LABELS[format]).join(", ")],
    ["DPI", `${preset.dpi.min}–${preset.dpi.max} DPI`],
  ];
  const { source } = preset;

  return (
    <section
      aria-labelledby={`${preset.id}-requirements`}
      className="rounded-lg border border-border"
    >
      <h3
        id={`${preset.id}-requirements`}
        className="border-b border-border px-4 py-3 font-semibold"
      >
        {preset.label} requirements
      </h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-border last:border-0">
              <th scope="row" className="w-1/3 px-4 py-2 text-left font-medium text-muted">
                {label}
              </th>
              <td className="px-4 py-2">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {preset.guidance && preset.guidance.length > 0 ? (
        <div className="border-t border-border px-4 py-3 text-sm">
          <p className="font-medium">The same guidelines also ask:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
            {preset.guidance.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="border-t border-border px-4 py-2 text-xs text-muted">
        Source: {sourceCitation(source)}
        {source.page ? `, page ${source.page}` : ""}.{" "}
        {source.url ? <SourceLink source={source}>View source</SourceLink> : null} Always confirm
        with the current official notification before uploading.
      </p>
    </section>
  );
}
