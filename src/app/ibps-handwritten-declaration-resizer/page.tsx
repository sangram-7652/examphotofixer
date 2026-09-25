import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("ibps-declaration");

export const metadata: Metadata = buildToolMetadata(tool);

export default function Page() {
  return <ToolPage toolId={tool.id} />;
}
