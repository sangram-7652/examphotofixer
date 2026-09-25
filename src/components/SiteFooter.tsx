import Link from "next/link";
import { siteConfig } from "@/config/site";
import { listExams } from "@/lib/presets";
import { genericTools, toolsForExam } from "@/lib/tools/registry";

const linkClass = "text-muted transition-colors hover:text-foreground";

export function SiteFooter() {
  // One column per exam with tools, then general tools; built from the registry.
  const groups = [
    ...listExams()
      .map((exam) => ({ label: `${exam.shortName} tools`, tools: toolsForExam(exam.id) }))
      .filter((group) => group.tools.length > 0),
    { label: "Image tools", tools: genericTools() },
  ];
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <p className="font-display text-lg font-bold tracking-tight">{siteConfig.name}</p>
          <p className="mt-1 text-sm text-muted">{siteConfig.tagline}</p>
          <p className="mt-4 max-w-xs text-sm text-muted">
            Images are processed in your browser and are never uploaded to our servers.
          </p>
        </div>
        {groups.map((group) => (
          <nav key={group.label} aria-label={group.label}>
            <p className="text-sm font-semibold">{group.label}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {group.tools.map((tool) => (
                <li key={tool.id}>
                  <Link href={tool.path} className={linkClass}>
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <nav aria-label="Site">
          <p className="text-sm font-semibold">Site</p>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              { href: "/tools", label: "All tools" },
              { href: "/guides", label: "Guides" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl border-t border-border px-4 py-6 text-xs text-muted">
        {siteConfig.name} is an independent tool and is not affiliated with any exam body. Always
        check the official notification before you upload.
      </p>
    </footer>
  );
}
