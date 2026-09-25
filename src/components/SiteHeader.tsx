import Link from "next/link";
import { CropMarks } from "@/components/CropMarks";
import { siteConfig } from "@/config/site";

const NAV = [
  { href: "/tools", label: "Tools" },
  { href: "/#exams", label: "Exams" },
  { href: "/guides", label: "Guides" },
];

/** Server-rendered header; the mobile menu is a native <details>, so it needs no JavaScript. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <span aria-hidden="true" className="relative block size-7 rounded-[3px] bg-brand-soft">
            <CropMarks inset="3px" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">{siteConfig.name}</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden md:block">
          <ul className="flex items-center gap-1 text-sm font-medium">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-3 focus-visible:outline-brand"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link href="/#exams" className="btn-primary ml-auto min-h-10 px-4 py-2 text-sm md:ml-2">
          <span className="hidden sm:inline">Start with a photo</span>
          <span className="sm:hidden">Start</span>
        </Link>

        <details className="group relative md:hidden">
          <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg border border-border focus-visible:outline-3 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
            <span className="sr-only">Menu</span>
            <span aria-hidden="true" className="flex w-4 flex-col gap-1">
              <span className="h-0.5 rounded bg-foreground" />
              <span className="h-0.5 rounded bg-foreground" />
              <span className="h-0.5 rounded bg-foreground" />
            </span>
          </summary>
          <nav aria-label="Main" className="card absolute right-0 mt-2 w-48 p-2 shadow-lg">
            <ul className="flex flex-col text-base font-medium">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center rounded-md px-3 hover:bg-surface focus-visible:outline-3 focus-visible:outline-brand"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </details>
      </div>
    </header>
  );
}
