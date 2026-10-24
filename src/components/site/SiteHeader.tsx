"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/units", label: "Residences" },
  { href: "/tour", label: "Tour" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/portal", label: "Guest Portal" },
];

// Past this many pixels the homepage header turns solid (DESIGN.md: about 80px).
const SOLID_AFTER = 80;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const overHero = pathname === "/";
  const transparent = overHero && !scrolled && !open;

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > SOLID_AFTER);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overHero]);

  // Full-screen mobile menu: close on navigation and Escape, and keep the page behind it still.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow,color] duration-500 ease-out ${
        transparent
          ? "border-transparent bg-transparent text-ivory"
          : // backdrop-blur would make the fixed full-screen menu size itself to the header, so drop it while open.
            `border-navy/10 text-navy ${open ? "bg-ivory" : "bg-ivory/90 backdrop-blur"} ${overHero ? "shadow-soft" : ""}`
      }`}
    >
      <div className="container-gagrafa flex h-20 items-center justify-between">
        <Link href="/" className="font-display text-2xl tracking-wide">
          The Gagrafa
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm transition-colors ${
                transparent ? "text-ivory/80 hover:text-ivory" : "text-navy/70 hover:text-navy"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {/* Over the hero the gold CTA is the hero's own; keep this one quiet until the header turns solid. */}
          <Link
            href="/booking"
            className={
              transparent
                ? "btn-secondary border-ivory/40 text-ivory hover:border-ivory/70 hover:bg-ivory/10"
                : "btn-primary"
            }
          >
            Book Your Stay
          </Link>
        </nav>

        <button
          className="-mr-2 flex h-11 w-11 items-center justify-center md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 bottom-0 top-20 overflow-y-auto border-t border-navy/10 bg-ivory md:hidden"
        >
          <nav className="container-gagrafa flex flex-col gap-1 py-8">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="border-b border-navy/5 py-4 font-display text-2xl text-navy"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <Link href="/booking" className="btn-primary mt-8 w-full py-4" onClick={() => setOpen(false)}>
              Book Your Stay
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
