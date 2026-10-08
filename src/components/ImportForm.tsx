"use client";
import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import type { ApiEnvelope, ApiError, DatasetAnalysisResult } from "@/types/results";
import { DatasetDashboard } from "./DatasetDashboard";
import { InsufficientData } from "./ui";

export function ImportForm({ maxBytes, maxRows }: { maxBytes: number; maxRows: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<"" | "accounts" | "comments">("");
  const [populationSize, setPopulationSize] = useState("");
  const [totalComments, setTotalComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DatasetAnalysisResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > maxBytes) {
      setError(`File is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    if (type) fd.set("type", type);
    if (populationSize) fd.set("populationSize", populationSize);
    if (totalComments) fd.set("totalComments", totalComments);
    try {
      const res = await fetch("/api/analyze/dataset", { method: "POST", body: fd });
      const json = (await res.json()) as ApiEnvelope<DatasetAnalysisResult> | ApiError;
      if (!json.ok) {
        setError(`${json.error}${Array.isArray(json.details) ? `: ${(json.details as { reason?: string }[]).map((d) => d.reason).filter(Boolean).join("; ")}` : ""}`);
        setResult(null);
      } else setResult(json.result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="panel grid-bg space-y-4 p-5">
        <div>
          <label className="label">Dataset file (CSV or JSON)</label>
          <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-bg/60 p-6 text-sm text-muted hover:border-accent">
            <Upload size={16} /> {file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : `Choose a .csv or .json file (max ${Math.round(maxBytes / 1024 / 1024)} MB, ${maxRows.toLocaleString("en-US")} rows)`}
            <input type="file" accept=".csv,.json,.tsv,text/csv,application/json" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="type">Dataset type</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className="mt-1 w-full rounded-lg border border-line bg-bg/70 p-2 text-sm">
              <option value="">Auto-detect</option>
              <option value="accounts">Followers / accounts</option>
              <option value="comments">Comments / interactions</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="pop">Total followers (optional)</label>
            <input id="pop" inputMode="numeric" value={populationSize} onChange={(e) => setPopulationSize(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 48200" className="mt-1 w-full rounded-lg border border-line bg-bg/70 p-2 text-sm" />
          </div>
          <div>
            <label className="label" htmlFor="tc">Total comments (optional)</label>
            <input id="tc" inputMode="numeric" value={totalComments} onChange={(e) => setTotalComments(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 1240" className="mt-1 w-full rounded-lg border border-line bg-bg/70 p-2 text-sm" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Files are validated, sanitized and processed in memory only. Nothing is stored. Only upload data you are authorized to process.</p>
          <button type="submit" disabled={!file || loading} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Analyzing</span> : "ANALYZE DATASET"}</button>
        </div>
      </form>

      {error && <InsufficientData missing={[error]} hint="The dataset could not be analyzed:" />}
      {result && <DatasetDashboard r={result} />}

      <details className="panel p-4 text-sm">
        <summary className="cursor-pointer font-medium">Accepted formats</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <p className="label mb-1">Accounts CSV (followers / likers)</p>
            <pre className="mono overflow-auto rounded-md bg-bg/70 p-3 text-xs">{`username,followers,following,posts,has_profile_pic,bio,last_post_at,created_at
ana.travel,812,640,120,true,"Travel & food",2026-09-30,2019-03-01
user_8f3k2a91,3,5400,0,false,,,2026-09-20`}</pre>
            <p className="mt-1 text-xs text-muted">Only <b>username</b> is required. Column aliases are recognized (followers_count, follows, media_count, …).</p>
          </div>
          <div>
            <p className="label mb-1">Comments JSON</p>
            <pre className="mono overflow-auto rounded-md bg-bg/70 p-3 text-xs">{`{
  "type": "comments",
  "totalComments": 1240,
  "comments": [
    { "author": "ana.travel", "text": "Where was this filmed?", "timestamp": "2026-10-01T10:00:00Z",
      "followers": 812, "following": 640, "posts": 120 },
    { "author": { "username": "user_8f3k2a91", "followers": 3, "following": 5400, "posts": 0 },
      "text": "Nice pic check my page", "timestamp": 1759312800 }
  ]
}`}</pre>
            <p className="mt-1 text-xs text-muted">Accounts JSON: an array of rows, or {"{ \"followersTotal\": N, \"accounts\": [...] }"}.</p>
          </div>
        </div>
      </details>
    </div>
  );
}
