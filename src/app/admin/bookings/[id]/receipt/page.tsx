import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth";
import { getPublicSettings } from "@/lib/site-settings";
import { RECEIPT_SELECT, receiptFromRow } from "@/lib/receipt";
import { PrintButton } from "@/components/admin/PrintButton";
import { Receipt } from "@/components/admin/Receipt";

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
    supabase.from("bookings").select(RECEIPT_SELECT).eq("id", id).maybeSingle(),
    getPublicSettings(),
  ]);
  if (!booking) notFound();

  const { booking: receiptBooking, payments } = receiptFromRow(booking);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/admin/bookings?q=${encodeURIComponent(receiptBooking.booking_code)}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-navy/60 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the booking
        </Link>
        <PrintButton label="Print receipt" />
      </div>
      <Receipt
        booking={receiptBooking}
        payments={payments}
        settings={settings}
      />
    </div>
  );
}
