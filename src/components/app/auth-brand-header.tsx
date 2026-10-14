import { getBrandingSettings, getBusinessSettings } from "@/lib/briitely/client-settings";

export async function AuthBrandHeader() {
  const [branding, business] = await Promise.all([
    getBrandingSettings(),
    getBusinessSettings(),
  ]);

  return (
    <div className="text-center">
      {branding.logoUrl ? (
        <img
          src={branding.logoUrl}
          alt={`${business.businessName} logo`}
          className="mx-auto max-h-24 max-w-[260px] object-contain"
        />
      ) : (
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {business.businessName}
        </h1>
      )}
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {business.businessName} · Team Dashboard
      </p>
    </div>
  );
}
