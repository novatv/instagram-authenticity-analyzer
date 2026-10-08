import { z } from "zod";
import { getProvider } from "@/providers";
import { analyzeProfile } from "@/analysis/analyzeProfile";
import { parseAnalyzeInput } from "@/utils/parseInput";
import { apiError, envelope, resolveWeights, WeightsSchema } from "../../_lib";

export const runtime = "nodejs";

const Body = z.object({ username: z.string().min(1).max(300), weights: WeightsSchema });

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return apiError(400, "Invalid request body", e instanceof z.ZodError ? e.issues : undefined);
  }
  const parsed = parseAnalyzeInput(body.username);
  if (parsed.kind !== "profile") return apiError(400, parsed.kind === "invalid" ? parsed.reason : "Expected a username, got a post URL");
  const result = await analyzeProfile(getProvider(), parsed.username, resolveWeights(body.weights));
  if ("error" in result) return apiError(404, result.error, { reason: result.reason, provider: getProvider().name, hint: getProvider().describe() });
  return envelope(result, result.score, result.confidence);
}
