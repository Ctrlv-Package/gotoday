import "./globals.css";
import type { Metadata } from "next";

// Canonical site address: shared links and preview images resolve against it.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://mygotoday.com";

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
      <body>{children}</body>
    </html>
  );
}
