import { normalizedEntropy } from "@/analysis/statistics";

/** Normalize a comment for duplicate detection: lowercase, strip punctuation/whitespace, keep emoji. */
export function normalizeComment(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\p{Extended_Pictographic}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(text: string): string[] {
  return normalizeComment(text).split(" ").filter(Boolean);
}

/** 3-character shingles for near-duplicate detection. */
export function shingles(text: string, k = 3): Set<string> {
  const t = normalizeComment(text).replace(/\s/g, "");
  const out = new Set<string>();
  if (t.length < k) {
    if (t) out.add(t);
    return out;
  }
  for (let i = 0; i <= t.length - k; i++) out.add(t.slice(i, i + k));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

export function emojiStats(text: string): { emojiCount: number; emojiOnly: boolean; distinctEmoji: number; repeatedEmojiRun: boolean } {
  const emojis = text.match(EMOJI_RE) ?? [];
  const stripped = text.replace(EMOJI_RE, "").replace(/[\s️‍]/g, "");
  const distinct = new Set(emojis).size;
  const repeatedRun = emojis.length >= 4 && distinct <= 1;
  return { emojiCount: emojis.length, emojiOnly: emojis.length > 0 && stripped.length === 0, distinctEmoji: distinct, repeatedEmojiRun: repeatedRun };
}

export function mentionCount(text: string): number {
  return (text.match(/(^|[^\w])@[\w.]{1,}/g) ?? []).length;
}

const GENERIC_PHRASES = [
  "nice", "nice pic", "nice post", "great", "great post", "great pic", "cool", "wow", "amazing", "awesome", "love it", "love this", "so beautiful",
  "beautiful", "gorgeous", "perfect", "stunning", "lit", "fire", "goals", "vibes", "slay", "queen", "king", "first", "follow me", "follow back",
  "check my page", "check my profile", "dm me", "dm for promo", "promo", "follow for follow", "f4f", "l4l", "like for like", "nice shot", "good one",
  "muy bueno", "que lindo", "hermoso", "hermosa", "genial", "increible", "increíble", "me encanta", "top", "brutal", "crack", "tremendo",
];
const GENERIC_SET = new Set(GENERIC_PHRASES);

/** True when the comment is a stock generic phrase (exact normalized match). Short comments are NOT penalized by length alone. */
export function isGenericPhrase(text: string): boolean {
  const n = normalizeComment(text).replace(/\p{Extended_Pictographic}/gu, "").trim();
  if (!n) return false;
  return GENERIC_SET.has(n);
}

const SPAM_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /\bwww\./i,
  /\b(dm|message|inbox)\s+(me|us)\b/i,
  /\b(check|visit|see)\s+(my|our)\s+(page|profile|bio|link|story)\b/i,
  /\b(free|earn|make)\s+\$?\d+/i,
  /\b(crypto|bitcoin|forex|investment|trading)\b.*\b(dm|profit|guaranteed)\b/i,
  /\b(promo|promotion|collab)\b.*\b(dm|inbox)\b/i,
  /\b(follow\s*(me|back)|f4f|l4l|follow for follow)\b/i,
  /\b(telegram|whatsapp)\b/i,
];

export function spamScore(text: string): { score: number; matched: string[] } {
  const matched: string[] = [];
  for (const re of SPAM_PATTERNS) if (re.test(text)) matched.push(re.source.slice(0, 24));
  return { score: Math.min(1, matched.length * 0.5), matched };
}

/** Low entropy text: e.g. "aaaaaaa", "!!!!!!!!!!", "hahahahahaha" extended. */
export function lowTextEntropy(text: string): boolean {
  const t = normalizeComment(text).replace(/\s/g, "");
  return t.length >= 8 && normalizedEntropy(t) < 0.4;
}
