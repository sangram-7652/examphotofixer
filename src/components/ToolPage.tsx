import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CropMarks } from "@/components/CropMarks";
import { JsonLd } from "@/components/JsonLd";
import { RequirementsTable } from "@/components/RequirementsTable";
import { ToolCard } from "@/components/ToolCard";
import { UploadPlaceholder } from "@/components/UploadPlaceholder";
import { ImageTool } from "@/components/tool/ImageTool";
import { PackTool } from "@/components/tool/PackTool";
import { ImageCompressorTool } from "@/components/tool/generic/ImageCompressorTool";
import { ImageResizerTool } from "@/components/tool/generic/ImageResizerTool";
import { guidePath, guidesForTool } from "@/content/guides";
import { getToolContent } from "@/content/tool-content";
import { EXAMS, getPreset } from "@/lib/presets";
import { SourceVerification } from "@/components/SourceVerification";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  toolJsonLd,
  type Crumb,
  type JsonLdObject,
} from "@/lib/seo/json-ld";
import { documentTitle } from "@/lib/tools/preset-labels";
import { TOOLS, getTool, type ToolId } from "@/lib/tools/registry";

const PRESET_STEPS = [
  "Choose your file (JPG or PNG).",
  "Adjust the crop so the image fills the required shape — nothing is stretched.",
  "We resize, compress and set DPI to match the requirements.",
  "Check the validation results, then download and upload to the form.",
];

const GENERIC_STEPS: Record<"generic-resize" | "generic-compress", string[]> = {
  "generic-resize": [
    "Choose your file (JPG or PNG).",
    "Enter the width and height you need in pixels.",
    "Adjust the crop so the image keeps its proportions.",
    "Download the resized image.",
  ],
  "generic-compress": [
    "Choose your file (JPG or PNG).",
    "Enter the maximum file size you need in KB.",
    "We find the best quality that fits under that size.",
    "Download the compressed image.",
  ],
};

export function ToolPage({ toolId }: { toolId: ToolId }) {
  const tool = getTool(toolId);
  const presets = tool.presetIds.map(getPreset);
  const content = getToolContent(tool, presets);
  const live = tool.status === "live";
  const guides = live ? guidesForTool(tool.id) : [];
  const livePreset = live && presets.length === 1 ? presets[0] : null;
  const livePack = live && tool.kind === "pack" && presets.length > 1;
  // One source section when every preset cites the same (shared) source object.
  const sharedSource =
    live && presets.length > 0 && presets.every((preset) => preset.source === presets[0].source)
      ? presets[0]
      : null;
  const pack =
    tool.kind !== "pack" && tool.exam
      ? TOOLS.find(
          (other) => other.kind === "pack" && other.exam === tool.exam && other.status === "live",
        )
      : undefined;
  // "photo, signature and left thumb impression", from the pack's own presets.
  const packDocuments = pack
    ? pack.presetIds
        .map((id) => documentTitle(getPreset(id)).toLowerCase())
        .join(", ")
        .replace(/, ([^,]*)$/, " and $1")
    : "";
  const steps =
    content?.howItWorks ??
    (tool.kind === "preset" || tool.kind === "pack" ? PRESET_STEPS : GENERIC_STEPS[tool.kind]);
  const related = TOOLS.filter(
    (other) => other.id !== tool.id && (tool.exam === null || other.exam === tool.exam),
  );
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Tools", path: "/tools" },
    { name: tool.name, path: tool.path },
  ];
  const jsonLd: JsonLdObject[] = [toolJsonLd(tool), breadcrumbJsonLd(crumbs)];
  if (content) jsonLd.push(faqJsonLd(content.faq));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8" data-analytics-tool-id={tool.id}>
      <JsonLd data={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      <p className="eyebrow mt-6">
        {tool.exam
          ? `${EXAMS[tool.exam].shortName} · ${EXAMS[tool.exam].conductingBody}`
          : "Image tool"}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {tool.h1}
      </h1>
      <p className="mt-3 text-muted sm:text-lg">{content?.intro ?? tool.summary}</p>

      <div className="mt-5">
        {livePreset ? (
          <ImageTool preset={livePreset} toolId={tool.id} />
        ) : livePack ? (
          <PackTool presets={presets} toolId={tool.id} />
        ) : live && tool.kind === "generic-resize" ? (
          <ImageResizerTool />
        ) : live && tool.kind === "generic-compress" ? (
          <ImageCompressorTool />
        ) : (
          <UploadPlaceholder label={tool.kind === "pack" ? "Select files" : "Select image"} />
        )}
      </div>

      {content?.callout ? (
        <p className="mt-6 rounded-xl border border-brand/20 bg-brand-soft/60 p-4 text-sm">
          {content.callout.text}{" "}
          <Link href={content.callout.href} className="text-link">
            {content.callout.linkText}
          </Link>
          .
        </p>
      ) : null}

      {pack ? (
        <p className="mt-6 rounded-xl border border-brand/20 bg-brand-soft/60 p-4 text-sm">
          Need the other {EXAMS[tool.exam!].shortName} application images too?{" "}
          <Link href={pack.path} className="text-link">
            Use the {pack.name}
          </Link>{" "}
          to prepare the {packDocuments} on one page.
        </p>
      ) : null}

      <section aria-labelledby="how-it-works" className="mt-14">
        <h2 id="how-it-works" className="section-title">
          How it works
        </h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 marker:font-semibold marker:text-brand">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      {presets.length > 0 ? (
        <section aria-labelledby="requirements" className="mt-14">
          <h2 id="requirements" className="section-title">
            {tool.exam
              ? `${EXAMS[tool.exam].shortName} upload requirements`
              : "Upload requirements"}
          </h2>
          <div className="mt-4 space-y-4">
            {presets.map((preset) => (
              <RequirementsTable key={preset.id} preset={preset} />
            ))}
          </div>
          {sharedSource ? <SourceVerification presets={presets} /> : null}
        </section>
      ) : null}

      {content ? (
        <>
          <section aria-labelledby="common-problems" className="mt-14">
            <h2 id="common-problems" className="section-title">
              Common problems this fixes
            </h2>
            <dl className="mt-4 space-y-4">
              {content.commonProblems.map((problem) => (
                <div key={problem.title}>
                  <dt className="font-semibold">{problem.title}</dt>
                  <dd className="mt-1 text-muted">{problem.body}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="faq" className="mt-14">
            <h2 id="faq" className="section-title">
              Frequently asked questions
            </h2>
            <div className="card mt-4 divide-y divide-border">
              {content.faq.map((item) => (
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
        </>
      ) : null}

      {guides.length > 0 ? (
        <section aria-labelledby="related-guides" className="mt-14">
          <h2 id="related-guides" className="section-title">
            Related guides
          </h2>
          <ul className="mt-3 space-y-2">
            {guides.map((guide) => (
              <li key={guide.slug}>
                <Link href={guidePath(guide)} className="text-link">
                  {guide.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        aria-labelledby="privacy-note"
        className="relative mt-14 rounded-xl border border-border bg-surface px-7 py-6"
      >
        <CropMarks inset="0.5rem" />
        <h2 id="privacy-note" className="font-semibold">
          Your files stay on your device
        </h2>
        <p className="mt-1 text-sm text-muted">
          Images are processed in your browser. They are not uploaded to or stored on our servers.{" "}
          <Link href="/privacy" className="text-link">
            Privacy policy
          </Link>
        </p>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related-tools" className="mt-14">
          <h2 id="related-tools" className="section-title">
            Related tools
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {related.map((other) => (
              <ToolCard key={other.id} tool={other} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
