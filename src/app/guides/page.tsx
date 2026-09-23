import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo/metadata";

// No guides are published yet, so this page stays out of the index and the sitemap.
export const metadata: Metadata = buildPageMetadata({
  title: "Guides",
  description: "Step-by-step guides for preparing exam and application uploads.",
  path: "/guides",
  noIndex: true,
});

export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Guides</h1>
      <p className="mt-4 text-muted">
        Guides are on the way. Meanwhile, the{" "}
        <Link href="/tools" className="underline">
          tools
        </Link>{" "}
        list each exam&apos;s upload requirements.
      </p>
    </div>
  );
}
