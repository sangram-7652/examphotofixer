import Link from "next/link";
import type { ToolDefinition } from "@/lib/tools/registry";

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  return (
    <Link
      href={tool.path}
      className="group card flex h-full flex-col p-5 transition-colors hover:border-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <h3 className="flex items-start justify-between gap-3 font-semibold">
        <span>
          {tool.name}
          {tool.status === "coming-soon" ? (
            <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted">
              Coming soon
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
        >
          →
        </span>
      </h3>
      <p className="mt-1.5 text-sm text-muted">{tool.summary}</p>
    </Link>
  );
}
