import type { Metadata } from "next";
import { ToolPage } from "@/components/ToolPage";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getTool } from "@/lib/tools/registry";

const tool = getTool("image-compressor");

export const metadata: Metadata = buildPageMetadata({
  title: tool.metaTitle,
  description: tool.metaDescription,
  path: tool.path,
});

export default function Page() {
  return <ToolPage toolId={tool.id} />;
}
