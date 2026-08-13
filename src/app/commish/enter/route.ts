import { NextResponse, type NextRequest } from "next/server";
import { normalizeCode } from "@/lib/auth/codes";
import {
  COMMISSIONER_COOKIE_NAME,
  commissionerCookieOptions,
  verifyCommissionerSecret,
} from "@/lib/auth/commissioner";

// The commissioner's bookmarkable link: /commish/enter?secret=XXXX
//
// This is a route handler rather than a page because setting a cookie is
// only allowed from a route handler or a server action - never from a
// server component. It swaps the secret for a cookie and redirects
// straight to the board, so the secret does not linger in the address bar
// (or in the browser history entry for the board itself).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("secret") ?? "";
  const secret = normalizeCode(raw);
  const league = await verifyCommissionerSecret(secret);

  if (!league) {
    const failed = new URL("/commish/login", request.url);
    failed.searchParams.set("error", "invalid");
    return NextResponse.redirect(failed);
  }

  const response = NextResponse.redirect(new URL("/commish/board", request.url));
  response.cookies.set(
    COMMISSIONER_COOKIE_NAME,
    secret,
    commissionerCookieOptions()
  );
  return response;
}
