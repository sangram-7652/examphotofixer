import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {siteConfig.name}
        </Link>
        <nav aria-label="Main">
          <ul className="flex gap-5 text-sm font-medium text-muted">
            <li>
              <Link href="/tools" className="hover:text-foreground">
                Tools
              </Link>
            </li>
            <li>
              <Link href="/guides" className="hover:text-foreground">
                Guides
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
