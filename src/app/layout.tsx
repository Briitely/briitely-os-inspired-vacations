import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BrandingStyles } from "@/components/core/branding-styles";
import { ClientAddedTravellerHighlights } from "@/components/app/client-added-traveller-highlights";

const inter = Inter({ subsets: ["latin"] });

// Branding is stored in Supabase and can be changed from Admin at runtime.
// Re-read it instead of caching a build-time version of the client theme.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Briitely OS — Business Dashboard",
  description: "Internal business dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <BrandingStyles />
        <ClientAddedTravellerHighlights />
        {children}
      </body>
    </html>
  );
}
