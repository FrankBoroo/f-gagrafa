import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { hasPortalAccess } from "@/lib/portal-session";
import { getPublicSettings } from "@/lib/site-settings";
import { siteUrl } from "@/lib/env";
import { stayIcs } from "@/lib/portal/ics";

// A calendar file for the guest's own stay. Same access check as the portal page.
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });

  if (!(await hasPortalAccess(code))) return notFound();

  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("booking_code, check_in, check_out, status, units(name)")
    .eq("booking_code", code)
    .maybeSingle();
  if (!booking || booking.status === "cancelled" || booking.status === "no_show") return notFound();

  const settings = await getPublicSettings();
  const unit = booking.units as { name: string } | null;
  const body = stayIcs({
    code: booking.booking_code,
    unitName: unit?.name ?? "Apartment",
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    address: settings.address,
    portalUrl: `${siteUrl()}/portal/${booking.booking_code}`,
    now: new Date(),
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="gagrafa-${booking.booking_code}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
