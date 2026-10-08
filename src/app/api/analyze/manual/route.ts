import { z } from "zod";
import { ManualProvider } from "@/providers/ManualProvider";
import { analyzeProfile } from "@/analysis/analyzeProfile";
import { sanitizeUsername } from "@/utils/sanitize";
import { apiError, envelope, resolveWeights, WeightsSchema } from "../../_lib";

export const runtime = "nodejs";

const Body = z.object({
  username: z.string().min(1).max(60),
  followersCount: z.number().int().min(0).max(1e10),
  followingCount: z.number().int().min(0).max(1e10).optional(),
  postsCount: z.number().int().min(0).max(1e10).optional(),
  isVerified: z.boolean().optional(),
  recentPosts: z.array(z.object({
    likes: z.number().int().min(0).max(1e10),
    comments: z.number().int().min(0).max(1e10).optional(),
    views: z.number().int().min(0).max(1e11).optional(),
    kind: z.enum(["post", "reel"]).optional(),
  })).max(100),
  weights: WeightsSchema,
});

/** POST: public counts typed by the user → engagement-based profile analysis. Nothing is stored. */
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return apiError(400, "Invalid request body", e instanceof z.ZodError ? e.issues : undefined);
  }
  const username = sanitizeUsername(body.username);
  if (!username) return apiError(400, "Invalid username");
  const provider = new ManualProvider({ ...body, username });
  const result = await analyzeProfile(provider, username, resolveWeights(body.weights));
  if ("error" in result) return apiError(422, result.error, { reason: result.reason });
  return envelope(result, result.score, result.confidence);
}
