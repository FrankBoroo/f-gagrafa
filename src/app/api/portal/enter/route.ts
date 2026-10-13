import { NextRequest, NextResponse } from "next/server";
import {
  verifyPortalToken, createPortalToken, portalCookieName, portalCookieOptions,
} from "@/lib/portal-session";

// Target of the links in our emails. A valid signed token means the guest got it
// from their own inbox, so we set the portal cookie and send them straight in.
export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  const token = req.nextUrl.searchParams.get("t");

  if (!code || !verifyPortalToken(token, code)) {
    return NextResponse.redirect(new URL(`/portal?code=${encodeURIComponent(code)}&verify=1`, req.url));
  }

  const response = NextResponse.redirect(new URL(`/portal/${encodeURIComponent(code)}`, req.url));
  response.cookies.set(portalCookieName(code), createPortalToken(code), portalCookieOptions());
  return response;
}
