import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { RequirementsTable } from "@/components/RequirementsTable";
import { ToolCard } from "@/components/ToolCard";
import { UploadPlaceholder } from "@/components/UploadPlaceholder";
import { getPreset } from "@/lib/presets";
import { breadcrumbJsonLd, toolJsonLd, type Crumb } from "@/lib/seo/json-ld";
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
  const steps =
    tool.kind === "preset" || tool.kind === "pack" ? PRESET_STEPS : GENERIC_STEPS[tool.kind];
  const related = TOOLS.filter(
    (other) => other.id !== tool.id && (tool.exam === null || other.exam === tool.exam),
  );
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Tools", path: "/tools" },
    { name: tool.name, path: tool.path },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <JsonLd data={[toolJsonLd(tool), breadcrumbJsonLd(crumbs)]} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 className="mt-4 text-3xl font-bold tracking-tight">{tool.h1}</h1>
      <p className="mt-2 text-muted">{tool.summary}</p>

      <div className="mt-6">
        <UploadPlaceholder label={tool.kind === "pack" ? "Select files" : "Select image"} />
      </div>

      {presets.length > 0 ? (
        <section aria-labelledby="requirements" className="mt-10">
          <h2 id="requirements" className="text-xl font-semibold">
            Upload requirements
          </h2>
          <div className="mt-4 space-y-4">
            {presets.map((preset) => (
              <RequirementsTable key={preset.id} preset={preset} />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="how-it-works" className="mt-10">
        <h2 id="how-it-works" className="text-xl font-semibold">
          How it works
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="privacy-note" className="mt-10 rounded-lg bg-surface p-4">
        <h2 id="privacy-note" className="font-semibold">
          Your files stay on your device
        </h2>
        <p className="mt-1 text-sm text-muted">
          Images are processed in your browser. They are not uploaded to or stored on our servers.{" "}
          <Link href="/privacy" className="underline">
            Privacy policy
          </Link>
        </p>
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related-tools" className="mt-10">
          <h2 id="related-tools" className="text-xl font-semibold">
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
