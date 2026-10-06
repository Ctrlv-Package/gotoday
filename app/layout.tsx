import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

// Google Analytics (GA4). Only on the live site, so local testing doesn't count as visits.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-2DYKZBZFG9";
const LIVE = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";

// Canonical site address: shared links and preview images resolve against it.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mygotoday.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "GoToday — Find something worth doing near you",
  description: "Free and local things happening near you — library storytimes, park concerts, festivals, markets and more.",
  alternates: { canonical: "/" },
  openGraph: { siteName: "GoToday", type: "website", url: SITE, title: "GoToday", description: "Find something worth doing near you." }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        {LIVE && GA_ID && <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}</Script>
        </>}
      </body>
    </html>
  );
}
