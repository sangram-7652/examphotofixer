"use client";

import { useId, useRef, useState, type DragEvent } from "react";

/** Accepted inputs (also enforced by content sniffing in the tool and engine). */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

interface ImageUploaderProps {
  onSelect: (file: File) => void;
  /** Noun used in labels, e.g. "photo". */
  noun: string;
  error?: string | null;
  busy?: boolean;
}

/**
 * File picker with drag-and-drop and camera capture. Files are handed to the
 * parent; nothing is uploaded anywhere.
 */
export function ImageUploader({ onSelect, noun, error, busy = false }: ImageUploaderProps) {
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
      className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
        dragging ? "border-brand bg-brand-soft" : "border-brand/40 bg-brand-soft/60"
      }`}
    >
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
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          disabled={busy}
          aria-describedby={describedBy}
          onClick={() => browseRef.current?.click()}
          className="min-h-12 w-full rounded-lg bg-brand px-6 py-3 text-lg font-semibold text-brand-foreground shadow-sm hover:opacity-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60 sm:w-auto"
        >
          {busy ? "Opening…" : `Choose ${noun}`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="min-h-12 w-full rounded-lg border border-brand bg-background px-6 py-3 font-semibold text-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60 sm:hidden"
        >
          Capture image
        </button>
      </div>
      <p className="mt-3 text-sm text-muted sm:hidden">
        Using the camera? Follow the application&apos;s official image instructions shown on this
        page.
      </p>
      <p id={hintId} className="mt-3 text-sm text-muted">
        JPG, PNG or WebP · up to 25 MB ·{" "}
        <span className="hidden sm:inline">drag &amp; drop or </span>
        choose a file · stays on your device
      </p>
      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
