import type { Metadata } from "next";
import {
  Inter,
  JetBrains_Mono,
  Space_Grotesk,
  Instrument_Serif,
} from "next/font/google";
import { Providers } from "@/app/providers";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const serifAccent = Instrument_Serif({
  variable: "--font-serif",
  style: ["italic"],
  weight: ["400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Absolute base so file-convention og:image unfurls with a full URL.
  ...(process.env.NEXT_PUBLIC_SITE_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) }
    : {}),
  title: "Fathom — Know the Wallet Before You Trust It",
  description:
    "Fathom turns wallet history, economic relationships, behavioral signals, and attestations into verifiable trust evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable} ${serifAccent.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
