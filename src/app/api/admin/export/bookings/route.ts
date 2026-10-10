import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export async function GET() {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, units(name)")
    .order("created_at", { ascending: false });

  const csv = toCsv(
    (bookings ?? []).map((b: any) => ({ ...b, unit_name: b.units?.name ?? "" })),
    [
      { key: "booking_code", label: "Booking Code" },
      { key: "guest_name", label: "Guest Name" },
      { key: "guest_email", label: "Guest Email" },
      { key: "guest_phone", label: "Guest Phone" },
      { key: "unit_name", label: "Residence" },
      { key: "check_in", label: "Check-in" },
      { key: "check_out", label: "Check-out" },
      { key: "nights", label: "Nights" },
      { key: "adults", label: "Adults" },
      { key: "children", label: "Children" },
      { key: "total_amount", label: "Total Amount" },
      { key: "currency", label: "Currency" },
      { key: "status", label: "Status" },
      { key: "payment_status", label: "Payment Status" },
      { key: "promo_code", label: "Promo Code" },
      { key: "discount_amount", label: "Discount" },
      { key: "created_at", label: "Created At" },
    ]
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="gagrafa-bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
