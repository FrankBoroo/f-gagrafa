"use client";

import { usePathname } from "next/navigation";
import { showsSiteChrome } from "@/lib/site-chrome";

// Wraps the public header or footer; renders nothing on admin pages.
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return showsSiteChrome(pathname ?? "") ? <>{children}</> : null;
}
