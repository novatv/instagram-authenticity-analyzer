"use client";
import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronDown, Info, AlertTriangle } from "lucide-react";
import type { Metric, ConfidenceReport, ScoreExplanation, Signal, DataFacet, MetricStatus } from "@/types/results";
import { fmtInt, fmtPct } from "@/utils/format";

export function Card({ title, children, className, right }: { title?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={clsx("panel p-4", className)}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="label">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: MetricStatus }) {
  return <span className={clsx("rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider", `status-${status}`)}>{status}</span>;
}

export function formatMetric(m: Metric): string {
  if (m.status === "unavailable" || m.value === undefined) return "—";
  if (m.unit === "percent") return fmtPct(m.value);
  if (m.unit === "ratio") return `×${m.value}`;
  if (m.unit === "score") return `${m.value}`;
  return fmtInt(m.value);
}

export function formatInterval(m: Metric): string | null {
  if (!m.interval) return null;
  if (m.unit === "percent") return `${fmtPct(m.interval.low, 0)} – ${fmtPct(m.interval.high, 0)}`;
  return `${fmtInt(m.interval.low)} – ${fmtInt(m.interval.high)}`;
}

export function MetricTile({ m, big, tone }: { m: Metric; big?: boolean; tone?: "ok" | "warn" | "bad" }) {
  const iv = formatInterval(m);
  return (
    <div className="rounded-lg border border-line bg-panel-2/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted">{m.label}</span>
        <StatusPill status={m.status} />
      </div>
      <div className={clsx("mt-1 font-semibold tabular-nums", big ? "text-3xl" : "text-xl", tone === "ok" && "text-ok", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>
        {formatMetric(m)}
        {m.unit === "score" && m.status !== "unavailable" && <span className="text-sm text-muted"> / 100</span>}
      </div>
      {iv && <div className="mono text-xs text-muted">95% interval: {iv}</div>}
      {m.note && <div className="mt-1 text-[11px] leading-snug text-muted">{m.note}</div>}
    </div>
  );
}

export function toneForAuthenticity(score: number | undefined): "ok" | "warn" | "bad" | undefined {
  if (score === undefined) return undefined;
  return score >= 70 ? "ok" : score >= 45 ? "warn" : "bad";
}

export function toneForSuspicion(score: number | undefined): "ok" | "warn" | "bad" | undefined {
  if (score === undefined) return undefined;
  return score <= 30 ? "ok" : score <= 55 ? "warn" : "bad";
}

export function ScoreRing({ value, label, sub, invert }: { value: number | undefined; label: string; sub?: string; invert?: boolean }) {
  const v = value ?? 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = invert ? toneForSuspicion(value) : toneForAuthenticity(value);
  const color = tone === "ok" ? "var(--color-ok)" : tone === "warn" ? "var(--color-warn)" : tone === "bad" ? "var(--color-bad)" : "var(--color-muted)";
  return (
    <div className="flex items-center gap-4">
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--color-line)" strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - (value === undefined ? 0 : v / 100))} transform="rotate(-90 64 64)" style={{ transition: "stroke-dashoffset .6s ease" }} />
        <text x="64" y="60" textAnchor="middle" fill="var(--color-text)" fontSize="30" fontWeight="700">{value === undefined ? "—" : v}</text>
        <text x="64" y="80" textAnchor="middle" fill="var(--color-muted)" fontSize="11">/ 100</text>
      </svg>
      <div>
        <div className="label">{label}</div>
        {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
      </div>
    </div>
  );
}

export function ConfidenceBadge({ c }: { c: ConfidenceReport }) {
  const tone = c.level === "HIGH" ? "text-ok border-ok/40 bg-ok/10" : c.level === "MEDIUM" ? "text-warn border-warn/40 bg-warn/10" : "text-bad border-bad/40 bg-bad/10";
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className={clsx("rounded-md border px-2 py-1 font-semibold", tone)}>Confidence: {c.level}</span>
      <span className="text-muted">Data coverage <b className="text-text">{Math.round(c.dataCoverage * 100)}%</b></span>
      <span className="text-muted">Sample size <b className="text-text">{fmtInt(c.sampleSize)}</b>{c.populationSize ? <> of {fmtInt(c.populationSize)}</> : null}</span>
    </div>
  );
}

export function InsufficientData({ title = "INSUFFICIENT DATA", missing, hint }: { title?: string; missing: string[]; hint?: string }) {
  return (
    <div className="rounded-lg border border-warn/40 bg-warn/5 p-4">
      <div className="flex items-center gap-2 font-semibold text-warn"><AlertTriangle size={16} /> {title}</div>
      <p className="mt-1 text-sm text-muted">{hint ?? "This metric requires additional audience data. Missing:"}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {missing.map((m, i) => <li key={i}>{m}</li>)}
      </ul>
    </div>
  );
}

export function WhyThisScore({ e, defaultOpen = false }: { e: ScoreExplanation; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-line bg-panel-2/40">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-panel-2/70">
        <span className="flex items-center gap-2"><Info size={14} className="text-accent" /> {e.title}</span>
        <ChevronDown size={16} className={clsx("transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-line px-3 py-3 text-sm">
          <p className="text-muted">{e.summary}</p>
          {e.drivers.length > 0 && (
            <ul className="mt-3 space-y-2">
              {e.drivers.map((d, i) => (
                <li key={i}>
                  <div className="flex items-center justify-between gap-2">
                    <span>{d.label}</span>
                    <span className="mono text-xs text-muted">{d.impact > 0 ? `${d.impact}%` : ""}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-line"><div className="h-full rounded bg-accent" style={{ width: `${Math.min(100, d.impact)}%` }} /></div>
                  <div className="mt-0.5 text-xs text-muted">{d.detail}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function SignalList({ signals, emptyText = "No signals computed." }: { signals: Signal[]; emptyText?: string }) {
  if (!signals.length) return <p className="text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="space-y-2">
      {signals.map((s) => (
        <li key={s.key} className="rounded-md border border-line bg-panel-2/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{Math.round(s.share * 100)}% · {s.label}</span>
            <span className="mono text-xs text-muted">fires in {Math.round(s.prevalence * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-line"><div className="h-full rounded bg-violet" style={{ width: `${Math.round(s.share * 100)}%` }} /></div>
          <p className="mt-1 text-xs text-muted">{s.description}</p>
        </li>
      ))}
    </ul>
  );
}

export function FacetTable({ facets }: { facets: DataFacet[] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {facets.map((f) => (
          <tr key={f.key} className="border-t border-line first:border-t-0">
            <td className="py-2 pr-2">{f.label}</td>
            <td className="py-2 pr-2 text-right"><StatusPill status={f.status} /></td>
            <td className="py-2 text-right text-xs text-muted">{f.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: readonly T[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-1">
      {tabs.map((t) => (
        <button key={t} type="button" onClick={() => onChange(t)} className={clsx("rounded-md px-3 py-1.5 text-sm transition", active === t ? "bg-accent/20 text-accent" : "text-muted hover:bg-panel-2 hover:text-text")}>{t}</button>
      ))}
    </div>
  );
}

export function DemoBanner({ provider }: { provider: { name: string; isDemo: boolean } }) {
  if (!provider.isDemo) return <p className="text-xs text-muted">Source: {provider.name}</p>;
  return <div className="rounded-md border border-violet/40 bg-violet/10 px-3 py-2 text-xs text-violet"><b>DEMO DATA</b> — results come from {provider.name}: a synthetic dataset for development. Configure a real provider or import your own data for real analysis.</div>;
}
