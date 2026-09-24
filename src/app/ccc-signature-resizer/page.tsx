import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildToolMetadata } from "@/lib/seo/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("ccc-signature");

export const metadata: Metadata = buildToolMetadata(tool);

export default function Page() {
  return <ToolPage toolId={tool.id} />;
}
