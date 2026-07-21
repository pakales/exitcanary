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
  authors: [{ name: "EV1 Labs", url: "https://ev1labs.com/" }],
  creator: "EV1 Labs",
  publisher: "EV1 Labs",
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
    images: [
      {
        url: "/exitcanary-og.png",
        width: 1200,
        height: 630,
        alt: "ExitCanary — before you enter, prove you can leave",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ExitCanary — Before you enter, prove you can leave.",
    description:
      "A pre-purchase exit drill for SaaS data with a deterministic readiness verdict.",
    images: ["/exitcanary-og.png"],
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
