import Link from "next/link";
import { siteConfig } from "@/config/site";
import { TOOLS } from "@/lib/tools/registry";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-semibold">{siteConfig.name}</p>
          <p className="mt-1 text-sm text-muted">{siteConfig.tagline}</p>
          <p className="mt-1 text-sm text-muted">{siteConfig.category}</p>
        </div>
        <nav aria-label="Tools">
          <p className="text-sm font-semibold">Tools</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {TOOLS.map((tool) => (
              <li key={tool.id}>
                <Link href={tool.path} className="hover:text-foreground">
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Site">
          <p className="text-sm font-semibold">Site</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>
              <Link href="/tools" className="hover:text-foreground">
                All tools
              </Link>
            </li>
            <li>
              <Link href="/guides" className="hover:text-foreground">
                Guides
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-5xl px-4 pb-8 text-xs text-muted">
        {siteConfig.name} is an independent tool and is not affiliated with any exam body. Always
        check the official notification before you upload.
      </p>
    </footer>
  );
}
