import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth";
import { getPublicSettings } from "@/lib/site-settings";
import { roomLabel } from "@/lib/booking/room-assignment";
import { PrintButton } from "@/components/admin/PrintButton";
import { Receipt, type ReceiptPayment } from "@/components/admin/Receipt";

export const metadata = { title: "Receipt — The Gagrafa" };

export default async function BookingReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isStaff())) {
    return (
      <div>
        <h1 className="text-3xl">Receipt</h1>
        <p className="mt-4 text-sm text-navy/50">Only staff can view receipts.</p>
      </div>
    );
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const supabase = createServiceClient();
  const [{ data: booking }, settings] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, booking_code, guest_name, check_in, check_out, status, total_amount, currency, room_confirmed, units(name), rooms(number), payments(id, amount, status, method, paid_at, created_at)"
      )
      .eq("id", id)
      .maybeSingle(),
    getPublicSettings(),
  ]);
  if (!booking) notFound();

  const b: any = booking;
  const payments: ReceiptPayment[] = (b.payments ?? [])
    .map((p: any) => ({
      id: p.id,
      date: p.paid_at ?? p.created_at ?? null,
      method: p.method,
      amount: Number(p.amount),
      status: p.status,
    }))
    .sort((x: ReceiptPayment, y: ReceiptPayment) => (x.date ?? "").localeCompare(y.date ?? ""));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/admin/bookings?q=${encodeURIComponent(b.booking_code)}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-navy/60 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the booking
        </Link>
        <PrintButton label="Print receipt" />
      </div>
      <Receipt
        booking={{
          booking_code: b.booking_code,
          guest_name: b.guest_name,
          unit_name: b.units?.name ?? "Apartment",
          room: b.room_confirmed && typeof b.rooms?.number === "number" ? roomLabel(b.rooms.number) : null,
          check_in: b.check_in,
          check_out: b.check_out,
          total_amount: Number(b.total_amount),
          currency: b.currency ?? "GHS",
          status: b.status,
        }}
        payments={payments}
        settings={settings}
      />
    </div>
  );
}
