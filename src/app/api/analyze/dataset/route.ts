import { z } from "zod";
import { analyzeDataset } from "@/analysis/analyzeDataset";
import { importCsv, importJson, type DatasetType } from "@/utils/datasetImport";
import { apiError, envelope, resolveWeights, MAX_DATASET_ROWS, MAX_UPLOAD_BYTES } from "../../_lib";

export const runtime = "nodejs";

const Meta = z.object({
  type: z.enum(["accounts", "comments"]).optional(),
  populationSize: z.coerce.number().int().nonnegative().optional(),
  totalComments: z.coerce.number().int().nonnegative().optional(),
  weights: z.string().optional(),
});

/**
 * POST multipart/form-data: file=<csv|json>, type?, populationSize?, totalComments?, weights?(JSON)
 * or application/json: { format: "csv"|"json", content: string, type?, populationSize?, totalComments?, weights? }
 * Datasets are processed in memory only and never persisted.
 */
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  let text = "";
  let format: "csv" | "json" | null = null;
  let meta: z.infer<typeof Meta> = {};

  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return apiError(400, "Missing file field");
      if (file.size > MAX_UPLOAD_BYTES) return apiError(413, `File exceeds ${MAX_UPLOAD_BYTES} bytes`);
      const name = file.name.toLowerCase();
      format = name.endsWith(".json") ? "json" : name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt") ? "csv" : null;
      if (!format) {
        const t = (file.type || "").toLowerCase();
        format = t.includes("json") ? "json" : t.includes("csv") || t.includes("text") ? "csv" : null;
      }
      if (!format) return apiError(415, "Only .csv and .json files are accepted");
      text = await file.text();
      meta = Meta.parse({
        type: form.get("type") || undefined,
        populationSize: form.get("populationSize") || undefined,
        totalComments: form.get("totalComments") || undefined,
        weights: form.get("weights") || undefined,
      });
    } else {
      const body = (await req.json()) as { format?: string; content?: string; type?: DatasetType; populationSize?: number; totalComments?: number; weights?: Record<string, number> };
      if (typeof body.content !== "string") return apiError(400, "Missing content");
      if (body.content.length > MAX_UPLOAD_BYTES) return apiError(413, `Content exceeds ${MAX_UPLOAD_BYTES} bytes`);
      format = body.format === "json" ? "json" : body.format === "csv" ? "csv" : body.content.trim().startsWith("{") || body.content.trim().startsWith("[") ? "json" : "csv";
      text = body.content;
      meta = Meta.parse({ type: body.type, populationSize: body.populationSize, totalComments: body.totalComments, weights: body.weights ? JSON.stringify(body.weights) : undefined });
    }
  } catch (e) {
    return apiError(400, "Invalid request", e instanceof z.ZodError ? e.issues : (e as Error).message);
  }

  let weightOverrides: Record<string, number> | undefined;
  if (meta.weights) {
    try {
      weightOverrides = JSON.parse(meta.weights) as Record<string, number>;
    } catch {
      return apiError(400, "weights must be a JSON object");
    }
  }

  const opts = { maxRows: MAX_DATASET_ROWS, typeHint: meta.type, populationSize: meta.populationSize, totalComments: meta.totalComments };
  const ds = format === "json" ? importJson(text, opts) : importCsv(text, opts);
  if (ds.rowsReceived === 0) return apiError(422, "Dataset contains no rows", ds.rejected);
  const result = analyzeDataset(ds, resolveWeights(weightOverrides));
  const score = result.audience?.authenticityScore.value ?? result.commentsAnalysis?.authenticityScore.value;
  return envelope(result, score, result.confidence);
}
