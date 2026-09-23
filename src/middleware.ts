import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Only authenticated areas need session refresh; public pages stay fast.
export const config = {
  matcher: ["/judge/:path*", "/admin/:path*", "/login"],
};
