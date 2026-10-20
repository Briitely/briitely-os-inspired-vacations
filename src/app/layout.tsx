import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BrandingStyles } from "@/components/core/branding-styles";
import { getBrandingSettings } from "@/lib/briitely/client-settings";

const inter = Inter({ subsets: ["latin"] });

// Branding is stored in Supabase and can be changed from Admin at runtime.
// Re-read it instead of caching a build-time version of the client theme.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// The browser-tab icon comes from Admin → Business → Branding.
export async function generateMetadata(): Promise<Metadata> {
  const metadata: Metadata = {
    title: "Briitely OS — Business Dashboard",
    description: "Internal business dashboard",
  };
  try {
    const { faviconUrl } = await getBrandingSettings();
    if (faviconUrl) metadata.icons = { icon: faviconUrl, shortcut: faviconUrl, apple: faviconUrl };
  } catch {
    // Branding unavailable: keep the default icon.
  }
  return metadata;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <BrandingStyles />
        {children}
      </body>
    </html>
  );
}
