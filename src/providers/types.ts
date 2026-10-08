import type { Availability, ProfileData, PostData, FollowerSample, CommentSample, LikerSample } from "@/types/domain";

/**
 * Contract every data source must implement.
 * Each method returns `Availability<T>`: either observed data or an explicit
 * reason why that data cannot be obtained legitimately from this source.
 *
 * Rules for implementations:
 *  - Only use official / authorized APIs or user-supplied datasets.
 *  - Never bypass authentication, rate limits, CAPTCHAs or privacy settings.
 *  - Never fabricate accounts, likes or comments. If the API does not expose
 *    a dataset (e.g. follower lists), return `unavailable` with a reason.
 */
export interface InstagramDataProvider {
  readonly name: string;
  readonly isDemo: boolean;
  /** Short human description of the source and its limits, shown in the UI. */
  describe(): string;
  getProfile(username: string): Promise<Availability<ProfileData>>;
  getPublicPosts(username: string, limit?: number): Promise<Availability<PostData[]>>;
  getPost(ref: { shortcode?: string; id?: string; url?: string }): Promise<Availability<PostData>>;
  getFollowerSample(username: string, limit?: number): Promise<Availability<FollowerSample>>;
  getComments(postId: string, limit?: number): Promise<Availability<CommentSample>>;
  getLikers(postId: string, limit?: number): Promise<Availability<LikerSample>>;
}
