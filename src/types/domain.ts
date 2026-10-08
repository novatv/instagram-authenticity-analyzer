/**
 * Domain types describing data that a provider can OBSERVE.
 * Every field that a provider may not be able to supply is optional.
 * The analysis layer must never assume an optional field exists.
 */

export type DataSourceKind = "mock" | "meta-graph" | "dataset";

export interface ProfileData {
  username: string;
  fullName?: string;
  biography?: string;
  isPrivate?: boolean;
  isVerified?: boolean;
  hasProfilePicture?: boolean;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  /** ISO date of the most recent public post, if known */
  lastPostAt?: string;
  /** ISO date of account creation, if known (rarely available) */
  createdAt?: string;
  externalUrl?: string;
}

export interface PostData {
  id: string;
  shortcode?: string;
  url?: string;
  kind: "post" | "reel" | "unknown";
  ownerUsername?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  viewsCount?: number;
  /** ISO timestamp */
  publishedAt?: string;
}

/**
 * A follower / liker / commenter account as observed in a sample.
 * Only `username` is required; everything else is optional on purpose.
 */
export interface AccountSample {
  username: string;
  fullName?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  hasProfilePicture?: boolean;
  hasBio?: boolean;
  isPrivate?: boolean;
  isVerified?: boolean;
  /** ISO date of the most recent post, if known */
  lastPostAt?: string;
  /** ISO date of account creation, if known */
  createdAt?: string;
}

export interface CommentData {
  id: string;
  authorUsername: string;
  text: string;
  /** ISO timestamp if known */
  createdAt?: string;
  likesCount?: number;
  /** Optional observed author details, if the source provides them */
  author?: AccountSample;
}

export interface SampleMeta {
  /** Number of accounts actually observed in the sample */
  sampleSize: number;
  /** Known population size (e.g. followers total) if available */
  populationSize?: number;
  /** How the sample was obtained (free text, shown in UI) */
  method: string;
  /** Whether the sample can be considered representative (random/uniform) */
  representative: boolean;
}

export interface FollowerSample {
  accounts: AccountSample[];
  meta: SampleMeta;
}

export interface LikerSample {
  accounts: AccountSample[];
  meta: SampleMeta;
}

export interface CommentSample {
  comments: CommentData[];
  meta: SampleMeta;
}

/**
 * Standard result wrapper for anything a provider may be unable to deliver.
 * `unavailable` must carry a human-readable reason so the UI can explain
 * exactly which information is missing.
 */
export type Availability<T> =
  | { status: "available"; data: T; source: DataSourceKind; isDemo?: boolean }
  | { status: "unavailable"; reason: string; source: DataSourceKind };

export const unavailable = <T>(reason: string, source: DataSourceKind): Availability<T> => ({
  status: "unavailable",
  reason,
  source,
});

export const available = <T>(data: T, source: DataSourceKind, isDemo = false): Availability<T> => ({
  status: "available",
  data,
  source,
  isDemo,
});
