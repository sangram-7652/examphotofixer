"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { CropMarks } from "@/components/CropMarks";

/** Accepted inputs (also enforced by content sniffing in the tool and engine). */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

interface ImageUploaderProps {
  onSelect: (file: File) => void;
  /** Noun used in labels, e.g. "photo". */
  noun: string;
  error?: string | null;
  busy?: boolean;
  /** Shown next to the capture button when the source cautions against this capture method. */
  captureCaveat?: string;
}

/**
 * File picker with drag-and-drop and camera capture. Files are handed to the
 * parent; nothing is uploaded anywhere.
 */
export function ImageUploader({
  onSelect,
  noun,
  error,
  busy = false,
  captureCaveat,
}: ImageUploaderProps) {
  const browseRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const errorId = useId();

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onSelect(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!busy) take(event.dataTransfer.files);
  };

  const describedBy = error ? `${hintId} ${errorId}` : hintId;

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors sm:py-10 ${
        dragging ? "border-brand bg-brand-soft" : "border-border-strong bg-surface"
      }`}
    >
      <CropMarks inset="0.625rem" />
      <input
        ref={browseRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="file-input"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
      <p className="font-semibold">
        <span className="hidden sm:inline">Drop your {noun} here, or choose a file</span>
        <span className="sm:hidden">Choose your {noun}</span>
      </p>
      <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          disabled={busy}
          aria-describedby={describedBy}
          onClick={() => browseRef.current?.click()}
          className="btn-primary w-full sm:w-auto"
        >
          {busy ? "Opening…" : `Choose ${noun}`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="btn-secondary w-full sm:hidden"
        >
          Capture image
        </button>
      </div>
      <p className="mt-3 text-sm text-muted sm:hidden">
        {captureCaveat ??
          "Using the camera? Follow the application's official image instructions shown on this page."}
      </p>
      <p id={hintId} className="mt-3 text-sm text-muted">
        JPG, PNG or WebP · up to 25 MB ·{" "}
        <span className="hidden sm:inline">drag &amp; drop or </span>
        choose a file · stays on your device
      </p>
      <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs font-medium text-success">
        <span aria-hidden="true">●</span> Processed in your browser — never uploaded
      </p>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mx-auto mt-4 max-w-md rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
