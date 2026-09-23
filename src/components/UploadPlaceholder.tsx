/**
 * Placeholder for the tool workspace. Replaced by the real uploader once the
 * image pipeline ships; the layout slot and CTA position stay the same.
 */
export function UploadPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-brand/40 bg-brand-soft px-4 py-10 text-center">
      <button
        type="button"
        disabled
        aria-describedby="tool-status"
        className="rounded-lg bg-brand px-6 py-3 font-semibold text-brand-foreground opacity-60"
      >
        {label}
      </button>
      <p id="tool-status" className="mt-3 text-sm text-muted">
        This tool is being built. Your files will be processed in your browser and never uploaded to
        our servers.
      </p>
    </div>
  );
}
