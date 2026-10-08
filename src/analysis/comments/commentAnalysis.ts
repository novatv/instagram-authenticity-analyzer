import type { CommentSample } from "@/types/domain";
import type { CommentAnalysis, Metric, Signal } from "@/types/results";
import type { SuspicionWeights } from "@/config/weights";
import { normalizeComment, shingles, jaccard, emojiStats, mentionCount, isGenericPhrase, spamScore, lowTextEntropy } from "./commentFeatures";
import { scoreAccount } from "@/analysis/followers/suspicionScore";
import { detectBursts, wilsonInterval, scaleInterval, round, clamp01 } from "@/analysis/statistics";

export const MIN_COMMENT_SAMPLE = 10;

interface CommentWeights {
  exactDuplicate: number;
  nearDuplicate: number;
  genericPhrase: number;
  emojiPattern: number;
  massMentions: number;
  spam: number;
  lowEntropy: number;
  burst: number;
  repeatAuthor: number;
  suspiciousAuthor: number;
}

export const DEFAULT_COMMENT_WEIGHTS: CommentWeights = {
  exactDuplicate: 2.0,
  nearDuplicate: 1.2,
  genericPhrase: 0.6,
  emojiPattern: 0.6,
  massMentions: 1.0,
  spam: 2.0,
  lowEntropy: 0.6,
  burst: 1.0,
  repeatAuthor: 0.8,
  suspiciousAuthor: 1.5,
};

const LABELS: Record<keyof CommentWeights, string> = {
  exactDuplicate: "Identical text from multiple accounts",
  nearDuplicate: "Near-duplicate text",
  genericPhrase: "Generic stock phrase",
  emojiPattern: "Repetitive emoji pattern",
  massMentions: "Mass mentions",
  spam: "Spam / promotional pattern",
  lowEntropy: "Low-entropy / repetitive text",
  burst: "Posted inside a temporal burst",
  repeatAuthor: "Same account commenting repeatedly",
  suspiciousAuthor: "Commenter profile looks suspicious",
};

const DESCRIPTIONS: Record<keyof CommentWeights, string> = {
  exactDuplicate: "The exact same normalized text appears from 2+ different accounts.",
  nearDuplicate: "Character-shingle Jaccard similarity ≥ 0.8 with another comment from a different account.",
  genericPhrase: "Matches a list of stock phrases (\"nice pic\", \"follow me\"). Short comments are not penalized by length alone.",
  emojiPattern: "Emoji-only comments with a single repeated emoji, or 4+ repeats of the same emoji.",
  massMentions: "Three or more @mentions in one comment.",
  spam: "Links, 'DM me', promo/follow-for-follow or crypto patterns.",
  lowEntropy: "Character entropy well below natural text (e.g. 'aaaaaaa').",
  burst: "Comment falls inside a window with unusually many comments relative to the median gap.",
  repeatAuthor: "Account contributed 3+ comments on the same post.",
  suspiciousAuthor: "When commenter profile data is available, its own suspicion score is ≥ 50.",
};

function unavailable(label: string, note: string): Metric {
  return { label, status: "unavailable", note };
}

export function insufficientComments(total: number | undefined, missing: string[]): CommentAnalysis {
  const note = "Requires a sample of public comments";
  return {
    status: "insufficient",
    missing,
    total: typeof total === "number" ? { label: "Total comments", status: "observed", value: total, unit: "count" } : unavailable("Total comments", "Comment count not observed"),
    authenticCount: unavailable("Estimated authentic comments", note),
    suspiciousCount: unavailable("Estimated suspicious comments", note),
    suspiciousPct: unavailable("Suspicious comments %", note),
    authenticityScore: unavailable("Comment Authenticity Score", note),
    signals: [],
    duplicateGroups: [],
    temporalBursts: [],
    flagged: [],
    explanation: { title: "Why no comment score?", summary: "No public comment sample available.", drivers: missing.map((m) => ({ label: m, impact: 0, detail: "Missing input" })) },
  };
}

/**
 * Comment authenticity: basic NLP + statistics over a legitimately obtained comment sample.
 * Each comment gets a 0..100 suspicion score from weighted features; a single weak
 * signal (e.g. a short "nice") does not flag a comment.
 */
export function analyzeComments(
  totalComments: number | undefined,
  sample: CommentSample | undefined,
  accountWeights: SuspicionWeights,
  cw: CommentWeights = DEFAULT_COMMENT_WEIGHTS,
  now = Date.now(),
): CommentAnalysis {
  const missing: string[] = [];
  if (!sample) missing.push("Sample of public comments");
  else if (sample.comments.length < MIN_COMMENT_SAMPLE) missing.push(`Comment sample too small (${sample.comments.length} < ${MIN_COMMENT_SAMPLE})`);
  if (missing.length) return insufficientComments(totalComments, missing);
  const comments = (sample as CommentSample).comments;
  const n = comments.length;
  const population = typeof totalComments === "number" && totalComments >= n ? totalComments : n;

  // --- duplicates
  const byNorm = new Map<string, { authors: Set<string>; ids: string[]; text: string }>();
  for (const c of comments) {
    const key = normalizeComment(c.text);
    if (!key) continue;
    const cur = byNorm.get(key) ?? { authors: new Set<string>(), ids: [], text: c.text };
    cur.authors.add(c.authorUsername.toLowerCase());
    cur.ids.push(c.id);
    byNorm.set(key, cur);
  }
  const duplicateIds = new Set<string>();
  const duplicateGroups: CommentAnalysis["duplicateGroups"] = [];
  for (const g of byNorm.values()) {
    if (g.ids.length >= 2 && g.authors.size >= 2) {
      g.ids.forEach((id) => duplicateIds.add(id));
      duplicateGroups.push({ text: g.text.slice(0, 80), count: g.ids.length, authors: g.authors.size });
    }
  }
  duplicateGroups.sort((a, b) => b.count - a.count);

  // --- near duplicates (O(n²) capped for safety)
  const nearIds = new Set<string>();
  const cap = Math.min(n, 1500);
  const sh = comments.slice(0, cap).map((c) => ({ id: c.id, author: c.authorUsername.toLowerCase(), s: shingles(c.text), len: normalizeComment(c.text).length }));
  for (let i = 0; i < sh.length; i++) {
    const a = sh[i]!;
    if (a.len < 12 || duplicateIds.has(a.id)) continue;
    for (let j = i + 1; j < sh.length; j++) {
      const b = sh[j]!;
      if (b.len < 12 || a.author === b.author) continue;
      if (jaccard(a.s, b.s) >= 0.8) {
        nearIds.add(a.id);
        nearIds.add(b.id);
      }
    }
  }

  // --- temporal bursts
  const timestamps = comments.map((c) => c.createdAt).filter((t): t is string => typeof t === "string");
  const hasTimestamps = timestamps.length >= Math.max(3, n * 0.5);
  const burstInfo = hasTimestamps ? detectBursts(timestamps) : { bursts: [], burstEventShare: 0, medianGapMs: null };
  const burstRanges = burstInfo.bursts.map((b) => [Date.parse(b.start), Date.parse(b.end)] as const);
  const inBurst = (iso?: string) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return burstRanges.some(([s, e]) => t >= s && t <= e);
  };

  // --- repeat authors
  const authorCounts = new Map<string, number>();
  for (const c of comments) authorCounts.set(c.authorUsername.toLowerCase(), (authorCounts.get(c.authorUsername.toLowerCase()) ?? 0) + 1);

  // --- per-comment scoring
  const totalWeight = Object.values(cw).reduce((a, b) => a + b, 0);
  const signalMass = new Map<keyof CommentWeights, { contribution: number; fired: number }>();
  const flagged: CommentAnalysis["flagged"] = [];
  let suspicious = 0;
  const hasAuthorData = comments.some((c) => c.author && (c.author.followersCount !== undefined || c.author.postsCount !== undefined));

  for (const c of comments) {
    const acts: Partial<Record<keyof CommentWeights, number>> = {};
    if (duplicateIds.has(c.id)) acts.exactDuplicate = 1;
    if (nearIds.has(c.id)) acts.nearDuplicate = 1;
    if (isGenericPhrase(c.text)) acts.genericPhrase = 1;
    const es = emojiStats(c.text);
    if (es.repeatedEmojiRun || (es.emojiOnly && es.emojiCount >= 3 && es.distinctEmoji === 1)) acts.emojiPattern = 1;
    const m = mentionCount(c.text);
    if (m >= 3) acts.massMentions = Math.min(1, m / 5);
    const sp = spamScore(c.text);
    if (sp.score > 0) acts.spam = sp.score;
    if (lowTextEntropy(c.text)) acts.lowEntropy = 1;
    if (hasTimestamps && inBurst(c.createdAt)) acts.burst = 1;
    const ac = authorCounts.get(c.authorUsername.toLowerCase()) ?? 0;
    if (ac >= 3) acts.repeatAuthor = Math.min(1, (ac - 2) / 3);
    if (c.author) {
      const s = scoreAccount(c.author, accountWeights, now);
      if (s.score >= 50) acts.suspiciousAuthor = s.score / 100;
    }

    let weighted = 0;
    let active = 0;
    const reasons: string[] = [];
    for (const [k, v] of Object.entries(acts) as [keyof CommentWeights, number][]) {
      weighted += v * cw[k];
      if (v >= 0.3) {
        active++;
        reasons.push(LABELS[k]);
      }
      const cur = signalMass.get(k) ?? { contribution: 0, fired: 0 };
      cur.contribution += v * cw[k];
      if (v >= 0.3) cur.fired++;
      signalMass.set(k, cur);
    }
    const damping = active <= 1 ? 0.5 : active === 2 ? 0.8 : 1;
    // normalize by a realistic max (sum of top-3 weights) so that 3 strong signals reach ~100
    const top3 = Object.values(cw).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
    const score = Math.round(clamp01((weighted / Math.min(totalWeight, top3)) * damping) * 100);
    if (score > 40) {
      suspicious++;
      flagged.push({ id: c.id, author: c.authorUsername, text: c.text.slice(0, 140), score, reasons });
    }
  }
  flagged.sort((a, b) => b.score - a.score);

  const authentic = n - suspicious;
  const ivS = wilsonInterval(suspicious, n, 1.96, population);
  const ivA = wilsonInterval(authentic, n, 1.96, population);
  const grand = [...signalMass.values()].reduce((a, b) => a + b.contribution, 0);
  const signals: Signal[] = [...signalMass.entries()]
    .filter(([, v]) => v.contribution > 0)
    .map(([k, v]) => ({ key: k, label: LABELS[k], share: grand > 0 ? v.contribution / grand : 0, prevalence: v.fired / n, description: DESCRIPTIONS[k] }))
    .sort((a, b) => b.share - a.share);

  const suspiciousShare = suspicious / n;
  const dupShare = (duplicateIds.size + nearIds.size) / n;
  const authenticity = Math.round(clamp01(1 - (0.7 * suspiciousShare + 0.2 * dupShare + 0.1 * burstInfo.burstEventShare)) * 100);

  return {
    status: "ok",
    missing: [],
    total: typeof totalComments === "number" ? { label: "Total comments", status: "observed", value: totalComments, unit: "count" } : { label: "Total comments", status: "observed", value: n, unit: "count", note: "Only the sample size is known" },
    authenticCount: { label: "Estimated authentic comments", status: "estimated", value: Math.round((authentic / n) * population), interval: scaleInterval(ivA, population), unit: "count" },
    suspiciousCount: { label: "Estimated suspicious comments", status: "estimated", value: Math.round(suspiciousShare * population), interval: scaleInterval(ivS, population), unit: "count" },
    suspiciousPct: { label: "Suspicious comments %", status: "estimated", value: round(suspiciousShare * 100, 1), interval: { low: round(ivS.low * 100, 1), high: round(ivS.high * 100, 1) }, unit: "percent" },
    authenticityScore: { label: "Comment Authenticity Score", status: "estimated", value: authenticity, unit: "score", note: hasTimestamps ? "Includes temporal-burst analysis" : "No timestamps: temporal analysis skipped" },
    signals,
    duplicateGroups: duplicateGroups.slice(0, 20),
    temporalBursts: burstInfo.bursts.slice(0, 20),
    flagged: flagged.slice(0, 50),
    explanation: {
      title: "Why this comment score?",
      summary: `${suspicious} of ${n} sampled comments scored > 40 on the suspicion model (${round(suspiciousShare * 100, 0)}%). ${duplicateGroups.length} duplicate group(s), ${burstInfo.bursts.length} temporal burst(s)${hasAuthorData ? ", commenter profiles evaluated" : ", commenter profiles not available"}.`,
      drivers: signals.slice(0, 6).map((s) => ({ label: s.label, impact: round(s.share * 100, 0), detail: `${Math.round(s.prevalence * 100)}% of sampled comments` })),
    },
  };
}
