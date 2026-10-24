"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Pages that already put booking front and centre, or aren't for browsing guests.
const HIDDEN_ON = ["/booking", "/admin", "/portal", "/login", "/auth"];

// "Book Your Stay" pinned to the bottom of the screen on phones, where the header has no room
// for it (DESIGN.md section 11). Appears once the first screen is scrolled past and steps aside
// while anything marked `data-hide-floating-book` (booking widget, footer) is in view.
export function FloatingBookButton() {
  const pathname = usePathname();
  const hiddenHere = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [pastFirstScreen, setPastFirstScreen] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (hiddenHere) return;
    const onScroll = () => setPastFirstScreen(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const inView = new Set<Element>();
    const observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
      for (const e of entries) {
        if (e.isIntersecting) inView.add(e.target);
        else inView.delete(e.target);
      }
      setBlocked(inView.size > 0);
    });
    document.querySelectorAll("[data-hide-floating-book]").forEach((el: Element) => observer.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      setBlocked(false);
    };
  }, [hiddenHere, pathname]);

  if (hiddenHere) return null;
  const shown = pastFirstScreen && !blocked;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none md:hidden ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <Link href="/booking" tabIndex={shown ? 0 : -1} aria-hidden={!shown} className="btn-gold w-full py-4 shadow-soft">
        Book Your Stay
      </Link>
    </div>
  );
}
