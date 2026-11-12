"use client";

import { Printer } from "lucide-react";

// Opens the browser's print dialog. Left off the printed page itself.
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary min-h-11 gap-2 px-5 py-2 text-xs print:hidden">
      <Printer className="h-4 w-4" aria-hidden="true" /> {label}
    </button>
  );
}
