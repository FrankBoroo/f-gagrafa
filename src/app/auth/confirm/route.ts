import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = ["invite", "recovery", "magiclink", "email"] as const;
type OtpType = (typeof OTP_TYPES)[number];

// Where invite / sign-in links land. We exchange the one-time token for a real session
// (cookies) on the server, then send the person to choose their password.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (!tokenHash || !type || !OTP_TYPES.includes(type as OtpType)) {
    redirect("/login?error=invalid-link");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: type as OtpType, token_hash: tokenHash });
  if (error) redirect("/login?error=link-expired");

  redirect("/auth/set-password");
}
