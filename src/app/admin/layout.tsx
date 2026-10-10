import Link from "next/link";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { getCurrentProfile } from "@/lib/auth";
import {
  LayoutDashboard, CalendarDays, Building2, Users,
  ClipboardList, CreditCard, Star, Settings, CalendarOff,
  BarChart3, Tag, ScrollText, LayoutGrid,
} from "lucide-react";

const nav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, adminOnly: false },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays, adminOnly: false },
  { href: "/admin/calendar", label: "Calendar", icon: LayoutGrid, adminOnly: false },
  { href: "/admin/units", label: "Units", icon: Building2, adminOnly: false },
  { href: "/admin/availability", label: "Availability", icon: CalendarOff, adminOnly: false },
  { href: "/admin/guests", label: "Guests", icon: Users, adminOnly: false },
  { href: "/admin/service-requests", label: "Service Requests", icon: ClipboardList, adminOnly: false },
  { href: "/admin/reviews", label: "Reviews", icon: Star, adminOnly: false },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, adminOnly: true },
  { href: "/admin/promo-codes", label: "Promo Codes", icon: Tag, adminOnly: true },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, adminOnly: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, adminOnly: true },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText, adminOnly: true },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const visibleNav = nav.filter((item) => !item.adminOnly || profile?.role === "admin");

  return (
    <div className="flex min-h-screen bg-sand">
      <aside className="hidden w-64 flex-col border-r border-navy/10 bg-navy px-5 py-8 text-ivory md:flex">
        <p className="font-display text-xl">The Gagrafa</p>
        <p className="mt-1 text-xs uppercase tracking-widest text-champagne">
          Admin {profile?.role === "staff" && "· Staff"}
        </p>
        <nav className="mt-10 flex flex-col gap-1">
          {visibleNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ivory/70 transition-colors hover:bg-ivory/10 hover:text-ivory"
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <SignOutButton />
      </aside>
      <main className="flex-1 px-6 py-10 md:px-10">{children}</main>
    </div>
  );
}
