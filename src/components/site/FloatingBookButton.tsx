"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Pages that already put booking front and centre, or aren't for browsing guests.
const HIDDEN_ON = ["/booking", "/admin", "/portal", "/login", "/auth"];

const ROUND = "flex h-14 w-14 items-center justify-center rounded-full bg-navy text-[0.6rem] uppercase tracking-[0.1em] text-ivory shadow-soft transition-colors hover:bg-navy-light";

// Round Book and Call buttons in the bottom corner. They appear once the first screen is scrolled
// past and step aside while anything marked `data-hide-floating-book` (booking panel, footer) is in view.
export function FloatingBookButton({ phone }: { phone: string | null }) {
  const pathname = usePathname();
  const hiddenHere = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const bookHref = pathname.startsWith("/units/") ? "#reserve" : "/booking";
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
      className={`fixed bottom-0 right-0 z-30 flex gap-2 pb-[max(1rem,env(safe-area-inset-bottom))] pr-4 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <Link href={bookHref} tabIndex={shown ? 0 : -1} aria-hidden={!shown} className={ROUND}>
        Book
      </Link>
      {phone && (
        <a href={phone} tabIndex={shown ? 0 : -1} aria-hidden={!shown} className={ROUND}>
          Call
        </a>
      )}
    </div>
  );
}
