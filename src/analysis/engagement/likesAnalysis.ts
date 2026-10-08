import type { LikerSample } from "@/types/domain";
import type { LikesAnalysis, Metric } from "@/types/results";
import type { SuspicionWeights } from "@/config/weights";
import { scoreAccounts } from "@/analysis/followers/suspicionScore";
import { buildSignals } from "@/analysis/followers/audienceAggregate";
import { wilsonInterval, scaleInterval, round } from "@/analysis/statistics";

export const MIN_LIKER_SAMPLE = 30;

export function insufficientLikes(totalLikes: number | undefined, missing: string[]): LikesAnalysis {
  const note = "Requires a sample of liker accounts";
  const total: Metric = typeof totalLikes === "number"
    ? { label: "Total likes", status: "observed", value: totalLikes, unit: "count" }
    : { label: "Total likes", status: "unavailable", note: "Like count not observed (hidden or not provided)" };
  return {
    status: "insufficient",
    missing,
    total,
    authenticCount: { label: "Estimated authentic likes", status: "unavailable", note },
    suspiciousCount: { label: "Estimated suspicious likes", status: "unavailable", note },
    suspiciousPct: { label: "Suspicious likes %", status: "unavailable", note },
    authenticPct: { label: "Authentic likes %", status: "unavailable", note },
    signals: [],
    sampleScores: [],
    explanation: { title: "Why no like authenticity?", summary: "No liker sample available; like authenticity cannot be estimated.", drivers: missing.map((m) => ({ label: m, impact: 0, detail: "Missing input" })) },
  };
}

export function analyzeLikes(totalLikes: number | undefined, sample: LikerSample | undefined, weights: SuspicionWeights, now = Date.now()): LikesAnalysis {
  const missing: string[] = [];
  if (typeof totalLikes !== "number") missing.push("Observed like count");
  if (!sample) missing.push("Sample of accounts that liked the post");
  else if (sample.accounts.length < MIN_LIKER_SAMPLE) missing.push(`Liker sample too small (${sample.accounts.length} < ${MIN_LIKER_SAMPLE})`);
  if (missing.length) return insufficientLikes(totalLikes, missing);
  const s = sample as LikerSample;
  const total = totalLikes as number;
  const n = s.accounts.length;
  const scores = scoreAccounts(s.accounts, weights, now);
  const suspicious = scores.filter((x) => x.score > 25).length;
  const authentic = n - suspicious;
  const ivS = wilsonInterval(suspicious, n, 1.96, total);
  const ivA = wilsonInterval(authentic, n, 1.96, total);
  const signals = buildSignals(scores);
  return {
    status: "ok",
    missing: [],
    total: { label: "Total likes", status: "observed", value: total, unit: "count" },
    authenticCount: { label: "Estimated authentic likes", status: "estimated", value: Math.round((authentic / n) * total), interval: scaleInterval(ivA, total), unit: "count" },
    suspiciousCount: { label: "Estimated suspicious likes", status: "estimated", value: Math.round((suspicious / n) * total), interval: scaleInterval(ivS, total), unit: "count" },
    suspiciousPct: { label: "Suspicious likes %", status: "estimated", value: round((suspicious / n) * 100, 1), interval: { low: round(ivS.low * 100, 1), high: round(ivS.high * 100, 1) }, unit: "percent" },
    authenticPct: { label: "Authentic likes %", status: "estimated", value: round((authentic / n) * 100, 1), interval: { low: round(ivA.low * 100, 1), high: round(ivA.high * 100, 1) }, unit: "percent" },
    signals,
    sampleScores: scores,
    explanation: {
      title: "Why this like estimate?",
      summary: `${suspicious} of ${n} sampled likers show suspicious signals (score > 25), scaled to ${total.toLocaleString()} likes with a 95% interval.`,
      drivers: signals.slice(0, 5).map((sg) => ({ label: sg.label, impact: round(sg.share * 100, 0), detail: `${Math.round(sg.prevalence * 100)}% of sampled likers` })),
    },
  };
}
