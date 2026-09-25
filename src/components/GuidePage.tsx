import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { RequirementsTable } from "@/components/RequirementsTable";
import { SourceVerification } from "@/components/SourceVerification";
import {
  buildGuide,
  guidePath,
  guidePresets,
  listGuides,
  type Guide,
  type GuideBlock,
  type Inline,
} from "@/content/guides";
import { formatIsoDate } from "@/lib/presets/source";
import { breadcrumbJsonLd, faqJsonLd, type Crumb, type JsonLdObject } from "@/lib/seo/json-ld";
import { getTool } from "@/lib/tools/registry";

function InlineText({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((part, index) =>
        typeof part === "string" ? (
          <span key={index}>{part}</span>
        ) : (
          <Link key={index} href={part.href} className="font-medium underline underline-offset-2">
            {part.text}
          </Link>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: GuideBlock }) {
  if (block.kind === "p") {
    return (
      <p className="mt-3">
        <InlineText content={block.content} />
      </p>
    );
  }
  const List = block.kind === "steps" ? "ol" : "ul";
  return (
    <List
      className={`mt-3 space-y-2 pl-5 ${block.kind === "steps" ? "list-decimal" : "list-disc"}`}
    >
      {block.items.map((item, index) => (
        <li key={index}>
          <InlineText content={item} />
        </li>
      ))}
    </List>
  );
}

/** Server-rendered guide: short answer, requirements with source, steps, FAQ, tool links. */
export function GuidePage({ guide }: { guide: Guide }) {
  const body = buildGuide(guide);
  const presets = guidePresets(guide);
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides" },
    { name: guide.title, path: guidePath(guide) },
  ];
  const jsonLd: JsonLdObject[] = [breadcrumbJsonLd(crumbs)];
  if (body.faq.length > 0) jsonLd.push(faqJsonLd(body.faq));
  const sharedSource =
    presets.length > 0 && presets.every((preset) => preset.source === presets[0].source)
      ? presets[0]
      : null;
  // Related = other guides about the same exam.
  const exams = new Set(presets.map((preset) => preset.exam));
  const related = listGuides().filter(
    (other) =>
      other.slug !== guide.slug && guidePresets(other).some((preset) => exams.has(preset.exam)),
  );

  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:py-8" data-analytics-guide-id={guide.slug}>
      <JsonLd data={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />
      <p className="mt-3 text-sm font-medium text-brand">{guide.category}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{guide.title}</h1>
      <p className="mt-3 text-lg" data-testid="short-answer">
        {body.shortAnswer}
      </p>
      <p className="mt-2 text-sm text-muted">
        Last reviewed <time dateTime={guide.reviewedOn}>{formatIsoDate(guide.reviewedOn)}</time>
      </p>

      <nav
        aria-label="Tools for this guide"
        className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
      >
        {guide.toolLinks.map((link, index) => (
          <Link
            key={link.toolId}
            href={getTool(link.toolId).path}
            data-analytics-event="guide_tool_clicked"
            data-analytics-tool-id={link.toolId}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-center font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              index === 0 ? "bg-brand text-brand-foreground" : "border border-border"
            }`}
          >
            {link.text}
          </Link>
        ))}
      </nav>

      {presets.length > 0 ? (
        <section aria-labelledby="requirements" className="mt-10">
          <h2 id="requirements" className="text-xl font-semibold">
            Requirements stated in the referenced NIELIT guideline
          </h2>
          <div className="mt-4 space-y-4">
            {presets.map((preset) => (
              <RequirementsTable key={preset.id} preset={preset} />
            ))}
          </div>
          {sharedSource ? <SourceVerification presets={presets} /> : null}
        </section>
      ) : null}

      {body.sections.map((section) => (
        <section key={section.id} aria-labelledby={section.id} className="mt-10">
          <h2 id={section.id} className="text-xl font-semibold">
            {section.heading}
          </h2>
          {section.blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </section>
      ))}

      {body.faq.length > 0 ? (
        <section aria-labelledby="faq" className="mt-10">
          <h2 id="faq" className="text-xl font-semibold">
            Frequently asked questions
          </h2>
          <div className="mt-4 divide-y divide-border rounded-lg border border-border">
            {body.faq.map((item) => (
              <details key={item.question} className="px-4 py-3">
                <summary className="min-h-11 cursor-pointer py-2 font-medium">
                  {item.question}
                </summary>
                <p className="pb-2 text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section aria-labelledby="related-guides" className="mt-10">
          <h2 id="related-guides" className="text-xl font-semibold">
            Related guides
          </h2>
          <ul className="mt-3 space-y-2">
            {related.map((other) => (
              <li key={other.slug}>
                <Link href={guidePath(other)} className="font-medium underline underline-offset-2">
                  {other.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
