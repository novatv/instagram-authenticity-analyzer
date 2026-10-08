/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  DEMO DATA — SYNTHETIC. Generated deterministically for         ║
 * ║  development, demos and tests. No real Instagram accounts.      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import type { AccountSample, CommentData, PostData, ProfileData } from "@/types/domain";
import { mulberry32, hashString } from "@/utils/prng";

export interface DemoProfileSpec {
  username: string;
  fullName: string;
  followers: number;
  following: number;
  posts: number;
  isPrivate?: boolean;
  /** engagement rate (%) used to synthesize post likes */
  engagementPct: number;
  /** share of synthetic followers generated with bot-like traits */
  botShare: number;
  /** share generated as inactive/abandoned */
  inactiveShare: number;
  /** size of the follower sample the mock "can obtain" (0 = none) */
  sampleSize: number;
  /** whether comment samples include spam / duplicates / bursts */
  commentSpamShare: number;
  likerBotShare: number;
  likerSampleSize: number;
  commentSampleSize: number;
}

export const DEMO_PROFILES: DemoProfileSpec[] = [
  { username: "demo_organic", fullName: "Demo Organic Creator", followers: 48_200, following: 812, posts: 342, engagementPct: 3.1, botShare: 0.06, inactiveShare: 0.08, sampleSize: 600, commentSpamShare: 0.05, likerBotShare: 0.05, likerSampleSize: 300, commentSampleSize: 120 },
  { username: "demo_inflated", fullName: "Demo Inflated Account", followers: 312_000, following: 1_204, posts: 96, engagementPct: 0.35, botShare: 0.46, inactiveShare: 0.2, sampleSize: 800, commentSpamShare: 0.42, likerBotShare: 0.5, likerSampleSize: 400, commentSampleSize: 200 },
  { username: "demo_mixed", fullName: "Demo Mixed Audience", followers: 9_800, following: 1_500, posts: 58, engagementPct: 2.2, botShare: 0.22, inactiveShare: 0.15, sampleSize: 350, commentSpamShare: 0.18, likerBotShare: 0.2, likerSampleSize: 150, commentSampleSize: 60 },
  { username: "demo_small_sample", fullName: "Demo Huge Account, Tiny Sample", followers: 2_000_000, following: 150, posts: 1_204, engagementPct: 1.0, botShare: 0.25, inactiveShare: 0.1, sampleSize: 30, commentSpamShare: 0.1, likerBotShare: 0.2, likerSampleSize: 30, commentSampleSize: 12 },
  { username: "demo_noaudience", fullName: "Demo Posts Only (no follower sample)", followers: 15_300, following: 420, posts: 77, engagementPct: 1.8, botShare: 0, inactiveShare: 0, sampleSize: 0, commentSpamShare: 0, likerBotShare: 0, likerSampleSize: 0, commentSampleSize: 0 },
  { username: "demo_private", fullName: "Demo Private Account", followers: 1_200, following: 300, posts: 12, isPrivate: true, engagementPct: 0, botShare: 0, inactiveShare: 0, sampleSize: 0, commentSpamShare: 0, likerBotShare: 0, likerSampleSize: 0, commentSampleSize: 0 },
];

export function findDemoProfile(username: string): DemoProfileSpec | undefined {
  const u = username.toLowerCase().replace(/^@/, "");
  return DEMO_PROFILES.find((p) => p.username === u);
}

const FIRST = ["ana", "luis", "marta", "jon", "sara", "diego", "nora", "pablo", "lucia", "ivan", "clara", "mateo", "eva", "hugo", "vera", "leo", "julia", "alex", "mia", "dani"];
const WORDS = ["travel", "music", "photo", "fit", "art", "dj", "studio", "life", "club", "vibes", "moto", "surf", "kitchen", "garden", "code"];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function isoDaysAgo(now: number, days: number): string {
  return new Date(now - days * 86_400_000).toISOString();
}

/** Synthesize one account. kind drives the trait distribution. */
export function synthAccount(rng: () => number, kind: "real" | "bot" | "inactive", now: number, idx: number): AccountSample {
  if (kind === "bot") {
    const style = rng();
    const username = style < 0.4
      ? `${pick(rng, FIRST)}${Math.floor(rng() * 9_000_000 + 100_000)}`
      : style < 0.7
        ? `user_${Math.floor(rng() * 1e8).toString(36)}${Math.floor(rng() * 999)}`
        : `${pick(rng, FIRST)}_${pick(rng, WORDS)}_${Math.floor(rng() * 99999)}_${idx}`;
    const following = Math.floor(1_500 + rng() * 6_000);
    return {
      username,
      followersCount: Math.floor(rng() * 40),
      followingCount: following,
      postsCount: rng() < 0.7 ? 0 : Math.floor(rng() * 3),
      hasProfilePicture: rng() < 0.35,
      hasBio: rng() < 0.2,
      isPrivate: rng() < 0.3,
      createdAt: isoDaysAgo(now, Math.floor(rng() * 90)),
    };
  }
  if (kind === "inactive") {
    return {
      username: `${pick(rng, FIRST)}.${pick(rng, WORDS)}${Math.floor(rng() * 99)}`,
      followersCount: Math.floor(20 + rng() * 300),
      followingCount: Math.floor(100 + rng() * 600),
      postsCount: Math.floor(rng() * 15),
      hasProfilePicture: rng() < 0.8,
      hasBio: rng() < 0.5,
      lastPostAt: isoDaysAgo(now, 400 + Math.floor(rng() * 900)),
      createdAt: isoDaysAgo(now, 800 + Math.floor(rng() * 2000)),
    };
  }
  const followers = Math.floor(80 + rng() * 2_500);
  return {
    username: `${pick(rng, FIRST)}${rng() < 0.5 ? "." : "_"}${pick(rng, WORDS)}${rng() < 0.4 ? Math.floor(rng() * 99) : ""}`,
    followersCount: followers,
    followingCount: Math.floor(followers * (0.4 + rng() * 1.6)),
    postsCount: Math.floor(10 + rng() * 400),
    hasProfilePicture: true,
    hasBio: rng() < 0.85,
    lastPostAt: isoDaysAgo(now, Math.floor(rng() * 60)),
    createdAt: isoDaysAgo(now, 500 + Math.floor(rng() * 3000)),
  };
}

export function synthAccounts(seed: string, count: number, botShare: number, inactiveShare: number, now: number): AccountSample[] {
  const rng = mulberry32(hashString(seed));
  const out: AccountSample[] = [];
  for (let i = 0; i < count; i++) {
    const r = rng();
    const kind = r < botShare ? "bot" : r < botShare + inactiveShare ? "inactive" : "real";
    out.push(synthAccount(rng, kind, now, i));
  }
  return out;
}

export function synthPosts(spec: DemoProfileSpec, now: number, count = 12): PostData[] {
  const rng = mulberry32(hashString(`${spec.username}:posts`));
  const posts: PostData[] = [];
  for (let i = 0; i < count; i++) {
    const base = (spec.followers * spec.engagementPct) / 100;
    const jitter = spec.botShare > 0.4 ? 0.9 + rng() * 0.2 : 0.4 + rng() * 1.4; // inflated accounts: suspiciously flat
    const likes = Math.max(0, Math.round(base * jitter * 0.93));
    const cpl = spec.botShare > 0.4 ? 0.025 : 0.02 + rng() * 0.03; // inflated: bought comments too
    const shortcode = `DEMO${spec.username.replace("demo_", "").slice(0, 4).toUpperCase()}${String(i + 1).padStart(3, "0")}`;
    posts.push({
      id: shortcode,
      shortcode,
      url: `https://www.instagram.com/p/${shortcode}/`,
      kind: i % 3 === 0 ? "reel" : "post",
      ownerUsername: spec.username,
      caption: `DEMO DATA post #${i + 1}`,
      likesCount: likes,
      commentsCount: Math.round(likes * cpl),
      viewsCount: i % 3 === 0 ? Math.round(likes * (8 + rng() * 10)) : undefined,
      publishedAt: isoDaysAgo(now, 3 + i * 5),
    });
  }
  return posts;
}

const REAL_COMMENTS = [
  "This set was incredible, the transition at 1:20 gave me chills",
  "Where was this filmed? The light is amazing",
  "Saw you in Bilbao last month, insane night",
  "Can you share the track ID for the second drop?",
  "My sister and I danced to this all weekend haha",
  "Okay but the outfit though 👀",
  "Need this on Spotify asap",
  "Been following since 2019, proud of how far you've come",
  "That crowd energy 🔥🔥",
  "Finally a reel longer than 10 seconds, thank you",
  "nice",
  "🔥",
  "jajaja el final",
  "Qué temazo, cuándo vuelves a Madrid?",
  "Honestly the best thing I've seen today",
  "the lighting guy deserves a raise",
  "ok this is art",
  "love the vibe here",
  "The edit on this is so clean",
  "Bro 😂😂",
];
const SPAM_COMMENTS = [
  "Nice pic",
  "Nice pic",
  "Nice post",
  "Amazing 🔥🔥🔥🔥🔥",
  "Follow me for promo DM",
  "Check my page for free giveaway",
  "😍😍😍😍😍😍",
  "Great content!! Check my profile",
  "DM me for collab 🚀",
  "Make $500 daily with crypto trading, dm me",
  "Wow",
  "Wow",
  "Love it",
  "@friend1 @friend2 @friend3 @friend4 look",
  "Amazing 🔥🔥🔥🔥🔥",
  "www.promo-site.example free followers",
];

export function synthComments(spec: DemoProfileSpec, postId: string, count: number, now: number): CommentData[] {
  const rng = mulberry32(hashString(`${spec.username}:${postId}:comments`));
  const out: CommentData[] = [];
  const start = now - 3 * 86_400_000;
  const burstStart = start + 6 * 3_600_000;
  for (let i = 0; i < count; i++) {
    const spam = rng() < spec.commentSpamShare;
    const text = spam ? pick(rng, SPAM_COMMENTS) : pick(rng, REAL_COMMENTS);
    const author = spam ? synthAccount(rng, "bot", now, i) : synthAccount(rng, "real", now, i);
    // spam arrives in a burst window; real comments are spread over 3 days
    const t = spam ? burstStart + rng() * 90_000 : start + rng() * 3 * 86_400_000;
    out.push({ id: `${postId}_c${i}`, authorUsername: author.username, text, createdAt: new Date(t).toISOString(), author, likesCount: Math.floor(rng() * 5) });
  }
  return out;
}

export function demoProfileData(spec: DemoProfileSpec, now: number): ProfileData {
  return {
    username: spec.username,
    fullName: spec.fullName,
    biography: "DEMO DATA — synthetic profile for development and tests",
    isPrivate: spec.isPrivate ?? false,
    isVerified: false,
    hasProfilePicture: true,
    followersCount: spec.followers,
    followingCount: spec.following,
    postsCount: spec.posts,
    lastPostAt: isoDaysAgo(now, 3),
  };
}
