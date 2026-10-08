import type { InstagramDataProvider } from "./types";
import { available, unavailable, type Availability, type ProfileData, type PostData, type FollowerSample, type CommentSample, type LikerSample } from "@/types/domain";
import { DEMO_PROFILES, findDemoProfile, demoProfileData, synthPosts, synthAccounts, synthComments } from "@/data/demoDataset";

const SRC = "mock" as const;

/**
 * MockProvider — serves clearly labelled DEMO DATA for development and tests.
 * Any username or post that is not part of the demo dataset is reported as
 * unavailable, never invented.
 */
export class MockProvider implements InstagramDataProvider {
  readonly name = "MockProvider (DEMO DATA)";
  readonly isDemo = true;
  private readonly now: number;

  constructor(opts: { now?: number } = {}) {
    this.now = opts.now ?? Date.parse("2026-10-08T12:00:00Z");
  }

  describe(): string {
    return `Synthetic demo dataset. Known demo usernames: ${DEMO_PROFILES.map((p) => "@" + p.username).join(", ")}. Demo post URLs look like https://www.instagram.com/p/DEMOORGA001/.`;
  }

  async getProfile(username: string): Promise<Availability<ProfileData>> {
    const spec = findDemoProfile(username);
    if (!spec) return unavailable(`@${username.replace(/^@/, "")} es una cuenta real y la app está en modo DEMO (sin fuente de datos conectada). Conecta la API oficial de Meta en la página Setup o carga un dataset en Import Data.`, SRC);
    return available(demoProfileData(spec, this.now), SRC, true);
  }

  async getPublicPosts(username: string, limit = 12): Promise<Availability<PostData[]>> {
    const spec = findDemoProfile(username);
    if (!spec) return unavailable("Profile not in DEMO dataset", SRC);
    if (spec.isPrivate) return unavailable("Account is private; public posts are not accessible", SRC);
    return available(synthPosts(spec, this.now).slice(0, limit), SRC, true);
  }

  private findPost(ref: { shortcode?: string; id?: string; url?: string }): { spec: (typeof DEMO_PROFILES)[number]; post: PostData } | undefined {
    const code = (ref.shortcode ?? ref.id ?? "").toUpperCase();
    if (!code) return undefined;
    for (const spec of DEMO_PROFILES) {
      if (spec.isPrivate) continue;
      const post = synthPosts(spec, this.now).find((p) => p.shortcode === code);
      if (post) return { spec, post };
    }
    return undefined;
  }

  async getPost(ref: { shortcode?: string; id?: string; url?: string }): Promise<Availability<PostData>> {
    const found = this.findPost(ref);
    if (!found) return unavailable(`Post ${ref.shortcode ?? ref.id ?? ref.url ?? ""} is not in the DEMO dataset.`, SRC);
    return available(found.post, SRC, true);
  }

  async getFollowerSample(username: string, limit = 1000): Promise<Availability<FollowerSample>> {
    const spec = findDemoProfile(username);
    if (!spec) return unavailable("Profile not in DEMO dataset", SRC);
    if (spec.isPrivate) return unavailable("Account is private; follower list is not accessible", SRC);
    if (spec.sampleSize === 0) return unavailable("This demo source exposes no follower list for this account (mirrors what the official Graph API provides).", SRC);
    const n = Math.min(limit, spec.sampleSize);
    const accounts = synthAccounts(`${spec.username}:followers`, n, spec.botShare, spec.inactiveShare, this.now);
    return available({ accounts, meta: { sampleSize: n, populationSize: spec.followers, method: "DEMO: uniform synthetic sample", representative: true } }, SRC, true);
  }

  async getComments(postId: string, limit = 500): Promise<Availability<CommentSample>> {
    const found = this.findPost({ shortcode: postId });
    if (!found) return unavailable("Post not in DEMO dataset", SRC);
    if (found.spec.commentSampleSize === 0) return unavailable("No comment sample available for this demo post", SRC);
    const n = Math.min(limit, found.spec.commentSampleSize, found.post.commentsCount ?? found.spec.commentSampleSize);
    const comments = synthComments(found.spec, postId, Math.max(n, 0), this.now);
    return available({ comments, meta: { sampleSize: comments.length, populationSize: found.post.commentsCount, method: "DEMO: synthetic comment sample", representative: true } }, SRC, true);
  }

  async getLikers(postId: string, limit = 500): Promise<Availability<LikerSample>> {
    const found = this.findPost({ shortcode: postId });
    if (!found) return unavailable("Post not in DEMO dataset", SRC);
    if (found.spec.likerSampleSize === 0) return unavailable("No liker sample available for this demo post", SRC);
    const n = Math.min(limit, found.spec.likerSampleSize, found.post.likesCount ?? 0);
    const accounts = synthAccounts(`${found.spec.username}:${postId}:likers`, n, found.spec.likerBotShare, 0.05, this.now);
    return available({ accounts, meta: { sampleSize: n, populationSize: found.post.likesCount, method: "DEMO: synthetic liker sample", representative: true } }, SRC, true);
  }
}
