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
      className="btn-primary w-full text-lg sm:w-auto"
    >
      {children}
    </a>
  );
}
