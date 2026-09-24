"use client";

import { useId, type ReactNode } from "react";
import { FORMAT_LABELS } from "@/lib/image/formats";
import type { OutputFormat } from "@/lib/image/pipeline";
import { OUTPUT_FORMAT_LABELS } from "@/lib/tools/generic/common";
import { formatBytes } from "@/lib/validation/validate";
import type { SelectedImage } from "../image-job";

/** Selected file details. The filename is rendered as text (never HTML). */
export function SourceDetails({ image }: { image: SelectedImage }) {
  return (
    <dl
      className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-surface p-3 text-sm sm:grid-cols-4"
      data-testid="source-details"
    >
      <div className="col-span-2 min-w-0 sm:col-span-4">
        <dt className="sr-only">File name</dt>
        <dd className="truncate font-medium">{image.file.name}</dd>
      </div>
      <div>
        <dt className="text-muted">Width</dt>
        <dd className="font-semibold tabular-nums">{image.width} px</dd>
      </div>
      <div>
        <dt className="text-muted">Height</dt>
        <dd className="font-semibold tabular-nums">{image.height} px</dd>
      </div>
      <div>
        <dt className="text-muted">File size</dt>
        <dd className="font-semibold tabular-nums">{formatBytes(image.file.size)}</dd>
      </div>
      <div>
        <dt className="text-muted">Format</dt>
        <dd className="font-semibold">{FORMAT_LABELS[image.format]}</dd>
      </div>
    </dl>
  );
}

export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Radio option with a 44 px row and optional description. */
export function RadioOption({
  name,
  value,
  checked,
  disabled,
  onChange,
  label,
  description,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div
      className={`flex min-h-11 items-start gap-3 rounded-lg border px-3 py-2 ${
        checked ? "border-brand bg-brand-soft" : "border-border"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="mt-1 size-5 accent-brand"
      />
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="font-medium">{label}</span>
        {description ? (
          <span id={`${id}-desc`} className="block text-sm text-muted">
            {description}
          </span>
        ) : null}
      </label>
    </div>
  );
}

/** Output format choice; formats the browser can't encode are disabled and say why. */
export function FormatChoice({
  name,
  formats,
  value,
  encodable,
  onChange,
}: {
  name: string;
  formats: readonly OutputFormat[];
  value: OutputFormat;
  encodable: Record<OutputFormat, boolean> | null;
  onChange: (format: OutputFormat) => void;
}) {
  return (
    <Fieldset legend="Output format">
      <div className="grid gap-2 sm:grid-cols-3">
        {formats.map((format) => {
          const supported = encodable?.[format] ?? format !== "webp";
          return (
            <RadioOption
              key={format}
              name={name}
              value={format}
              checked={value === format}
              disabled={!supported}
              onChange={(next) => onChange(next as OutputFormat)}
              label={OUTPUT_FORMAT_LABELS[format]}
              description={supported ? undefined : "Not supported in this browser"}
            />
          );
        })}
      </div>
    </Fieldset>
  );
}

export function QualitySlider({
  value,
  onChange,
  onCommit,
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex justify-between font-semibold">
        <span>Quality</span>
        <output htmlFor={id} className="tabular-nums">
          {value}
        </output>
      </label>
      <input
        id={id}
        type="range"
        min={1}
        max={100}
        step={1}
        value={value}
        aria-valuetext={`${value} out of 100`}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="h-11 w-full accent-brand"
      />
      <p className="text-sm text-muted">
        Higher quality keeps more detail and makes a larger file.
      </p>
    </div>
  );
}

export function Notice({ tone, children }: { tone: "info" | "warning"; children: ReactNode }) {
  return (
    <p
      className={`rounded-lg border p-3 text-sm ${
        tone === "warning" ? "border-warning/40 bg-warning-soft" : "border-border bg-surface"
      }`}
    >
      {tone === "warning" ? <span className="font-semibold">Note: </span> : null}
      {children}
    </p>
  );
}

export const primaryButton =
  "min-h-12 w-full rounded-lg bg-brand px-6 py-3 text-lg font-semibold text-brand-foreground shadow-sm hover:opacity-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButton =
  "inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-border bg-background px-5 py-3 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto";
