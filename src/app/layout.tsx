import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://exitcanary.vercel.app"),
  title: {
    default: "ExitCanary — Prove you can leave",
    template: "%s · ExitCanary",
  },
  description:
    "Test whether a SaaS export preserves the business data you need before you commit.",
  applicationName: "ExitCanary",
  keywords: [
    "SaaS exit",
    "data portability",
    "export verification",
    "vendor lock-in",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ExitCanary — Before you enter, prove you can leave.",
    description:
      "Seed a known canary dataset, export it, and get a deterministic exit-readiness receipt.",
    url: "/",
    type: "website",
    siteName: "ExitCanary",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
