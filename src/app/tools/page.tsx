import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ToolCard } from "@/components/ToolCard";
import { breadcrumbJsonLd, type Crumb } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { genericTools, toolsForExam } from "@/lib/tools/registry";

export const metadata: Metadata = buildPageMetadata({
  title: "All Tools – Exam Photo, Signature & Image Tools",
  description:
    "Every ExamPhotoFixer tool: CCC photo, signature and thumb impression resizers, plus image resizer and compressor.",
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
      <h1 className="mt-4 text-3xl font-bold tracking-tight">All tools</h1>

      <section aria-labelledby="ccc" className="mt-8">
        <h2 id="ccc" className="text-xl font-semibold">
          CCC (NIELIT)
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {toolsForExam("ccc").map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>

      <section aria-labelledby="generic" className="mt-10">
        <h2 id="generic" className="text-xl font-semibold">
          Image tools
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {genericTools().map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>
    </div>
  );
}
