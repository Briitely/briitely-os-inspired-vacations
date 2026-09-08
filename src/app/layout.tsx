import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BrandingStyles } from "@/components/core/branding-styles";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Briitely OS — Business Dashboard",
  description: "Internal business dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <BrandingStyles />
        {children}
      </body>
    </html>
  );
}
