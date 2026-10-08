"use client";
import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import type { AnalysisResult } from "@/types/results";

export function ReportButton({ result }: { result: AnalysisResult }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const [{ pdf }, { ReportDocument }] = await Promise.all([import("@react-pdf/renderer"), import("@/report/ReportDocument")]);
      const blob = await pdf(<ReportDocument r={result} />).toBlob();
      const name = result.kind === "profile" ? result.profile.username : result.kind === "post" ? result.post.id : "dataset";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `authenticity-report-${name}-${new Date(result.analyzedAt).toISOString().slice(0, 10)}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={download} disabled={busy} className="flex items-center gap-2 rounded-md border border-line bg-panel-2 px-3 py-1.5 text-sm hover:border-accent hover:text-accent disabled:opacity-50">
      {busy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Download PDF report
    </button>
  );
}
