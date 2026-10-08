import { z } from "zod";
import type { AccountSample, CommentData } from "@/types/domain";
import { parseCsv } from "./csv";
import { sanitizeText, sanitizeUsername, toBoolean, toIsoDate, toNumber } from "./sanitize";

export type DatasetType = "accounts" | "comments";

export interface ImportedDataset {
  type: DatasetType;
  accounts?: AccountSample[];
  comments?: CommentData[];
  rowsReceived: number;
  rejected: { row: number; reason: string }[];
  /** optional metadata supplied by the user/JSON wrapper */
  populationSize?: number;
  totalComments?: number;
  method?: string;
}

const ACCOUNT_ALIASES: Record<string, keyof AccountSample> = {
  username: "username", user: "username", handle: "username", account: "username", follower: "username", follower_username: "username",
  full_name: "fullName", fullname: "fullName", name: "fullName",
  followers: "followersCount", followers_count: "followersCount", follower_count: "followersCount", followerscount: "followersCount",
  following: "followingCount", following_count: "followingCount", follows: "followingCount", follows_count: "followingCount", followingcount: "followingCount",
  posts: "postsCount", posts_count: "postsCount", media_count: "postsCount", post_count: "postsCount", postscount: "postsCount",
  has_profile_picture: "hasProfilePicture", has_profile_pic: "hasProfilePicture", profile_pic: "hasProfilePicture", has_avatar: "hasProfilePicture", hasprofilepicture: "hasProfilePicture",
  has_bio: "hasBio", bio: "hasBio", biography: "hasBio", hasbio: "hasBio",
  is_private: "isPrivate", private: "isPrivate", isprivate: "isPrivate",
  is_verified: "isVerified", verified: "isVerified", isverified: "isVerified",
  last_post_at: "lastPostAt", last_post: "lastPostAt", last_post_date: "lastPostAt", lastpostat: "lastPostAt", last_activity: "lastPostAt",
  created_at: "createdAt", createdat: "createdAt", account_created: "createdAt", join_date: "createdAt",
};

const COMMENT_ALIASES: Record<string, string> = {
  id: "id", comment_id: "id",
  author: "authorUsername", username: "authorUsername", author_username: "authorUsername", user: "authorUsername", commenter: "authorUsername", owner: "authorUsername", authorusername: "authorUsername",
  text: "text", comment: "text", body: "text", content: "text", message: "text",
  created_at: "createdAt", timestamp: "createdAt", date: "createdAt", time: "createdAt", createdat: "createdAt",
  likes: "likesCount", like_count: "likesCount", likes_count: "likesCount", likescount: "likesCount",
};

function normalizeKeys<T extends string>(row: Record<string, unknown>, aliases: Record<string, T>): Partial<Record<T, unknown>> {
  const out: Partial<Record<T, unknown>> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = aliases[k.trim().toLowerCase().replace(/[\s-]+/g, "_")];
    if (key && out[key] === undefined) out[key] = v;
  }
  return out;
}

export function rowToAccount(row: Record<string, unknown>): AccountSample | { error: string } {
  const r = normalizeKeys(row, ACCOUNT_ALIASES);
  const username = sanitizeUsername(r.username);
  if (!username) return { error: "missing or invalid username" };
  const acc: AccountSample = { username };
  const fullName = sanitizeText(r.fullName, 120);
  if (fullName) acc.fullName = fullName;
  const nums: (keyof AccountSample)[] = ["followersCount", "followingCount", "postsCount"];
  for (const k of nums) {
    const n = toNumber(r[k]);
    if (n !== undefined) {
      if (n < 0 || n > 1e10) return { error: `${k} out of range` };
      (acc as unknown as Record<string, unknown>)[k] = Math.round(n);
    }
  }
  const bools: (keyof AccountSample)[] = ["hasProfilePicture", "isPrivate", "isVerified"];
  for (const k of bools) {
    const b = toBoolean(r[k]);
    if (b !== undefined) (acc as unknown as Record<string, unknown>)[k] = b;
  }
  // hasBio accepts boolean or raw bio text
  if (r.hasBio !== undefined) {
    const b = toBoolean(r.hasBio);
    acc.hasBio = b !== undefined ? b : sanitizeText(r.hasBio, 300).length > 0;
  }
  const last = toIsoDate(r.lastPostAt);
  if (last) acc.lastPostAt = last;
  const created = toIsoDate(r.createdAt);
  if (created) acc.createdAt = created;
  return acc;
}

export function rowToComment(rawRow: Record<string, unknown>, index: number): CommentData | { error: string } {
  const nestedAuthor = rawRow.author && typeof rawRow.author === "object" ? (rawRow.author as Record<string, unknown>) : undefined;
  const row = nestedAuthor ? { ...rawRow, author: nestedAuthor.username ?? nestedAuthor.handle ?? nestedAuthor.user } : rawRow;
  const r = normalizeKeys(row, COMMENT_ALIASES);
  const author = sanitizeUsername(r.authorUsername);
  if (!author) return { error: "missing or invalid author username" };
  const text = sanitizeText(r.text, 2200);
  if (!text) return { error: "empty comment text" };
  const c: CommentData = { id: sanitizeText(r.id, 64) || `row_${index}`, authorUsername: author, text };
  const t = toIsoDate(r.createdAt);
  if (t) c.createdAt = t;
  const likes = toNumber(r.likesCount);
  if (likes !== undefined) c.likesCount = Math.max(0, Math.round(likes));
  // optional nested author profile data (JSON) or flat columns
  if (nestedAuthor) {
    const a = rowToAccount({ ...nestedAuthor, username: author });
    if (!("error" in a)) c.author = a;
  } else {
    const flat = rowToAccount({ ...row, username: author });
    if (!("error" in flat) && (flat.followersCount !== undefined || flat.postsCount !== undefined || flat.followingCount !== undefined)) c.author = flat;
  }
  return c;
}

const JsonWrapper = z.object({
  type: z.enum(["accounts", "comments"]).optional(),
  populationSize: z.number().int().nonnegative().optional(),
  followersTotal: z.number().int().nonnegative().optional(),
  totalComments: z.number().int().nonnegative().optional(),
  method: z.string().max(200).optional(),
  accounts: z.array(z.record(z.string(), z.unknown())).optional(),
  followers: z.array(z.record(z.string(), z.unknown())).optional(),
  comments: z.array(z.record(z.string(), z.unknown())).optional(),
  data: z.array(z.record(z.string(), z.unknown())).optional(),
});

export function detectType(rows: Record<string, unknown>[], hint?: DatasetType): DatasetType {
  if (hint) return hint;
  const keys = new Set(rows.slice(0, 20).flatMap((r) => Object.keys(r).map((k) => k.toLowerCase().replace(/[\s-]+/g, "_"))));
  const commentKeys = ["text", "comment", "body", "content", "message"];
  if (commentKeys.some((k) => keys.has(k))) return "comments";
  return "accounts";
}

export interface ImportOptions {
  maxRows: number;
  typeHint?: DatasetType;
  populationSize?: number;
  totalComments?: number;
}

export function importFromRows(rows: Record<string, unknown>[], opts: ImportOptions): ImportedDataset {
  const type = detectType(rows, opts.typeHint);
  const rejected: { row: number; reason: string }[] = [];
  const limited = rows.slice(0, opts.maxRows);
  if (type === "comments") {
    const comments: CommentData[] = [];
    limited.forEach((row, i) => {
      const c = rowToComment(row, i);
      if ("error" in c) {
        if (rejected.length < 200) rejected.push({ row: i + 1, reason: c.error });
      } else comments.push(c);
    });
    return { type, comments, rowsReceived: rows.length, rejected, totalComments: opts.totalComments };
  }
  const accounts: AccountSample[] = [];
  const seen = new Set<string>();
  limited.forEach((row, i) => {
    const a = rowToAccount(row);
    if ("error" in a) {
      if (rejected.length < 200) rejected.push({ row: i + 1, reason: a.error });
      return;
    }
    if (seen.has(a.username)) {
      if (rejected.length < 200) rejected.push({ row: i + 1, reason: `duplicate username ${a.username}` });
      return;
    }
    seen.add(a.username);
    accounts.push(a);
  });
  return { type, accounts, rowsReceived: rows.length, rejected, populationSize: opts.populationSize };
}

export function importCsv(text: string, opts: ImportOptions): ImportedDataset {
  const parsed = parseCsv(text, { maxRows: opts.maxRows + 1 });
  if (parsed.headers.length === 0) return { type: opts.typeHint ?? "accounts", rowsReceived: 0, rejected: [{ row: 0, reason: "CSV has no header row" }] };
  return importFromRows(parsed.rows, opts);
}

export function importJson(text: string, opts: ImportOptions): ImportedDataset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { type: opts.typeHint ?? "accounts", rowsReceived: 0, rejected: [{ row: 0, reason: `Invalid JSON: ${(e as Error).message.slice(0, 120)}` }] };
  }
  if (Array.isArray(parsed)) {
    return importFromRows(parsed.filter((x): x is Record<string, unknown> => !!x && typeof x === "object"), opts);
  }
  const w = JsonWrapper.safeParse(parsed);
  if (!w.success) return { type: opts.typeHint ?? "accounts", rowsReceived: 0, rejected: [{ row: 0, reason: "JSON must be an array of rows or an object with accounts/followers/comments arrays" }] };
  const d = w.data;
  const rows = d.comments ?? d.accounts ?? d.followers ?? d.data ?? [];
  const typeHint = d.type ?? (d.comments ? "comments" : d.accounts || d.followers ? "accounts" : opts.typeHint);
  const res = importFromRows(rows, { ...opts, typeHint, populationSize: d.populationSize ?? d.followersTotal ?? opts.populationSize, totalComments: d.totalComments ?? opts.totalComments });
  if (d.method) res.method = sanitizeText(d.method, 200);
  return res;
}
