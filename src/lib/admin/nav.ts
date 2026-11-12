// The admin menu: seven sections, each showing its pages as tabs. Pure data, safe in
// client code. Pages still check isStaff() / isAdmin() themselves; this only decides
// what the menu shows.

export type AdminSectionKey = "today" | "bookings" | "guests" | "inbox" | "apartments" | "money" | "settings";

export interface AdminTab {
  href: string;
  label: string;
  adminOnly: boolean;
}

export interface AdminSection {
  key: AdminSectionKey;
  label: string;
  href: string;
  adminOnly: boolean;
  tabs: AdminTab[];
  // Older addresses that belong to this section but aren't tabs (they redirect).
  alsoOwns?: string[];
}

const tab = (href: string, label: string, adminOnly = false): AdminTab => ({ href, label, adminOnly });

export const ADMIN_SECTIONS: AdminSection[] = [
  { key: "today", label: "Today", href: "/admin", adminOnly: false, tabs: [] },
  {
    key: "bookings", label: "Bookings", href: "/admin/bookings", adminOnly: false,
    tabs: [
      tab("/admin/bookings", "List"),
      tab("/admin/calendar", "Calendar"),
      tab("/admin/availability", "Blocked dates"),
      tab("/admin/bookings/new", "New booking"),
    ],
  },
  {
    key: "guests", label: "Guests", href: "/admin/guests", adminOnly: false,
    tabs: [tab("/admin/guests", "Guests"), tab("/admin/reviews", "Reviews")],
  },
  { key: "inbox", label: "Inbox", href: "/admin/inbox", adminOnly: false, tabs: [], alsoOwns: ["/admin/service-requests"] },
  {
    key: "apartments", label: "Apartments", href: "/admin/units", adminOnly: false,
    tabs: [
      tab("/admin/units", "Types"),
      tab("/admin/rooms", "Rooms"),
      tab("/admin/special-prices", "Special prices"),
      tab("/admin/tour", "Tour photos"),
    ],
  },
  {
    key: "money", label: "Money", href: "/admin/money", adminOnly: true,
    tabs: [tab("/admin/money", "Overview", true), tab("/admin/payments", "Payments", true), tab("/admin/reports", "Reports", true)],
  },
  {
    key: "settings", label: "Settings", href: "/admin/settings", adminOnly: true,
    tabs: [
      tab("/admin/settings", "Property", true),
      tab("/admin/promo-codes", "Promo codes", true),
      tab("/admin/team", "Team", true),
      tab("/admin/audit-log", "Audit log", true),
    ],
  },
];

function matches(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

// The section a page belongs to: the longest matching address wins, so
// /admin/bookings/new is the "New booking" tab, not just "Bookings".
export function sectionFor(pathname: string): AdminSection | null {
  let best: { section: AdminSection; length: number } | null = null;
  for (const section of ADMIN_SECTIONS) {
    const hrefs = [section.href, ...section.tabs.map((t) => t.href), ...(section.alsoOwns ?? [])];
    for (const href of hrefs) {
      if (matches(pathname, href) && (!best || href.length > best.length)) best = { section, length: href.length };
    }
  }
  return best?.section ?? null;
}

// The tab a page belongs to within its section (longest match), or null.
export function activeTabHref(pathname: string, section: AdminSection): string | null {
  const hit = section.tabs
    .filter((t) => matches(pathname, t.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return hit?.href ?? null;
}

export function visibleSections(role: string | null | undefined): AdminSection[] {
  if (role === "admin") return ADMIN_SECTIONS;
  if (role !== "staff") return [];
  return ADMIN_SECTIONS.filter((s) => !s.adminOnly).map((s) => ({ ...s, tabs: s.tabs.filter((t) => !t.adminOnly) }));
}
