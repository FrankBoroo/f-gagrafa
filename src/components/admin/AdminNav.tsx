"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, CalendarDays, Users, Inbox, Building2, Wallet, Settings, Menu, X, type LucideIcon } from "lucide-react";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { sectionFor, visibleSections, type AdminSectionKey } from "@/lib/admin/nav";

const ICONS: Record<AdminSectionKey, LucideIcon> = {
  today: Sun,
  bookings: CalendarDays,
  guests: Users,
  inbox: Inbox,
  apartments: Building2,
  money: Wallet,
  settings: Settings,
};

// Renders both navigations: the fixed sidebar on tablet/desktop and, on phones,
// a top bar with a menu button that opens a slide-in drawer.
export function AdminNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sections = visibleSections(role);
  const activeKey = sectionFor(pathname)?.key;
  const roleLabel = role === "staff" ? "Admin · Staff" : "Admin";

  // Close the drawer after navigating.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While open: lock page scroll and let Escape close it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links = (
    <nav className="flex flex-col gap-1">
      {sections.map(({ key, href, label }) => {
        const Icon = ICONS[key];
        const active = key === activeKey;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-ivory/10 hover:text-ivory ${
              active ? "bg-ivory/10 text-ivory" : "text-ivory/70"
            }`}
          >
            <Icon size={17} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Tablet / desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-navy/10 bg-navy px-5 py-8 text-ivory md:flex">
        <p className="font-display text-xl">The Gagrafa</p>
        <p className="mt-1 text-xs uppercase tracking-widest text-champagne">{roleLabel}</p>
        <div className="mt-10">{links}</div>
        <SignOutButton />
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-navy px-4 py-3 text-ivory md:hidden">
        <div>
          <p className="font-display text-lg leading-tight">The Gagrafa</p>
          <p className="text-[10px] uppercase tracking-widest text-champagne">{roleLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          aria-expanded={open}
          aria-controls="admin-mobile-menu"
          className="rounded-lg p-2 hover:bg-ivory/10"
        >
          <Menu size={24} />
        </button>
      </header>

      {/* Phone drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" id="admin-mobile-menu" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-navy/60"
          />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col overflow-y-auto bg-navy px-5 py-6 text-ivory shadow-soft">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <p className="font-display text-xl">The Gagrafa</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-champagne">{roleLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close admin menu"
                className="rounded-lg p-2 hover:bg-ivory/10"
              >
                <X size={22} />
              </button>
            </div>
            {links}
            <div className="mt-auto pt-6">
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
