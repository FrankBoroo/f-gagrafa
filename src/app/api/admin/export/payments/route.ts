import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data: payments } = await supabase
    .from("payments")
    .select("*, bookings(booking_code, guest_name)")
    .order("created_at", { ascending: false });

  const csv = toCsv(
    (payments ?? []).map((p: any) => ({
      ...p,
      booking_code: p.bookings?.booking_code ?? "",
      guest_name: p.bookings?.guest_name ?? "",
    })),
    [
      { key: "booking_code", label: "Booking Code" },
      { key: "guest_name", label: "Guest Name" },
      { key: "method", label: "Method" },
      { key: "amount", label: "Amount" },
      { key: "currency", label: "Currency" },
      { key: "status", label: "Status" },
      { key: "paystack_reference", label: "Reference" },
      { key: "paid_at", label: "Paid At" },
      { key: "created_at", label: "Created At" },
    ]
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="gagrafa-payments-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
