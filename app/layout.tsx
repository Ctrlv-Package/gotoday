import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GoToday",
  description: "Find something worth doing near you."
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
