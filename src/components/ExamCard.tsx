import Link from "next/link";
import { describePreset } from "@/lib/presets/describe";
import { getPreset } from "@/lib/presets";
import { formatIsoDate, isVerifiedSource, versionFragment } from "@/lib/presets/source";
import type { ExamDefinition } from "@/lib/presets/types";
import { documentNoun, documentTitle } from "@/lib/tools/preset-labels";
import type { ToolDefinition } from "@/lib/tools/registry";

/**
 * One exam's live tools with the requirement values of each document (from the presets) and a
 * link to the verified source. The heading reads "{Exam} tools" for assistive technology.
 */
export function ExamCard({ exam, tools }: { exam: ExamDefinition; tools: ToolDefinition[] }) {
  const single = tools.filter((tool) => tool.kind === "preset" && tool.presetIds.length === 1);
  const pack = tools.find((tool) => tool.kind === "pack");
  const presets = single.map((tool) => getPreset(tool.presetIds[0]));
  const source = presets[0]?.source;
  const hub = pack ?? single[0];
  const headingId = `${exam.id}-tools`;

  return (
    <section aria-labelledby={headingId} className="card flex flex-col p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="font-display text-3xl font-bold tracking-tight">
          {exam.shortName}
          <span className="sr-only"> tools</span>
        </h3>
        <p className="text-right text-xs text-muted">{exam.fullName}</p>
      </div>

      <ul className="mt-5 divide-y divide-border border-y border-border">
        {single.map((tool, index) => {
          const preset = presets[index];
          const d = describePreset(preset);
          return (
            <li
              key={tool.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{documentTitle(preset)}</p>
                <p className="spec-value text-sm text-muted">
                  {preset.width} × {preset.height} px{preset.preferredDimensions ? "*" : ""} ·{" "}
                  {d.kb}
                </p>
              </div>
              <Link
                href={tool.path}
                className="inline-flex min-h-11 items-center rounded-lg border border-border-strong px-3 text-sm font-semibold transition-colors hover:border-brand hover:text-brand focus-visible:outline-3 focus-visible:outline-brand"
              >
                Fix {exam.shortName} {documentNoun(preset)}
                <span aria-hidden="true" className="ml-1.5">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {presets.some((preset) => preset.preferredDimensions) ? (
        <p className="mt-2 text-xs text-muted">* Pixel size stated as preferred by the source.</p>
      ) : null}

      <div className="mt-auto pt-5">
        {pack ? (
          <Link href={pack.path} className="btn-primary w-full">
            {pack.name}: all {pack.presetIds.length} images
          </Link>
        ) : null}
        {source && isVerifiedSource(source) && hub ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">
              <span aria-hidden="true">✓</span> Verified requirement
            </span>
            <span>
              {source.authority}
              {versionFragment(source) ? `, version ${versionFragment(source)}` : ""} · checked{" "}
              <time dateTime={source.verifiedOn!}>{formatIsoDate(source.verifiedOn!)}</time>
            </span>
            <Link href={`${hub.path}#source`} className="text-link">
              How we verified<span className="sr-only"> the {exam.shortName} requirements</span>
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
