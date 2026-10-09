import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { resolveGa4MeasurementId } from "@/lib/analytics/providers/ga4";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description: `How ${siteConfig.name} handles your files and data. Images are processed in your browser and are not uploaded.`,
  path: "/privacy",
});

// DRAFT: requires legal review before public launch. Keep in sync with docs/PRIVACY.md.
export default function PrivacyPage() {
  const gaEnabled = resolveGa4MeasurementId() !== null;
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-3">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>

      <h2>Your files</h2>
      <p>
        {siteConfig.name} processes photos, signatures and other files in your web browser. Your
        files are not uploaded to, stored on, or viewed on our servers.
      </p>

      <h2>No accounts</h2>
      <p>We do not offer accounts and do not ask for your name, email address or phone number.</p>

      <h2>Analytics</h2>
      <p>
        The site prepares usage events without any identifiers, such as &ldquo;a photo was
        processed&rdquo; or &ldquo;a guide link was clicked&rdquo;, to understand which pages and
        tools are useful. They never include your files, file names, image contents, photo location
        or camera details, or anything you type.{" "}
        {gaEnabled ? (
          <>
            These events are sent to Google Analytics 4 (GA4), configured cookieless with client
            storage disabled (<code>client_storage: &quot;none&quot;</code>) so it never sets a
            cookie or any other persistent identifier on your device, so visits cannot be linked
            together across pages or return visits.
          </>
        ) : (
          <>
            At present these events are not sent to any analytics service, and no cookies are used.
          </>
        )}{" "}
        If that changes, this page will be updated first.
      </p>

      <h2>What our servers receive</h2>
      <p>
        Like any website, the servers that deliver these pages receive standard technical request
        information, such as your IP address and browser type, to serve and protect the site. These
        requests never contain your files. The site also tells your browser not to send data to any
        other website from these pages.
      </p>

      <h2>Links to official sources</h2>
      <p>
        Requirement pages link to official notifications on exam bodies&rsquo; websites. Those links
        open the other website in a new tab, and its own privacy policy applies there.
      </p>

      <h2>How requirement values are checked</h2>
      <p>
        Each size, file-size, format and DPI value is read from the exam body&rsquo;s own published
        notification or guideline, not from memory or other websites. Every tool and guide page
        shows the source document, its version and the date it was last checked, with a link to the
        source so you can confirm it yourself. Where a value hasn&rsquo;t been checked against an
        official source, it is not shown as a requirement.
      </p>

      <h2>Contact</h2>
      {siteConfig.contactEmail ? (
        <p>
          Questions about this policy:{" "}
          <a href={`mailto:${siteConfig.contactEmail}`} className="font-medium underline">
            {siteConfig.contactEmail}
          </a>
          .
        </p>
      ) : (
        <p>A contact address for privacy questions will be published on this page.</p>
      )}
    </article>
  );
}
