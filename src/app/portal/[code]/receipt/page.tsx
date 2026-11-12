import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { hasPortalAccess } from "@/lib/portal-session";
import { getPublicSettings } from "@/lib/site-settings";
import { RECEIPT_SELECT, receiptFromRow } from "@/lib/receipt";
import { PrintButton } from "@/components/admin/PrintButton";
import { Receipt } from "@/components/admin/Receipt";

export const metadata = { title: "Receipt — The Gagrafa" };

export default async function PortalReceiptPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  if (!(await hasPortalAccess(code))) {
    redirect(`/portal?code=${encodeURIComponent(code)}&verify=1`);
  }

  const supabase = createServiceClient();
  const [{ data: row }, settings] = await Promise.all([
    supabase.from("bookings").select(RECEIPT_SELECT).eq("booking_code", code).maybeSingle(),
    getPublicSettings(),
  ]);
  if (!row) notFound();

  const { booking, payments } = receiptFromRow(row);

  return (
    <div className="container-gagrafa max-w-3xl py-10 sm:py-14 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/portal/${code}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-navy/60 hover:text-navy">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to your stay
        </Link>
        <PrintButton label="Print receipt" />
      </div>
      <Receipt booking={booking} payments={payments} settings={settings} />
    </div>
  );
}
