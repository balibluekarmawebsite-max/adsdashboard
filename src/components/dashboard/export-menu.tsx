"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, FileSpreadsheet, Presentation, ChevronDown } from "lucide-react";
import { useFilters } from "@/components/providers/filters-provider";

// Export the CURRENT Overview view (property + platform + date range) as a
// branded PDF (print), a PowerPoint deck, or an Excel workbook.
export function ExportMenu() {
  const { from, to, platform, property } = useFilters();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function query(): string {
    const p = new URLSearchParams({ from, to });
    if (platform !== "all") p.set("platform", platform);
    if (property !== "all") p.set("property", property);
    return p.toString();
  }

  function openPdf() {
    window.open(`/report?${query()}`, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  function download(format: "xlsx" | "pptx") {
    const a = document.createElement("a");
    a.href = `/api/export?format=${format}&${query()}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border-border bg-card hover:bg-muted inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>

      {open && (
        <div className="border-border bg-popover absolute top-10 right-0 z-30 w-56 overflow-hidden rounded-md border shadow-lg">
          <MenuItem onClick={openPdf} icon={<FileText className="h-4 w-4" />} title="PDF report" hint="Opens print · Save as PDF" />
          <MenuItem onClick={() => download("pptx")} icon={<Presentation className="h-4 w-4" />} title="PowerPoint" hint=".pptx slide deck" />
          <MenuItem onClick={() => download("xlsx")} icon={<FileSpreadsheet className="h-4 w-4" />} title="Excel" hint=".xlsx workbook" />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  title,
  hint,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-muted flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">{hint}</span>
      </span>
    </button>
  );
}
