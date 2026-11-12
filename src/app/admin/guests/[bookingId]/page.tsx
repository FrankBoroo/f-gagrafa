import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, Phone, Star } from "lucide-react";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { likeExact } from "@/lib/db-values";
import { telHref, whatsappHref } from "@/lib/contact-links";
import { roomLabel } from "@/lib/booking/room-assignment";
import { balanceOwed } from "@/lib/admin/today";
import { groupGuests, guestKey, netPaid } from "@/lib/admin/guests";
import { GuestNotesForm } from "@/components/admin/GuestNotesForm";

const STAY_SELECT =
  "id, booking_code, guest_name, guest_email, guest_phone, check_in, check_out, status, total_amount, currency, room_confirmed, units(name), rooms(number), payments(amount, status)";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  checked_in: "bg-sky-100 text-sky-700",
  checked_out: "bg-navy/10 text-navy/60",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
};

interface Stay {
  id: string;
  booking_code: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  status: string;
  total_amount: number;
  currency: string;
  net_paid: number;
  typeName: string;
  room: string | null;
}

// Rows from Supabase. The room is shown only once staff have confirmed it.
function toStay(b: any): Stay {
  return {
    id: b.id,
    booking_code: b.booking_code,
    guest_name: b.guest_name,
    guest_email: b.guest_email,
    guest_phone: b.guest_phone ?? "",
    check_in: b.check_in,
    check_out: b.check_out,
    status: b.status,
    total_amount: Number(b.total_amount),
    currency: b.currency ?? "GHS",
    net_paid: netPaid(b.payments),
    typeName: b.units?.name ?? "Apartment",
    room: b.room_confirmed && typeof b.rooms?.number === "number" ? roomLabel(b.rooms.number) : null,
  };
}

// A guest's record. The guest is addressed by one of their booking ids, so no email or
// phone number appears in the URL; every booking made with the same email is listed.
export default async function GuestRecordPage({ params }: { params: Promise<{ bookingId: string }> }) {
  if (!(await isStaff())) {
    return (
      <div>
        <h1 className="text-3xl">Guest</h1>
        <p className="mt-4 text-sm text-navy/50">Only staff can view guest records.</p>
      </div>
    );
  }

  const { bookingId } = await params;
  if (!z.string().uuid().safeParse(bookingId).success) notFound();

  const supabase = createServiceClient();
  const { data: anchor } = await supabase.from("bookings").select("guest_email").eq("id", bookingId).maybeSingle();
  const key = guestKey(anchor?.guest_email);
  if (!anchor || !key) notFound();

  const { data: rows } = await supabase
    .from("bookings")
    .select(STAY_SELECT)
    .ilike("guest_email", likeExact(anchor.guest_email.trim()))
    .order("check_in", { ascending: false })
    .limit(200);

  // PostgREST also reads * as a wildcard, so keep only rows whose email really is this guest's.
  const stays: Stay[] = (rows ?? []).map(toStay).filter((s: Stay) => guestKey(s.guest_email) === key);
  const [guest] = groupGuests(stays);
  if (!guest) notFound();

  const stayIds = stays.map((s: Stay) => s.id);
  const [{ data: noteRow }, { data: reviews }] = await Promise.all([
    supabase.from("guest_notes").select("notes, updated_at").eq("email", key).maybeSingle(),
    supabase
      .from("reviews")
      .select("id, rating, comment, created_at")
      .in("booking_id", stayIds)
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
  ]);

  const tel = telHref(guest.guest_phone);
  const whatsapp = whatsappHref(guest.guest_phone);

  return (
    <div>
      <Link href="/admin/guests" className="inline-flex min-h-11 items-center gap-2 text-sm text-navy/60 hover:text-navy">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All guests
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl">{guest.guest_name}</h1>
        {guest.isReturning && (
          <span className="rounded-full bg-champagne/20 px-3 py-1 text-xs text-navy/80">Returning guest</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`mailto:${encodeURIComponent(guest.guest_email)}`} className="btn-secondary min-h-11 gap-2 px-4 py-2 text-xs">
          <Mail className="h-4 w-4" aria-hidden="true" /> {guest.guest_email}
        </a>
        {tel && (
          <a href={tel} className="btn-secondary min-h-11 gap-2 px-4 py-2 text-xs">
            <Phone className="h-4 w-4" aria-hidden="true" /> {guest.guest_phone}
          </a>
        )}
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-secondary min-h-11 gap-2 px-4 py-2 text-xs">
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
          </a>
        )}
        {!tel && guest.guest_phone && <span className="self-center text-sm text-navy/60">{guest.guest_phone}</span>}
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <dt className="text-xs uppercase tracking-wide text-navy/50">Stays</dt>
          <dd className="mt-1 text-2xl text-navy">{guest.stays}</dd>
        </div>
        <div className="card p-5">
          <dt className="text-xs uppercase tracking-wide text-navy/50">Total paid</dt>
          <dd className="mt-1 text-2xl text-navy">{formatMoney(guest.totalPaid, guest.currency)}</dd>
        </div>
        <div className="card p-5">
          <dt className="text-xs uppercase tracking-wide text-navy/50">Last check-in</dt>
          <dd className="mt-1 text-2xl text-navy">{formatDate(guest.lastStay)}</dd>
        </div>
      </dl>

      <div className="mt-8 grid gap-8 xl:grid-cols-3">
        <section className="xl:col-span-2" aria-labelledby="guest-stays">
          <h2 id="guest-stays" className="text-xl">Bookings</h2>
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy/10 text-xs uppercase tracking-wide text-navy/50">
                <tr>
                  <th scope="col" className="px-5 py-3">Booking</th>
                  <th scope="col" className="px-5 py-3">Apartment type</th>
                  <th scope="col" className="px-5 py-3">Dates</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3">Paid</th>
                </tr>
              </thead>
              <tbody>
                {stays.map((s: Stay) => {
                  const closed = s.status === "cancelled" || s.status === "no_show";
                  const owed = closed ? 0 : balanceOwed(s);
                  return (
                    <tr key={s.id} className="border-b border-navy/5 last:border-0">
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/bookings?q=${encodeURIComponent(s.booking_code)}`}
                          className="text-navy underline decoration-champagne underline-offset-4 hover:decoration-navy"
                        >
                          {s.booking_code}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <p>{s.typeName}</p>
                        {s.room && <p className="text-navy/50">{s.room}</p>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        {formatDate(s.check_in)} – {formatDate(s.check_out)}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs capitalize ${statusColor[s.status] ?? "bg-navy/10 text-navy/60"}`}>
                          {s.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <p>{formatMoney(s.net_paid, s.currency)}</p>
                        {owed > 0 && <p className="text-xs text-amber-700">{formatMoney(owed, s.currency)} owed</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {reviews && reviews.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl">Published reviews</h2>
              <ul className="mt-4 grid gap-4">
                {reviews.map((r: { id: string; rating: number; comment: string | null; created_at: string }) => (
                  <li key={r.id} className="card p-5">
                    <p className="flex items-center gap-2 text-sm text-navy">
                      <Star className="h-4 w-4 text-champagne" aria-hidden="true" />
                      {r.rating} out of 5<span className="text-navy/50">· {formatDate(r.created_at)}</span>
                    </p>
                    {r.comment && <p className="mt-2 whitespace-pre-line break-words text-sm text-navy/70">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card h-fit p-5" aria-label="Staff notes">
          <GuestNotesForm
            key={noteRow?.updated_at ?? "new"}
            bookingId={bookingId}
            initialNotes={noteRow?.notes ?? ""}
            updatedAt={noteRow?.updated_at ?? null}
          />
        </section>
      </div>
    </div>
  );
}
