import type { InstagramDataProvider } from "./types";
import { MockProvider } from "./MockProvider";
import { MetaGraphProvider } from "./MetaGraphProvider";

export type { InstagramDataProvider } from "./types";
export { MockProvider } from "./MockProvider";
export { MetaGraphProvider } from "./MetaGraphProvider";

let cached: InstagramDataProvider | null = null;

/**
 * Provider factory driven by INSTAGRAM_PROVIDER.
 *   mock        → MockProvider (default; DEMO DATA)
 *   meta-graph  → MetaGraphProvider (requires META_GRAPH_ACCESS_TOKEN + META_IG_BUSINESS_ACCOUNT_ID)
 * Falls back to mock (with a console warning) when a real provider is misconfigured.
 */
export function getProvider(): InstagramDataProvider {
  if (cached) return cached;
  const kind = (process.env.INSTAGRAM_PROVIDER ?? "mock").toLowerCase();
  if (kind === "meta-graph") {
    const accessToken = process.env.META_GRAPH_ACCESS_TOKEN;
    const businessAccountId = process.env.META_IG_BUSINESS_ACCOUNT_ID;
    if (accessToken && businessAccountId) {
      cached = new MetaGraphProvider({ accessToken, businessAccountId, apiVersion: process.env.META_GRAPH_API_VERSION || "v21.0" });
      return cached;
    }
    console.warn("[providers] INSTAGRAM_PROVIDER=meta-graph but META_GRAPH_ACCESS_TOKEN / META_IG_BUSINESS_ACCOUNT_ID missing. Falling back to MockProvider.");
  }
  cached = new MockProvider();
  return cached;
}

/** Test helper */
export function resetProviderCache(): void {
  cached = null;
}
