import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Use",
  description: `Terms for using ${siteConfig.name} tools.`,
  path: "/terms",
});

// DRAFT: requires legal review before public launch.
export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-3">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Terms of Use</h1>

      <h2>Not affiliated</h2>
      <p>
        {siteConfig.name} is an independent tool. It is not affiliated with, endorsed by, or
        operated by any exam body, university or government department.
      </p>

      <h2>Check official requirements</h2>
      <p>
        We take care to keep requirements accurate and show their sources, but exam bodies can
        change them at any time. Always check the official notification before you upload. You are
        responsible for the files you submit.
      </p>

      <h2>Use of the tools</h2>
      <p>
        The tools are provided free of charge and &quot;as is&quot;, without warranties of any kind.
      </p>
    </article>
  );
}
