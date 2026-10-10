"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/units", label: "Residences" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/portal", label: "Guest Portal" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-ivory/90 backdrop-blur">
      <div className="container-gagrafa flex h-20 items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-wide text-navy">
          The Gagrafa
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-navy/70 transition-colors hover:text-navy">
              {l.label}
            </Link>
          ))}
          <Link href="/booking" className="btn-primary">
            Book Your Stay
          </Link>
        </nav>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-navy/10 bg-ivory md:hidden">
          <div className="container-gagrafa flex flex-col gap-1 py-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-2 py-3 text-navy/80"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <Link href="/booking" className="btn-primary mt-2 w-full" onClick={() => setOpen(false)}>
              Book Your Stay
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
