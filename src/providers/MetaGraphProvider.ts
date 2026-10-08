import type { InstagramDataProvider } from "./types";
import { available, unavailable, type Availability, type ProfileData, type PostData, type FollowerSample, type CommentSample, type LikerSample } from "@/types/domain";

const SRC = "meta-graph" as const;

interface MetaGraphConfig {
  accessToken: string;
  businessAccountId: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}

interface BusinessDiscovery {
  username: string;
  name?: string;
  biography?: string;
  website?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  profile_picture_url?: string;
  media?: { data?: GraphMedia[] };
}

interface GraphMedia {
  id: string;
  shortcode?: string;
  permalink?: string;
  media_type?: string;
  media_product_type?: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  timestamp?: string;
}

/**
 * MetaGraphProvider — official Instagram Graph API via Business Discovery.
 *
 * What it CAN provide (for public Professional accounts):
 *   - profile counts (followers, follows, media)
 *   - recent media with like/comment counts
 * What it CANNOT provide (so we return `unavailable`, never fabricate):
 *   - follower lists / samples
 *   - liker lists
 *   - comments of accounts you do not own
 *
 * Requires: Instagram Professional account linked to a Facebook Page,
 * a Meta app with instagram_basic + pages_read_engagement (+ business_management),
 * and a long-lived user/page access token.
 */
export class MetaGraphProvider implements InstagramDataProvider {
  readonly name = "Meta Graph API (Business Discovery + oEmbed)";
  readonly isDemo = false;
  private readonly cfg: Required<Omit<MetaGraphConfig, "fetchImpl">> & { fetchImpl: typeof fetch };

  constructor(cfg: MetaGraphConfig) {
    this.cfg = { apiVersion: "v21.0", ...cfg, fetchImpl: cfg.fetchImpl ?? fetch };
  }

  describe(): string {
    return "Official Meta Graph API. Provides public profile counts and recent media for Instagram Professional accounts via business_discovery. Follower, liker and third-party comment lists are not exposed by the API and are reported as unavailable.";
  }

  private async discovery(username: string, mediaLimit = 25): Promise<Availability<BusinessDiscovery>> {
    const u = username.replace(/^@/, "");
    if (!/^[a-z0-9._]{1,30}$/i.test(u)) return unavailable("Invalid username", SRC);
    const fields = `business_discovery.username(${u}){username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url,media.limit(${mediaLimit}){id,shortcode,permalink,media_type,media_product_type,caption,like_count,comments_count,timestamp}}`;
    const url = new URL(`https://graph.facebook.com/${this.cfg.apiVersion}/${encodeURIComponent(this.cfg.businessAccountId)}`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("access_token", this.cfg.accessToken);
    try {
      const res = await this.cfg.fetchImpl(url.toString(), { headers: { Accept: "application/json" } });
      const json = (await res.json()) as { business_discovery?: BusinessDiscovery; error?: { message?: string; code?: number } };
      if (!res.ok || json.error) {
        const msg = json.error?.message ?? `HTTP ${res.status}`;
        if (res.status === 429 || json.error?.code === 4 || json.error?.code === 17) return unavailable(`Rate limited by Meta Graph API: ${msg}. Try again later (no retries are forced).`, SRC);
        return unavailable(`Meta Graph API error: ${msg}`, SRC);
      }
      if (!json.business_discovery) return unavailable("Account not discoverable (not a public Professional account?)", SRC);
      return available(json.business_discovery, SRC);
    } catch (e) {
      return unavailable(`Network error contacting Meta Graph API: ${(e as Error).message}`, SRC);
    }
  }

  async getProfile(username: string): Promise<Availability<ProfileData>> {
    const d = await this.discovery(username, 1);
    if (d.status === "unavailable") return d;
    const b = d.data;
    return available({
      username: b.username,
      fullName: b.name,
      biography: b.biography,
      externalUrl: b.website,
      isPrivate: false,
      hasProfilePicture: typeof b.profile_picture_url === "string" ? true : undefined,
      followersCount: b.followers_count,
      followingCount: b.follows_count,
      postsCount: b.media_count,
      lastPostAt: b.media?.data?.[0]?.timestamp,
    }, SRC);
  }

  async getPublicPosts(username: string, limit = 25): Promise<Availability<PostData[]>> {
    const d = await this.discovery(username, Math.min(50, limit));
    if (d.status === "unavailable") return d;
    const media = d.data.media?.data ?? [];
    return available(media.map((m) => mapMedia(m, d.data.username)), SRC);
  }

  /** Resolve the owner of a public post/reel URL via the official oEmbed endpoint. */
  private async resolveOwner(url: string): Promise<Availability<string>> {
    const u = new URL(`https://graph.facebook.com/${this.cfg.apiVersion}/instagram_oembed`);
    u.searchParams.set("url", url);
    u.searchParams.set("fields", "author_name");
    u.searchParams.set("access_token", this.cfg.accessToken);
    try {
      const res = await this.cfg.fetchImpl(u.toString(), { headers: { Accept: "application/json" } });
      const json = (await res.json()) as { author_name?: string; error?: { message?: string } };
      if (!res.ok || json.error || !json.author_name) return unavailable(`Could not resolve the post owner via oEmbed: ${json.error?.message ?? `HTTP ${res.status}`}`, SRC);
      return available(json.author_name, SRC);
    } catch (e) {
      return unavailable(`Network error contacting Meta oEmbed: ${(e as Error).message}`, SRC);
    }
  }

  /**
   * Paste a post/reel link → owner via oEmbed → owner's recent media via Business
   * Discovery → the media whose permalink matches the shortcode.
   */
  async getPost(ref: { shortcode?: string; id?: string; url?: string }): Promise<Availability<PostData>> {
    const code = ref.shortcode ?? ref.id;
    if (!code) return unavailable("No shortcode supplied", SRC);
    const url = ref.url || `https://www.instagram.com/p/${code}/`;
    const owner = await this.resolveOwner(url);
    if (owner.status === "unavailable") return owner;
    const d = await this.discovery(owner.data, 50);
    if (d.status === "unavailable") return d;
    const media = (d.data.media?.data ?? []).map((m) => mapMedia(m, d.data.username));
    const post = media.find((m) => m.shortcode === code);
    if (!post) return unavailable(`Post ${code} belongs to @${d.data.username} but is not among its 50 most recent media exposed by the Graph API.`, SRC);
    return available(post, SRC);
  }

  async getFollowerSample(): Promise<Availability<FollowerSample>> {
    return unavailable("The official Instagram Graph API does not expose follower lists for third-party accounts. Import a legitimately obtained dataset to analyze audience quality.", SRC);
  }

  async getComments(): Promise<Availability<CommentSample>> {
    return unavailable("Comments are only available via the Graph API for media owned by the connected account. Import comments as CSV/JSON instead.", SRC);
  }

  async getLikers(): Promise<Availability<LikerSample>> {
    return unavailable("The Instagram Graph API does not expose liker lists.", SRC);
  }
}

function mapMedia(m: GraphMedia, owner: string): PostData {
  const code = m.shortcode ?? m.permalink?.match(/\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/)?.[1];
  return {
    id: m.id,
    shortcode: code,
    url: m.permalink,
    kind: m.media_product_type === "REELS" || m.media_type === "VIDEO" ? "reel" : "post",
    ownerUsername: owner,
    caption: m.caption,
    likesCount: m.like_count,
    commentsCount: m.comments_count,
    publishedAt: m.timestamp,
  };
}
