import { SourceLink } from "@/components/SourceLink";
import {
  formatIsoDate,
  formatPages,
  isVerifiedSource,
  presetSourcePages,
  sourceCitation,
} from "@/lib/presets/source";
import type { ImagePreset } from "@/lib/presets/types";

/**
 * "Source and verification" block for presets that share one source (a tool, a pack or a
 * guide). The single citation UI used by tool pages and guides; cites every page the presets'
 * values come from.
 */
export function SourceVerification({ presets }: { presets: readonly ImagePreset[] }) {
  const { source } = presets[0];
  const pages = formatPages(presets.flatMap(presetSourcePages));
  const verified = isVerifiedSource(source);
  return (
    <section
      aria-labelledby="source"
      data-testid="requirements-source"
      className="mt-6 rounded-lg bg-surface p-4 text-sm"
    >
      <h3 id="source" className="font-semibold">
        Source and verification
      </h3>
      <p className="mt-1">Requirements based on {sourceCitation(source)}.</p>
      {verified && source.verifiedOn ? (
        <p className="mt-1">
          Values verified against the source on{" "}
          <time dateTime={source.verifiedOn}>{formatIsoDate(source.verifiedOn)}</time>
          {pages ? ` (${pages})` : ""}. <SourceLink source={source}>View source</SourceLink>
        </p>
      ) : (
        <p className="mt-1">The official source link has not been recorded yet.</p>
      )}
      <p className="mt-2 text-muted">
        ExamPhotoFixer is an independent tool and is not affiliated with {source.authority}. We only
        reference their published requirements. Guidelines can change — check the current version
        before you upload.
      </p>
    </section>
  );
}
