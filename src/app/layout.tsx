import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4F46E5",
};

export const metadata: Metadata = {
  title: "Ticvite — Free Event Ticketing & Management",
  description:
    "Ticvite is the free ticketing platform that lets you create, manage, and sell event tickets with zero platform fees. Beautiful event pages, instant check-in, and powerful analytics — all at no cost.",
  keywords: [
    "event ticketing",
    "free ticketing platform",
    "event management",
    "sell tickets online",
    "zero platform fees",
    "Ticvite",
  ],
  authors: [{ name: "Ticvite" }],
  creator: "Ticvite",
  metadataBase: new URL("https://ticvite.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://ticvite.com",
    siteName: "Ticvite",
    title: "Ticvite — Free Event Ticketing & Management",
    description:
      "Create, manage, and sell event tickets with zero platform fees. Beautiful event pages, instant check-in, and powerful analytics.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ticvite — Your Event. Your Tickets. Zero Platform Fees.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ticvite — Free Event Ticketing & Management",
    description:
      "Create, manage, and sell event tickets with zero platform fees.",
    images: ["/og-image.png"],
    creator: "@ticvite",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
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
    <html lang="en">
      <body className="font-body antialiased bg-surface-muted text-text">
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
