import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { GUIDE_CATEGORIES, guidePath, listGuides } from "@/content/guides";
import { breadcrumbJsonLd, type Crumb } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Guides – CCC & IBPS Photo, Signature and Document Requirements",
  description:
    "Short guides to the CCC and IBPS photo, signature, thumb impression and declaration requirements, with their official sources, and fixes for common photo upload problems.",
  path: "/guides",
});

const crumbs: Crumb[] = [
  { name: "Home", path: "/" },
  { name: "Guides", path: "/guides" },
];

export default function GuidesPage() {
  const guides = listGuides();
  const categories = GUIDE_CATEGORIES.filter((category) =>
    guides.some((guide) => guide.category === category),
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs crumbs={crumbs} />
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Guides</h1>
      <p className="mt-2 text-muted">
        Clear answers about image requirements and upload problems, each linked to the tool that
        fixes it.
      </p>
      {categories.map((category) => (
        <section key={category} aria-labelledby={`cat-${category}`} className="mt-8">
          <h2 id={`cat-${category}`} className="section-title">
            {category}
          </h2>
          <ul className="mt-3 space-y-3">
            {guides
              .filter((guide) => guide.category === category)
              .map((guide) => (
                <li key={guide.slug} className="card p-5">
                  <Link
                    href={guidePath(guide)}
                    className="text-lg font-semibold text-foreground underline-offset-4 hover:text-brand hover:underline"
                  >
                    {guide.title}
                  </Link>
                  <p className="mt-1 text-sm text-muted">{guide.summary}</p>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
