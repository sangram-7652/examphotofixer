import type { Metadata } from "next";
import { ExamSearch, type ExamSearchEntry } from "@/components/ExamSearch";
import { JsonLd } from "@/components/JsonLd";
import { ToolCard } from "@/components/ToolCard";
import { siteConfig } from "@/config/site";
import { listExams } from "@/lib/presets";
import { websiteJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { genericTools, toolsForExam } from "@/lib/tools/registry";

const homeTitle = `${siteConfig.name} – Exam Photo & Signature Resizer`;

export const metadata: Metadata = {
  ...buildPageMetadata({ title: homeTitle, description: siteConfig.description, path: "/" }),
  // Absolute so the root layout's "%s | ExamPhotoFixer" template is not applied twice.
  title: { absolute: homeTitle },
};

export default function HomePage() {
  const examEntries: ExamSearchEntry[] = listExams().map((exam) => {
    const hub = toolsForExam(exam.id).find((tool) => tool.kind === "pack");
    return { exam, href: hub?.path ?? null };
  });

  return (
    <>
      <JsonLd data={websiteJsonLd()} />

      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
          <p className="text-sm font-medium text-brand">{siteConfig.category}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Fix your exam photo before you upload it.
          </h1>
          <p className="mt-4 text-lg text-muted">{siteConfig.description}</p>
          <div className="mx-auto mt-8 max-w-xl text-left">
            <ExamSearch entries={examEntries} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4">
        <section aria-labelledby="ccc-tools" className="mt-12">
          <h2 id="ccc-tools" className="text-xl font-semibold">
            CCC tools
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {toolsForExam("ccc").map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>

        <section aria-labelledby="image-tools" className="mt-12">
          <h2 id="image-tools" className="text-xl font-semibold">
            General image tools
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {genericTools().map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </section>

        <section aria-labelledby="why" className="mt-12 grid gap-6 sm:grid-cols-3">
          <h2 id="why" className="sr-only">
            Why {siteConfig.name}
          </h2>
          <div>
            <h3 className="font-semibold">Exact requirements</h3>
            <p className="mt-1 text-sm text-muted">
              Sizes, file limits and DPI come from each exam&apos;s official instructions.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">No stretching</h3>
            <p className="mt-1 text-sm text-muted">
              Photos are cropped to shape, then resized — faces never look squashed.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Private by design</h3>
            <p className="mt-1 text-sm text-muted">
              Files are processed in your browser and never uploaded to our servers.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
