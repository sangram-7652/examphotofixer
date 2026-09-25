import { isPdf, sourceCitation } from "@/lib/presets/source";
import type { RequirementSource } from "@/lib/presets/types";

/** Link to a requirement source; opens in a new tab and says so to screen readers. */
export function SourceLink({ source, children }: { source: RequirementSource; children: string }) {
  if (!source.url) return null;
  const note = isPdf(source.url) ? "PDF, opens in a new tab" : "opens in a new tab";
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics-event="requirement_source_opened"
      data-analytics-source-id={source.id}
      className="text-link"
    >
      {children}
      <span className="sr-only">
        : {sourceCitation(source)} ({note})
      </span>
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}
