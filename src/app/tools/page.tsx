import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ToolCard } from "@/components/ToolCard";
import { breadcrumbJsonLd, type Crumb } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { listExams } from "@/lib/presets";
import { genericTools, toolsForExam } from "@/lib/tools/registry";

export const metadata: Metadata = buildPageMetadata({
  title: "All Tools – Exam Photo, Signature & Image Tools",
  description:
    "Every ExamPhotoFixer tool: CCC photo, signature and thumb impression resizers; IBPS CRP RRBs-XV photo, signature, thumb impression and handwritten declaration resizers; the CCC and IBPS Complete Packs; plus a general image resizer and compressor.",
  path: "/tools",
});

const crumbs: Crumb[] = [
  { name: "Home", path: "/" },
  { name: "Tools", path: "/tools" },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs crumbs={crumbs} />
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">All tools</h1>

      <section aria-labelledby="exam-tools" className="mt-8">
        <h2 id="exam-tools" className="section-title">
          Exam &amp; Application Tools
        </h2>
        {listExams()
          .filter((exam) => exam.status === "active")
          .map((exam) => (
            <div key={exam.id} className="mt-4">
              <h3 className="font-medium text-muted">{exam.shortName}</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {toolsForExam(exam.id).map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </div>
          ))}
      </section>

      <section aria-labelledby="generic" className="mt-10">
        <h2 id="generic" className="section-title">
          General Image Tools
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {genericTools().map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>

      <section aria-labelledby="coming-soon" className="mt-10">
        <h2 id="coming-soon" className="section-title">
          Coming Soon
        </h2>
        <p className="mt-2 text-muted">
          Tools for these exams will be added once their requirements are verified against official
          notices.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {listExams()
            .filter((exam) => exam.status === "planned")
            .map((exam) => (
              <li key={exam.id} className="rounded-full border border-border px-3 py-1 text-muted">
                {exam.shortName} <span className="sr-only">(coming soon)</span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
