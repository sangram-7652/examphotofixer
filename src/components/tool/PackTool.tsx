"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import type { ImagePreset } from "@/lib/presets/types";
import {
  ASSET_STATE_TEXT,
  assetStateFor,
  derivePackState,
  type AssetState,
  type PackState,
} from "@/lib/tools/pack-state";
import { buildPackFilename, documentTitle } from "@/lib/tools/preset-labels";
import { createZip } from "@/lib/zip/zip";
import { ImageTool, type ImageToolStatus } from "./ImageTool";

interface AssetRecord {
  state: AssetState;
  output: ImageToolStatus["output"];
}

const MARKS: Record<AssetState, string> = {
  EMPTY: "○",
  SELECTED: "…",
  PROCESSING: "…",
  READY: "✓",
  READY_WITH_WARNING: "⚠",
  INVALID: "✕",
  ERROR: "✕",
};

const PACK_TEXT: Record<PackState, string> = {
  EMPTY: "Add all three files to build your pack.",
  IN_PROGRESS: "Keep going — each file must be processed before you can download the pack.",
  READY: "All files are ready.",
  READY_WITH_WARNING: "All files are processed. One or more has a warning.",
  INCOMPLETE: "One or more files can't be used yet. Fix the file marked below.",
};

function downloadUrl(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Several presets on one page (e.g. CCC photo, signature, left thumb), each
 * using the standard ImageTool, plus a combined status and a local ZIP download.
 */
export function PackTool({ presets, toolId }: { presets: readonly ImagePreset[]; toolId: string }) {
  const [generation, setGeneration] = useState(0);
  const [assets, setAssets] = useState<Record<string, AssetRecord>>({});
  const [zipError, setZipError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const zipUrls = useRef(new Set<string>());

  const exam = presets[0].exam;
  const packFilename = buildPackFilename(exam);
  const states = presets.map((preset) => assets[preset.id]?.state ?? "EMPTY");
  const packState = derivePackState(states);
  const downloadable = packState === "READY" || packState === "READY_WITH_WARNING";

  const releaseZips = useCallback(() => {
    zipUrls.current.forEach((url) => URL.revokeObjectURL(url));
    zipUrls.current.clear();
  }, []);

  const packProps = { tool_id: toolId, tool_type: "pack", exam_id: exam };

  useEffect(() => {
    trackEvent("tool_viewed", { tool_id: toolId, tool_type: "pack", exam_id: exam });
  }, [toolId, exam]);

  // Completion events fire on the transition into a usable state, once each.
  const reported = useRef<{ assets: Record<string, AssetState>; pack: PackState }>({
    assets: {},
    pack: "EMPTY",
  });
  useEffect(() => {
    const previous = reported.current;
    presets.forEach((preset, index) => {
      const state = states[index];
      const was = previous.assets[preset.id] ?? "EMPTY";
      if (state !== was && (state === "READY" || state === "READY_WITH_WARNING")) {
        trackEvent("pack_asset_completed", {
          ...packProps,
          asset_type: preset.documentType,
          result_state: state,
        });
      }
      previous.assets[preset.id] = state;
    });
    if (
      packState !== previous.pack &&
      (packState === "READY" || packState === "READY_WITH_WARNING")
    ) {
      trackEvent("pack_completed", {
        ...packProps,
        result_state: packState,
        asset_count: presets.length,
      });
    }
    previous.pack = packState;
  });
  useEffect(() => releaseZips, [releaseZips]);

  const handlers = useMemo(
    () =>
      Object.fromEntries(
        presets.map((preset) => [
          preset.id,
          (status: ImageToolStatus) => {
            const next: AssetRecord = {
              state: assetStateFor(status.state, status.hasError),
              output: status.output,
            };
            setAssets((previous) => {
              const current = previous[preset.id];
              if (current && current.state === next.state && current.output === next.output) {
                return previous;
              }
              return { ...previous, [preset.id]: next };
            });
            setZipError(null);
          },
        ]),
      ),
    [presets],
  );

  const downloadAll = async () => {
    const outputs = presets.map((preset) => assets[preset.id]?.output ?? null);
    if (!downloadable || outputs.some((output) => output === null)) return;
    const downloadProps = {
      ...packProps,
      asset_type: "pack",
      output_format: "zip",
      result_state: packState,
    };
    trackEvent("download_started", downloadProps);
    setBuilding(true);
    setZipError(null);
    try {
      const entries = await Promise.all(
        outputs.map(async (output) => ({
          name: output!.filename,
          // The engine's final bytes, stored unchanged.
          data: new Uint8Array(await output!.blob.arrayBuffer()),
        })),
      );
      const url = URL.createObjectURL(new Blob([createZip(entries)], { type: "application/zip" }));
      releaseZips();
      zipUrls.current.add(url);
      downloadUrl(url, packFilename);
      // Hand-off to the browser, not a confirmed save (see docs/ANALYTICS.md).
      trackEvent("download_completed", downloadProps);
    } catch {
      setZipError(
        "We couldn't create the ZIP file. Your processed files are still here — use each file's own download button.",
      );
    } finally {
      setBuilding(false);
    }
  };

  const reset = () => {
    releaseZips();
    setAssets({});
    setZipError(null);
    setGeneration((value) => value + 1); // remounts every ImageTool, which releases its files
  };

  const warningAssets = presets.filter((_, i) => states[i] === "READY_WITH_WARNING");
  const blockedAssets = presets.filter((_, i) => states[i] === "INVALID" || states[i] === "ERROR");

  return (
    <div data-testid="pack-tool" data-pack-state={packState} className="space-y-6">
      <ol className="space-y-6">
        {presets.map((preset, index) => (
          <li key={preset.id}>
            <section
              aria-labelledby={`pack-${preset.id}`}
              data-testid={`pack-asset-${preset.id}`}
              className="space-y-3"
            >
              <h2 id={`pack-${preset.id}`} className="text-xl font-semibold">
                {index + 1}. {documentTitle(preset)}
              </h2>
              <ImageTool
                key={`${generation}-${preset.id}`}
                preset={preset}
                toolId={toolId}
                embedded
                headingLevel={3}
                onStatusChange={handlers[preset.id]}
              />
            </section>
          </li>
        ))}
      </ol>

      <section
        aria-labelledby="pack-status"
        data-testid="pack-status"
        className="rounded-xl border-2 border-brand/40 p-4 sm:p-6"
      >
        <h2 id="pack-status" className="text-xl font-semibold">
          Pack status
        </h2>
        <p role="status" aria-live="polite" className="mt-1 text-muted">
          {PACK_TEXT[packState]}
        </p>
        <ul className="mt-3 space-y-2">
          {presets.map((preset, index) => (
            <li
              key={preset.id}
              data-asset={preset.id}
              data-state={states[index]}
              className="flex items-start gap-2"
            >
              <span aria-hidden="true" className="w-5 font-bold">
                {MARKS[states[index]]}
              </span>
              <span>
                <span className="font-medium">{documentTitle(preset)}</span> —{" "}
                {ASSET_STATE_TEXT[states[index]]}
              </span>
            </li>
          ))}
        </ul>

        {warningAssets.length > 0 ? (
          <p
            className="mt-4 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm"
            data-testid="pack-warning"
          >
            One or more files are below the stated minimum file size. We kept the highest-quality
            versions. The application website may still enforce its own minimum-size check.
          </p>
        ) : null}

        {blockedAssets.length > 0 ? (
          <p className="mt-4 rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm">
            {blockedAssets.map(documentTitle).join(", ")}{" "}
            {blockedAssets.length === 1 ? "needs" : "need"} attention before the pack can be
            downloaded.
          </p>
        ) : null}

        {zipError ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm"
          >
            {zipError}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {downloadable ? (
            <button
              type="button"
              onClick={downloadAll}
              disabled={building}
              className="min-h-12 w-full rounded-lg bg-brand px-6 py-3 text-lg font-semibold text-brand-foreground shadow-sm hover:opacity-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60 sm:w-auto"
            >
              {building ? "Preparing ZIP…" : "Download All (ZIP)"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-border bg-background px-5 py-3 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto"
          >
            Start again<span className="sr-only"> with all files</span>
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          The ZIP is created on your device and contains exactly the files shown above.
        </p>
      </section>
    </div>
  );
}
