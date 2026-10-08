"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";
import type { ApiEnvelope, ApiError, ProfileAnalysisResult, PostAnalysisResult } from "@/types/results";
import { parseAnalyzeInput } from "@/utils/parseInput";
import { ProfileDashboard } from "./ProfileDashboard";
import { PostDashboard } from "./PostDashboard";
import { InsufficientData } from "./ui";

type Result = ProfileAnalysisResult | PostAnalysisResult;

export function AnalyzeForm({ demoUsernames }: { demoUsernames: string[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q");
  const [value, setValue] = useState(q ?? "");
  // Adjust input state during render when the URL query changes (React-recommended pattern).
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    if (q) setValue(q);
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; details?: { reason?: string; hint?: string } } | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = useCallback(async (raw: string) => {
    const parsed = parseAnalyzeInput(raw);
    if (parsed.kind === "invalid") {
      setError({ message: parsed.reason });
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(parsed.kind === "profile" ? "/api/analyze/profile" : "/api/analyze/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.kind === "profile" ? { username: parsed.username } : { url: parsed.url }),
      });
      const json = (await res.json()) as ApiEnvelope<Result> | ApiError;
      if (!json.ok) {
        setError({ message: json.error, details: json.details as { reason?: string; hint?: string } });
        setResult(null);
      } else setResult(json.result);
    } catch (e) {
      setError({ message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!q) return;
    // Kick off the fetch asynchronously so no state is set synchronously inside the effect body.
    const timer = setTimeout(() => void run(q), 0);
    return () => clearTimeout(timer);
  }, [q, run]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.replace(`/?q=${encodeURIComponent(value.trim())}`);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="panel grid-bg p-5">
        <label className="label" htmlFor="q">Instagram username or post URL</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input id="q" value={value} onChange={(e) => setValue(e.target.value)} placeholder="@username  ·  https://instagram.com/p/…  ·  https://instagram.com/reel/…" className="w-full rounded-lg border border-line bg-bg/70 py-3 pl-9 pr-3 text-sm outline-none placeholder:text-muted/70 focus:border-accent" maxLength={300} autoComplete="off" />
          </div>
          <button type="submit" disabled={loading || !value.trim()} className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50">
            {loading ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Analyzing</span> : "ANALYZE"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Try demo:</span>
          {demoUsernames.map((u) => <button type="button" key={u} onClick={() => { setValue(`@${u}`); router.replace(`/?q=${encodeURIComponent("@" + u)}`); }} className="rounded-full border border-line px-2 py-0.5 hover:border-accent hover:text-accent">@{u}</button>)}
          <button type="button" onClick={() => router.replace(`/?q=${encodeURIComponent("https://www.instagram.com/p/DEMOINFL001/")}`)} className="rounded-full border border-line px-2 py-0.5 hover:border-accent hover:text-accent">demo post</button>
        </div>
      </form>

      {error && (
        <div className="space-y-3">
          <InsufficientData title="INSUFFICIENT DATA" missing={[error.details?.reason ?? error.message, ...(error.details?.hint ? [error.details.hint] : [])]} hint="The analysis could not run because the active data source could not supply the required data:" />
          <Link href={`/check?u=${encodeURIComponent(value.replace(/^@/, ""))}`} className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90">Verify this account now with its public numbers (Screening check) →</Link>
        </div>
      )}

      {result?.kind === "profile" && <ProfileDashboard r={result} />}
      {result?.kind === "post" && <PostDashboard r={result} />}
    </div>
  );
}
