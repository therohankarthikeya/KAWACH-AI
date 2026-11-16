import type { Metadata } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-code",
});

export const metadata: Metadata = {
  title: "KAWACH",
  description:
    "Check where your photos appear online using a live selfie. Nothing is saved to disk.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${outfit.variable} ${mono.variable} min-h-screen bg-[#060a10] text-slate-100 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}