import { NextResponse, type NextRequest } from "next/server";
import { normalizeCode } from "@/lib/auth/codes";
import { findLeagueIdByLeagueCode } from "@/lib/auth/secrets";
import { LEAGUE_COOKIE_NAME, drafterCookieOptions } from "@/lib/auth/drafter";

// A drafter's shareable link: /join/enter?code=XXXXXX
//
// A route handler rather than a page, for the same reason /commish/enter
// is one: setting a cookie is only allowed from a route handler or a
// server action, never from a server component. The first attempt at this
// called startLeagueSession() during a page render, which silently did
// nothing and left the link landing on the code form.
//
// A code in a link beats whatever the browser last used, so sending this
// round always puts twelve people in the same draft - and saves them all
// typing six characters correctly.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("code") ?? "";
  const code = normalizeCode(raw);
  const leagueId = code ? await findLeagueIdByLeagueCode(code) : null;

  // An unknown code falls through to the form rather than erroring - the
  // likeliest cause is a mistyped link, and the form is where that gets
  // fixed.
  if (!leagueId) {
    return NextResponse.redirect(new URL("/join", request.url));
  }

  const response = NextResponse.redirect(new URL("/join", request.url));
  response.cookies.set(LEAGUE_COOKIE_NAME, code, drafterCookieOptions());
  return response;
}
