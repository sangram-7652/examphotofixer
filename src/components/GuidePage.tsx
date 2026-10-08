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
          <Link key={index} href={part.href} className="text-link">
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
      <p className="mt-3 leading-7">
        <InlineText content={block.content} />
      </p>
    );
  }
  const List = block.kind === "steps" ? "ol" : "ul";
  return (
    <List
      className={`mt-4 space-y-2.5 pl-5 leading-7 marker:text-brand ${block.kind === "steps" ? "list-decimal marker:font-semibold" : "list-disc"}`}
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
  // The same date the "Source and verification" section shows as verified — can't drift apart.
  const reviewedOn = sharedSource?.source.verifiedOn ?? null;
  // Related = other guides about the same exam.
  const exams = new Set(presets.map((preset) => preset.exam));
  const related = listGuides().filter(
    (other) =>
      other.slug !== guide.slug && guidePresets(other).some((preset) => exams.has(preset.exam)),
  );

  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:py-10" data-analytics-guide-id={guide.slug}>
      <JsonLd data={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />
      <p className="eyebrow mt-6">{guide.category} guide</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {guide.title}
      </h1>
      <p
        className="mt-5 rounded-xl border-l-4 border-brand bg-brand-soft/60 px-5 py-4 text-lg"
        data-testid="short-answer"
      >
        {body.shortAnswer}
      </p>
      {reviewedOn ? (
        <p className="mt-2 text-sm text-muted">
          Last reviewed <time dateTime={reviewedOn}>{formatIsoDate(reviewedOn)}</time>
        </p>
      ) : null}

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
        <section aria-labelledby="requirements" className="mt-14">
          <h2 id="requirements" className="section-title">
            Requirements stated in the referenced {presets[0].source.authority}{" "}
            {presets[0].source.document ? "document" : "source"}
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
        <section key={section.id} aria-labelledby={section.id} className="mt-14">
          <h2 id={section.id} className="section-title">
            {section.heading}
          </h2>
          {section.blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </section>
      ))}

      {body.faq.length > 0 ? (
        <section aria-labelledby="faq" className="mt-14">
          <h2 id="faq" className="section-title">
            Frequently asked questions
          </h2>
          <div className="card mt-4 divide-y divide-border">
            {body.faq.map((item) => (
              <details key={item.question} className="group px-4 py-3">
                <summary
                  data-faq=""
                  className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 font-medium after:text-lg after:text-brand after:transition-transform after:content-['+'] group-open:after:rotate-45 [&::-webkit-details-marker]:hidden"
                >
                  <span>{item.question}</span>
                </summary>
                <p className="pb-2 text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section aria-labelledby="related-guides" className="mt-14">
          <h2 id="related-guides" className="section-title">
            Related guides
          </h2>
          <ul className="mt-3 space-y-2">
            {related.map((other) => (
              <li key={other.slug}>
                <Link href={guidePath(other)} className="text-link">
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
