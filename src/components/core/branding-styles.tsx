import { getBrandingSettings, hexToHsl } from "@/lib/briitely/client-settings";

export async function BrandingStyles() {
  const branding = await getBrandingSettings();
  const primaryHsl = hexToHsl(branding.primaryColor);

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root{--primary:${primaryHsl};--ring:${primaryHsl};}`,
      }}
    />
  );
}
