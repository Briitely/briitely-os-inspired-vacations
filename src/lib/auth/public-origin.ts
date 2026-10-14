import "server-only";

function normalizeConfiguredUrl(value:string|undefined|null){
  const raw=(value||"").trim();
  if(!raw) return "";
  try{
    return new URL(raw.startsWith("http")?raw:`https://${raw}`).origin;
  }catch{
    return "";
  }
}

export function getPublicAppOrigin(request:Request){
  // On Vercel production, always prefer the stable project production URL.
  // request.url / x-forwarded-host can resolve to the immutable deployment
  // hostname, which disappears from old auth emails after a new deployment.
  if(process.env.VERCEL_ENV==="production"){
    const production=normalizeConfiguredUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
    if(production) return production;

    const configured=normalizeConfiguredUrl(process.env.NEXT_PUBLIC_APP_URL);
    if(configured) return configured;
  }

  // In previews, preserve the preview hostname the user is actually testing.
  const forwardedHost=(request.headers.get("x-forwarded-host")||"").split(",")[0].trim();
  const host=forwardedHost || (request.headers.get("host")||"").trim();
  const forwardedProto=(request.headers.get("x-forwarded-proto")||"").split(",")[0].trim();
  const proto=forwardedProto || "https";

  if(host){
    try{
      return new URL(`${proto}://${host}`).origin;
    }catch{}
  }

  const configured=normalizeConfiguredUrl(process.env.NEXT_PUBLIC_APP_URL);
  if(configured) return configured;

  const production=normalizeConfiguredUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if(production) return production;

  const vercel=normalizeConfiguredUrl(process.env.VERCEL_URL);
  if(vercel) return vercel;

  return new URL(request.url).origin;
}
