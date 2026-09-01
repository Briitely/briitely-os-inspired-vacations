import { getBrandingSettings, hexToHsl } from "@/lib/briitely/client-settings";

export async function BrandingStyles() {
  const branding = await getBrandingSettings();
  const primaryHsl = hexToHsl(branding.primaryColor);
  const secondaryHsl = hexToHsl(branding.secondaryColor);
  const accentHsl = hexToHsl(branding.accentColor);

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root{
          --brand-primary:${branding.primaryColor};
          --brand-secondary:${branding.secondaryColor};
          --brand-accent:${branding.accentColor};
          --primary:${primaryHsl};
          --primary-foreground:0 0% 100%;
          --secondary:${secondaryHsl};
          --secondary-foreground:0 0% 100%;
          --accent:${accentHsl};
          --ring:${primaryHsl};
          --brand-soft:color-mix(in srgb,var(--brand-accent) 18%,#fff);
          --brand-canvas:color-mix(in srgb,var(--brand-accent) 10%,#fff);
          --brand-border:color-mix(in srgb,var(--brand-primary) 18%,#ddd);
        }`,
      }}
    />
  );
}
