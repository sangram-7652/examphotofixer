"use client";

import type { ReactNode } from "react";

interface DownloadButtonProps {
  /** Object URL of the final Blob produced by the engine. */
  href: string;
  filename: string;
  children: ReactNode;
  onDownload?: () => void;
}

/** A real link with `download`, so it works with keyboard, context menu and every browser. */
export function DownloadButton({ href, filename, children, onDownload }: DownloadButtonProps) {
  return (
    <a
      href={href}
      download={filename}
      onClick={onDownload}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-6 py-3 text-lg font-semibold text-brand-foreground shadow-sm hover:opacity-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto"
    >
      {children}
    </a>
  );
}
