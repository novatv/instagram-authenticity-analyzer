import type { InstagramDataProvider } from "./types";
import { available, unavailable, type Availability, type ProfileData, type PostData, type FollowerSample, type CommentSample, type LikerSample } from "@/types/domain";

export interface ManualInput {
  username: string;
  followersCount: number;
  followingCount?: number;
  postsCount?: number;
  isVerified?: boolean;
  recentPosts: { likes: number; comments?: number; views?: number; kind?: "post" | "reel" }[];
}

const SRC = "dataset" as const;

/**
 * ManualProvider — public counts typed by the user from what they see on the
 * public profile (followers, posts, likes/comments of recent posts).
 * No credentials, no scraping. Follower / liker / comment samples are
 * reported as unavailable because the user did not supply them.
 */
export class ManualProvider implements InstagramDataProvider {
  readonly name = "Manual entry (public counts typed by the user)";
  readonly isDemo = false;
  constructor(private readonly input: ManualInput) {}

  describe(): string {
    return "Numbers entered manually from the public profile. Engagement analysis only; audience sampling is not available.";
  }

  async getProfile(username: string): Promise<Availability<ProfileData>> {
    if (username.toLowerCase() !== this.input.username.toLowerCase()) return unavailable("Username does not match the entered data", SRC);
    return available({
      username: this.input.username,
      isPrivate: false,
      isVerified: this.input.isVerified,
      followersCount: this.input.followersCount,
      followingCount: this.input.followingCount,
      postsCount: this.input.postsCount,
    }, SRC);
  }

  async getPublicPosts(): Promise<Availability<PostData[]>> {
    if (this.input.recentPosts.length === 0) return unavailable("No recent post counts were entered", SRC);
    return available(this.input.recentPosts.map((p, i) => ({
      id: `manual_${i + 1}`,
      kind: p.kind ?? "unknown",
      ownerUsername: this.input.username,
      likesCount: p.likes,
      commentsCount: p.comments,
      viewsCount: p.views,
    })), SRC);
  }

  async getPost(): Promise<Availability<PostData>> {
    return unavailable("Manual mode does not resolve post URLs", SRC);
  }
  async getFollowerSample(): Promise<Availability<FollowerSample>> {
    return unavailable("No follower sample was provided. Ask the artist for an export and load it in Import Data.", SRC);
  }
  async getComments(): Promise<Availability<CommentSample>> {
    return unavailable("No comments were provided", SRC);
  }
  async getLikers(): Promise<Availability<LikerSample>> {
    return unavailable("No liker sample was provided", SRC);
  }
}
