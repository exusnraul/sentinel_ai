import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sentinel AI | Privacy-First DLP Security Platform",
  description:
    "Enterprise-grade Data Loss Prevention powered by local AI. 100% private, zero cloud, real-time threat detection for the GenAI era.",
  keywords: [
    "DLP",
    "data loss prevention",
    "AI security",
    "privacy",
    "local AI",
    "sentinel",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
