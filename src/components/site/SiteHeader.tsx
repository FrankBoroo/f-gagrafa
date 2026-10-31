"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/site/Logo";

const links = [
  { href: "/units", label: "Apartments" },
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

  // Full-screen menu: close on navigation and Escape, and keep the page behind it still.
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
            `border-sand text-navy ${open ? "bg-ivory" : "bg-ivory/90 backdrop-blur"} ${overHero ? "shadow-soft" : ""}`
      }`}
    >
      <div className="container-gagrafa grid h-20 grid-cols-[1fr_auto_1fr] items-center">
        <button
          className="-ml-2 flex h-11 items-center gap-2 justify-self-start px-2 text-[0.7rem] uppercase tracking-[0.2em]"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
          <span className="hidden sm:inline" aria-hidden="true">Menu</span>
        </button>

        <Link href="/" aria-label="The Gagrafa home" className="flex h-11 items-center">
          <Logo className="h-11 w-auto" />
        </Link>

        <Link href="/booking" className="btn-gold justify-self-end px-5">
          Book
        </Link>
      </div>

      {open && (
        <div id="site-menu" className="fixed inset-x-0 bottom-0 top-20 overflow-y-auto bg-ivory">
          <nav className="container-gagrafa flex max-w-2xl flex-col gap-1 py-10 md:py-16">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="border-b border-sand py-5 font-display text-3xl text-navy transition-colors hover:text-champagne-ink md:text-4xl"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <p className="eyebrow mt-10">Community 20 · Tema</p>
          </nav>
        </div>
      )}
    </header>
  );
}
