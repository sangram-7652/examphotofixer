import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description: `How ${siteConfig.name} handles your files and data. Images are processed in your browser and are not uploaded.`,
  path: "/privacy",
});

// DRAFT: requires legal review before public launch. Keep in sync with docs/PRIVACY.md.
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-3">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>

      <h2>Your files</h2>
      <p>
        {siteConfig.name} processes photos, signatures and other files in your web browser. Your
        files are not uploaded to, stored on, or viewed on our servers.
      </p>

      <h2>No accounts</h2>
      <p>We do not offer accounts and do not ask for your name, email address or phone number.</p>

      <h2>Analytics</h2>
      <p>
        The site prepares anonymous usage events, such as &ldquo;a photo was processed&rdquo; or
        &ldquo;a guide link was clicked&rdquo;, to understand which pages and tools are useful. They
        never include your files, file names, image contents, photo location or camera details, or
        anything you type. At present these events are not sent to any analytics service, and no
        analytics cookies are used. If that changes, this page will be updated first.
      </p>

      <h2>Contact</h2>
      <p>Questions about this policy can be sent to the contact listed on this site.</p>
    </article>
  );
}
