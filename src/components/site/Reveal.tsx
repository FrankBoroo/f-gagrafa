"use client";

import { useEffect, useRef, useState } from "react";

// Fades its content up once, the first time it scrolls into view (DESIGN.md motion rules).
// Content is visible without JavaScript and with reduced motion: the hidden state is only
// applied after mount, and `motion-reduce` skips the transition.
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number; // ms, for staggering siblings
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "hidden" | "shown">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Already on screen at load: leave it alone rather than flashing it out and back in.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    setState("hidden");
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        if (entries.some((e: IntersectionObserverEntry) => e.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={state === "shown" && delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`${state === "hidden" ? "translate-y-5 opacity-0" : "translate-y-0 opacity-100"} ${
        state === "static" ? "" : "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none"
      } ${className}`}
    >
      {children}
    </div>
  );
}
