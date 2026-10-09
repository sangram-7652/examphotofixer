import type { Metadata } from "next";
import Link from "next/link";
import { CropMarks } from "@/components/CropMarks";
import { ExamCard } from "@/components/ExamCard";
import { ExamSearch, type ExamSearchEntry } from "@/components/ExamSearch";
import { JsonLd } from "@/components/JsonLd";
import { SpecFrame } from "@/components/SpecFrame";
import { ToolCard } from "@/components/ToolCard";
import { siteConfig } from "@/config/site";
import { guidePath, listGuides } from "@/content/guides";
import { listExams, listPresets, verifiedScopeSummary } from "@/lib/presets";
import { describePreset } from "@/lib/presets/describe";
import { formatIsoDate, isVerifiedSource, sourceCitation } from "@/lib/presets/source";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { genericTools, TOOLS, toolsForExam } from "@/lib/tools/registry";

// "for CCC and IBPS RRB" is a reader-friendly stand-in for the exact verified scope (CCC and
// IBPS CRP RRBs-XV); the body copy and tool pages below state the precise scope.
//
// The root layout's `title.template` ("%s | ExamPhotoFixer") never applies here: per Next's
// docs (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md),
// a layout's title.template does not apply to a title set by page.tsx of that SAME route
// segment, and "/" is exactly that segment. So the "| <site name>" suffix is written out in
// full below rather than left for the template to add — it would otherwise be silently dropped.
const homeTitle = `Exam Photo & Signature Resizer for CCC and IBPS RRB | ${siteConfig.name}`;
const homeDescription =
  "Resize and compress photos, signatures and thumb impressions for CCC and IBPS RRB (CRP RRBs-XV) application forms. Processing happens in your browser — images are never uploaded or stored on a server.";

export const metadata: Metadata = {
  ...buildPageMetadata({ title: homeTitle, description: homeDescription, path: "/" }),
  // Belt-and-suspenders: guarantees the full title (including the site name) is what's rendered
  // even if the template-resolution behaviour above ever changes, without depending on it.
  title: { absolute: homeTitle },
};

// Priority guides linked directly from the homepage so key answer pages are reachable in one click.
const FEATURED_GUIDE_SLUGS = [
  "ccc-photo-size",
  "ccc-signature-size",
  "ccc-thumb-impression-size",
  "ccc-photo-upload-problems",
  "ibps-photo-size",
  "ibps-signature-thumb-declaration-size",
] as const;

const STEPS = [
  { title: "Upload", body: "Choose the exam, then the photo, signature or thumb impression." },
  {
    title: "Fix",
    body: "Crop to the exact shape, resize and compress to the required size. Nothing is stretched.",
  },
  {
    title: "Check",
    body: "The result is checked against the requirement: dimensions, file size, format and DPI.",
  },
  { title: "Download", body: "Save the JPG and upload it to the application form." },
];

export default function HomePage() {
  const examEntries: ExamSearchEntry[] = listExams().map((exam) => {
    // Hub = the exam's pack if it has one, otherwise its first live tool.
    const live = toolsForExam(exam.id).filter((tool) => tool.status === "live");
    const hub = live.find((tool) => tool.kind === "pack") ?? live[0];
    return { exam, href: hub?.path ?? null, toolId: hub?.id ?? null };
  });

  // One card per exam with live tools (from the registry), so every verified exam is listed.
  const examSections = listExams()
    .map((exam) => ({ exam, tools: toolsForExam(exam.id).filter((t) => t.status === "live") }))
    .filter(({ tools }) => tools.length > 0);

  // Direct links to the guides that answer the most common size/KB/DPI and upload questions.
  const allGuides = listGuides();
  const featuredGuides = FEATURED_GUIDE_SLUGS.map((slug) =>
    allGuides.find((guide) => guide.slug === slug),
  ).filter((guide): guide is NonNullable<typeof guide> => guide !== undefined);

  // The hero's spec sheet shows a real, verified requirement: the first live photo preset.
  const livePresetIds = new Set(
    TOOLS.filter((tool) => tool.status === "live").flatMap((tool) => tool.presetIds),
  );
  const featured = listPresets().find(
    (preset) =>
      preset.documentType === "photo" &&
      livePresetIds.has(preset.id) &&
      isVerifiedSource(preset.source),
  );
  const featuredTool = featured
    ? TOOLS.find((tool) => tool.kind === "preset" && tool.presetIds[0] === featured.id)
    : undefined;

  return (
    <>
      <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:py-20 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="eyebrow">Exam &amp; application image tools</p>
            <h1 className="mt-4 font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl">
              Fix your exam photo before you upload it.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              Resize, compress and prepare application images to match verified requirements —
              directly in your browser.
            </p>
            <p className="mt-3 max-w-xl text-sm text-muted">
              ExamPhotoFixer helps users in India prepare exam application photos and documents.
              Requirements are currently verified for {verifiedScopeSummary()}.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="#exams" className="btn-primary">
                Fix an image
              </Link>
              <Link href="/tools" className="btn-secondary">
                Browse exam tools
              </Link>
            </div>
          </div>

          {featured ? (
            <figure
              className="card relative mx-auto w-full max-w-sm p-6"
              aria-labelledby="spec-sheet"
            >
              <figcaption id="spec-sheet" className="flex items-center justify-between gap-3">
                <span className="eyebrow">Requirement</span>
                <span className="text-sm font-semibold">{featured.label}</span>
              </figcaption>
              <div className="mt-5 flex justify-center">
                <SpecFrame preset={featured} maxHeight={176} />
              </div>
              <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
                {[
                  ["File size", describePreset(featured).kb],
                  ["Format", describePreset(featured).format],
                  ["DPI", describePreset(featured).dpi.replace(" DPI", "")],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-surface px-2 py-2">
                    <dt className="text-[0.7rem] text-muted">{label}</dt>
                    <dd className="spec-value text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted">
                From {sourceCitation(featured.source)}, checked{" "}
                <time dateTime={featured.source.verifiedOn!}>
                  {formatIsoDate(featured.source.verifiedOn!)}
                </time>
                .{" "}
                {featuredTool ? (
                  <Link href={featuredTool.path} className="text-link">
                    Open the {featuredTool.name}
                  </Link>
                ) : null}
              </p>
            </figure>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 py-14">
        <h2 id="how" className="section-title">
          Four steps, all on your device
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-xl border border-border p-5">
              <span
                aria-hidden="true"
                className="spec-value flex size-8 items-center justify-center rounded-full bg-brand-soft text-sm text-brand"
              >
                {index + 1}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="privacy" className="mx-auto max-w-6xl px-4">
        <div className="relative overflow-hidden rounded-2xl bg-foreground px-6 py-10 text-background sm:px-10">
          <CropMarks inset="1rem" />
          <h2
            id="privacy"
            className="font-display text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Your image stays in your browser.
          </h2>
          <p className="mt-3 max-w-2xl opacity-85">
            Images are processed locally. We don&apos;t upload or store your photo, and location and
            camera details are removed from the file you download.
          </p>
          <Link
            href="/privacy"
            className="mt-5 inline-block font-semibold underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-background"
          >
            Read the privacy policy
          </Link>
        </div>
      </section>

      <section aria-labelledby="exams-title" id="exams" className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-end">
          <div>
            <h2 id="exams-title" className="section-title">
              Choose your exam
            </h2>
            <p className="mt-2 text-muted">
              Requirements come from each exam body&apos;s published notification, with the version
              and date shown on every tool.
            </p>
          </div>
          <ExamSearch entries={examEntries} />
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {examSections.map(({ exam, tools }) => (
            <ExamCard key={exam.id} exam={exam} tools={tools} />
          ))}
        </div>
      </section>

      {featuredGuides.length > 0 ? (
        <section aria-labelledby="guides-title" className="mx-auto max-w-6xl px-4 py-4">
          <h2 id="guides-title" className="section-title">
            Guides: size, KB, DPI and upload problems
          </h2>
          <p className="mt-2 text-muted">
            Short answers to the most common CCC and IBPS RRB requirement questions.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {featuredGuides.map((guide) => (
              <li key={guide.slug} className="card p-5">
                <Link
                  href={guidePath(guide)}
                  className="font-semibold text-foreground underline-offset-4 hover:text-brand hover:underline"
                >
                  {guide.title}
                </Link>
                <p className="mt-1 text-sm text-muted">{guide.summary}</p>
              </li>
            ))}
          </ul>
          <Link href="/guides" className="text-link mt-4 inline-block text-sm">
            See all guides
          </Link>
        </section>
      ) : null}

      <section aria-labelledby="image-tools" className="mx-auto max-w-6xl px-4">
        <h2 id="image-tools" className="section-title">
          General image tools
        </h2>
        <p className="mt-2 text-muted">For any other form: your own size or file-size limit.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {genericTools().map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>
    </>
  );
}
