"use client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import type { DistributionBucket, DataFacet, Signal } from "@/types/results";

const C = { ok: "#22c55e", warn: "#f59e0b", bad: "#ef4444", accent: "#4f8cff", violet: "#a78bfa", muted: "#3b4457" };
const tooltipStyle = { background: "#10141d", border: "1px solid #222a38", borderRadius: 8, fontSize: 12 };

export function Donut({ data, centerLabel }: { data: { name: string; value: number; color: string }[]; centerLabel?: string }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <p className="text-sm text-muted">No data.</p>;
  return (
    <div className="relative h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={60} outerRadius={85} paddingAngle={2} stroke="none">
            {filtered.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Number(v).toFixed(1)}%`} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-6 text-center text-sm font-semibold">{centerLabel}</div>}
    </div>
  );
}

export function audienceDonutData(real: number, some: number, botLike: number) {
  return [
    { name: "Likely authentic", value: real, color: C.ok },
    { name: "Some suspicious signals", value: some, color: C.warn },
    { name: "Bot-like / highly suspicious", value: botLike, color: C.bad },
  ];
}

export function Histogram({ buckets, color = C.violet }: { buckets: DistributionBucket[]; color?: string }) {
  if (!buckets.length) return <p className="text-sm text-muted">No data.</p>;
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#1b2130" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#7c879b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#7c879b" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {buckets.map((b) => <Cell key={b.label} fill={b.from >= 75 ? C.bad : b.from >= 50 ? C.warn : b.from >= 25 ? C.accent : C.ok} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <span className="sr-only">{color}</span>
    </div>
  );
}

export function BandBars({ bands }: { bands: { band: string; count: number; pct: number }[] }) {
  if (!bands.length) return <p className="text-sm text-muted">No data.</p>;
  const colors = [C.ok, C.warn, "#f97316", C.bad];
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bands} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#1b2130" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "#7c879b" }} axisLine={false} tickLine={false} unit="%" />
          <YAxis type="category" dataKey="band" width={150} tick={{ fontSize: 11, fill: "#c8cfdb" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v, _n, item) => [`${v}% (${(item?.payload as { count: number })?.count})`, "share"]} />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {bands.map((b, i) => <Cell key={b.band} fill={colors[i] ?? C.accent} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CoverageBars({ facets }: { facets: DataFacet[] }) {
  const data = facets.map((f) => ({ name: f.label, value: f.status === "unavailable" ? 0 : 100, status: f.status }));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.name}>
          <div className="flex justify-between text-xs"><span>{d.name}</span><span className="uppercase text-muted">{d.status}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-line"><div className="h-full rounded" style={{ width: `${d.value}%`, background: d.status === "observed" ? C.ok : d.status === "estimated" ? C.accent : C.muted }} /></div>
        </div>
      ))}
    </div>
  );
}

export function SignalBars({ signals }: { signals: Signal[] }) {
  if (!signals.length) return <p className="text-sm text-muted">No signals computed.</p>;
  const data = signals.map((s) => ({ name: s.label, share: Math.round(s.share * 100), prevalence: Math.round(s.prevalence * 100) }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#1b2130" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "#7c879b" }} axisLine={false} tickLine={false} unit="%" />
          <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11, fill: "#c8cfdb" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="share" name="Share of suspicious weight" fill={C.violet} radius={[0, 4, 4, 0]} />
          <Bar dataKey="prevalence" name="Accounts showing signal" fill={C.accent} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EngagementCompare({ observed, expected, low, high }: { observed?: number; expected?: number; low?: number; high?: number }) {
  if (observed === undefined || expected === undefined) return <p className="text-sm text-muted">Insufficient data.</p>;
  const data = [
    { name: "Observed", value: observed, color: C.accent },
    { name: "Expected (similar accounts)", value: expected, color: C.muted },
  ];
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: "#7c879b" }} axisLine={false} tickLine={false} unit="%" />
          <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11, fill: "#c8cfdb" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>{data.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
      {low !== undefined && high !== undefined && <p className="-mt-1 text-center text-[11px] text-muted">Typical range for this follower tier: {low}% – {high}%</p>}
    </div>
  );
}
