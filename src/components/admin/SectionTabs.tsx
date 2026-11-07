"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeTabHref, sectionFor, visibleSections } from "@/lib/admin/nav";

// The pages of the current admin section, as tabs above the page. Nothing for a
// section without tabs (Today, Inbox).
export function SectionTabs({ role }: { role?: string }) {
  const pathname = usePathname();
  const current = sectionFor(pathname);
  const section = visibleSections(role).find((s) => s.key === current?.key);
  if (!section || section.tabs.length < 2) return null;
  const active = activeTabHref(pathname, section);

  return (
    <nav aria-label={`${section.label} pages`} className="-mx-4 mb-6 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1 border-b border-navy/10">
        {section.tabs.map((t) => {
          const isActive = t.href === active;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm transition-colors ${
                  isActive ? "border-champagne text-navy" : "border-transparent text-navy/60 hover:text-navy"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
