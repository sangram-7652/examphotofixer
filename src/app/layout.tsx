import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import { AnalyticsRoot } from "@/components/AnalyticsRoot";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { siteConfig } from "@/config/site";
import "./globals.css";

// Self-hosted at build time by next/font: no requests to Google at runtime (CSP font-src 'self').
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });
const display = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["600", "700"],
});
const spec = IBM_Plex_Mono({
  variable: "--font-spec",
  subsets: ["latin"],
  weight: ["500"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} – ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  robots: siteConfig.indexable ? { index: true, follow: true } : { index: false, follow: false },
  // Search Console HTML-tag verification; the token lives in the deployment env, never in git.
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${body.variable} ${display.variable} ${spec.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <AnalyticsRoot />
      </body>
    </html>
  );
}
