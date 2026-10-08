"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { ApiEnvelope, ApiError, ProfileAnalysisResult } from "@/types/results";
import { ProfileDashboard } from "./ProfileDashboard";
import { InsufficientData } from "./ui";

/** "1240" · "1,240" · "1.240" · "12.4K" · "1,2M" → integer. With a K/M suffix the separator is a decimal point; without it, separators are thousands. */
function num(v: string): number | undefined {
  const s = v.trim().toLowerCase().replace(/\s/g, "");
  if (!s) return undefined;
  const m = s.match(/^([\d.,]+)([km])?$/);
  if (!m || !/\d/.test(m[1] ?? "")) return undefined;
  const digits = m[1] as string;
  const suffix = m[2];
  const mult = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : 1;
  const base = suffix ? Number(digits.replace(",", ".")) : Number(digits.replace(/[.,]/g, ""));
  if (!Number.isFinite(base)) return undefined;
  return Math.round(base * mult);
}

/** Parse "likes, comments[, views]" per line. Accepts 12.4K / 1,2M / plain integers. */
export function parsePostLines(text: string): { rows: { likes: number; comments?: number; views?: number }[]; bad: number[] } {
  const rows: { likes: number; comments?: number; views?: number }[] = [];
  const bad: number[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    const parts = t.split(/[;\t|]|,\s+|\s+/).map((p) => p.trim()).filter(Boolean);
    const likes = num(parts[0] ?? "");
    if (likes === undefined) {
      bad.push(i + 1);
      return;
    }
    const comments = parts[1] !== undefined ? num(parts[1]) : undefined;
    const views = parts[2] !== undefined ? num(parts[2]) : undefined;
    rows.push({ likes, comments, views });
  });
  return { rows, bad };
}

export function ManualCheckForm({ initialUsername = "" }: { initialUsername?: string }) {
  const [username, setUsername] = useState(initialUsername);
  const [followers, setFollowers] = useState("");
  const [following, setFollowing] = useState("");
  const [posts, setPosts] = useState("");
  const [lines, setLines] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProfileAnalysisResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const f = num(followers);
    if (f === undefined) {
      setError("Followers is required (e.g. 48200 or 48.2K)");
      return;
    }
    const { rows, bad } = parsePostLines(lines);
    if (bad.length) {
      setError(`Could not read line${bad.length > 1 ? "s" : ""} ${bad.join(", ")}. Use one post per line: likes, comments`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/analyze/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.replace(/^@/, ""), followersCount: f, followingCount: num(following), postsCount: num(posts), recentPosts: rows }),
      });
      const json = (await res.json()) as ApiEnvelope<ProfileAnalysisResult> | ApiError;
      if (!json.ok) {
        setError(`${json.error}${json.details ? `: ${JSON.stringify(json.details).slice(0, 200)}` : ""}`);
        setResult(null);
      } else setResult(json.result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const field = "mt-1 w-full rounded-lg border border-line bg-bg/70 p-2.5 text-sm outline-none focus:border-accent";
  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="panel grid-bg space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div><label className="label" htmlFor="u">Username</label><input id="u" className={field} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@artista" required maxLength={60} /></div>
          <div><label className="label" htmlFor="f">Followers</label><input id="f" className={field} value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="48.2K" required inputMode="decimal" /></div>
          <div><label className="label" htmlFor="g">Following</label><input id="g" className={field} value={following} onChange={(e) => setFollowing(e.target.value)} placeholder="812" inputMode="decimal" /></div>
          <div><label className="label" htmlFor="p">Posts</label><input id="p" className={field} value={posts} onChange={(e) => setPosts(e.target.value)} placeholder="342" inputMode="decimal" /></div>
        </div>
        <div>
          <label className="label" htmlFor="l">Recent posts — one per line: likes, comments (min 3, ideally 9–12)</label>
          <textarea id="l" className={`${field} mono h-40`} value={lines} onChange={(e) => setLines(e.target.value)} placeholder={"1240, 38\n1.1K, 41\n980, 12\n2.3K, 95\n…"} />
          <p className="mt-1 text-xs text-muted">Copy the numbers you see on the public profile. Formats like 12.4K or 1,2M are accepted. Skip pinned posts if they are months old.</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Only public counts. Nothing is stored, no login, no scraping.</p>
          <button type="submit" disabled={loading} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{loading ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Analyzing</span> : "ANALYZE"}</button>
        </div>
      </form>
      {error && <InsufficientData missing={[error]} hint="The screening check could not run:" />}
      {result && <ProfileDashboard r={result} />}
    </div>
  );
}
