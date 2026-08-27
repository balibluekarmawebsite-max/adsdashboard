"use client";

import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";

// Sticky toolbar for the print/PDF report. Hidden when actually printing. Opens
// the browser's print dialog once on load (Save as PDF), and offers a manual
// button in case the dialog is dismissed.
export function PrintBar() {
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        /* ignore — the button is always available */
      }
    }, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#e2eaee] bg-white/95 px-5 py-3 backdrop-blur">
      <a
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5B7280] hover:text-[#12333F]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-md bg-[#005A7C] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#004660]"
      >
        <Printer className="h-4 w-4" />
        Save as PDF / Print
      </button>
    </div>
  );
}
