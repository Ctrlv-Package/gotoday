import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {getLang} from "../lib/lang-server";
import {LangProvider} from "./components/Lang";
import NavTracker from "./components/NavTracker";
import PwaRegister from "./components/PwaRegister";
import InstallPrompt from "./components/InstallPrompt";

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
  openGraph: { siteName: "GoToday", type: "website", url: SITE, title: "GoToday", description: "Find something worth doing near you." },
  // Installed-app presentation (the manifest itself is served by app/manifest.ts).
  appleWebApp: { capable: true, title: "GoToday", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = { themeColor: "#7c3aed" };

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body>
        <LangProvider lang={lang}>{children}</LangProvider>
        <NavTracker/>
        <PwaRegister/>
        <InstallPrompt/>
        {LIVE && GA_ID && <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}</Script>
        </>}
      </body>
    </html>
  );
}
