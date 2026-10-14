import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/integrations/briitely/travel-inquiry") || request.nextUrl.pathname.startsWith("/api/integrations/briitely/consultation-booked")) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api/integrations/briitely/travel-inquiry|api/integrations/briitely/consultation-booked|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
  ],
};
