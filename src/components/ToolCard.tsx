import Link from "next/link";
import type { ToolDefinition } from "@/lib/tools/registry";

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  return (
    <Link
      href={tool.path}
      className="block rounded-lg border border-border p-4 transition-colors hover:border-brand hover:bg-brand-soft"
    >
      <h3 className="font-semibold">{tool.name}</h3>
      <p className="mt-1 text-sm text-muted">{tool.summary}</p>
    </Link>
  );
}
