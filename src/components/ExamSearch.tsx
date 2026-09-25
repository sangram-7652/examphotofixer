"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import type { ExamDefinition } from "@/lib/presets/types";

export interface ExamSearchEntry {
  exam: ExamDefinition;
  /** Hub page for the exam, or `null` when the exam has no tools yet. */
  href: string | null;
  /** Tool behind `href`, for analytics. */
  toolId: string | null;
}

function matches(exam: ExamDefinition, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [exam.shortName, exam.fullName, exam.conductingBody].some((text) =>
    text.toLowerCase().includes(q),
  );
}

export function ExamSearch({ entries }: { entries: ExamSearchEntry[] }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const results = entries.filter((entry) => matches(entry.exam, query));

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="sr-only">
        Search your exam
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search your exam"
        autoComplete="off"
        className="min-h-12 w-full rounded-lg border border-border-strong bg-background px-4 py-3 text-base shadow-sm outline-none placeholder:text-muted focus:border-brand focus:ring-3 focus:ring-brand/25"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{query ? "Results:" : "Popular:"}</span>
        {results.length === 0 ? <span className="text-muted">No matching exam yet.</span> : null}
        {results.map(({ exam, href, toolId }) =>
          href ? (
            <Link
              key={exam.id}
              href={href}
              // Only the chosen exam is reported, never what was typed.
              onClick={() =>
                trackEvent("exam_selected", {
                  exam_id: exam.id,
                  destination_tool_id: toolId ?? undefined,
                  source_page_category: "home",
                })
              }
              className="inline-flex min-h-9 items-center rounded-full border border-brand/40 bg-brand-soft px-3.5 font-semibold text-brand transition-colors hover:border-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {exam.shortName}
            </Link>
          ) : (
            <span
              key={exam.id}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-border-strong px-3.5 text-muted"
              title="Coming soon"
            >
              {exam.shortName} <span className="text-xs">(soon)</span>
            </span>
          ),
        )}
      </div>
    </div>
  );
}
