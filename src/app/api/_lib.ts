import { NextResponse } from "next/server";
import { z } from "zod";
import type { ApiEnvelope, ApiError, ConfidenceReport } from "@/types/results";
import { FEATURE_KEYS, mergeWeights, weightsFromEnv, type SuspicionWeights } from "@/config/weights";

export const WeightsSchema = z.partialRecord(z.enum(FEATURE_KEYS), z.number().min(0).max(10)).optional();

export function resolveWeights(overrides?: Partial<Record<string, number>> | null): SuspicionWeights {
  return mergeWeights({ ...weightsFromEnv(), ...(overrides ?? {}) });
}

export function envelope<T>(result: T, score: number | undefined | null, confidence: ConfidenceReport): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json({
    ok: true,
    score: typeof score === "number" ? score : null,
    confidence: confidence.level,
    dataCoverage: confidence.dataCoverage,
    sampleSize: confidence.sampleSize,
    result,
  });
}

export function apiError(status: number, error: string, details?: unknown): NextResponse<ApiError> {
  return NextResponse.json({ ok: false, error, details }, { status });
}

export const MAX_UPLOAD_BYTES = (() => {
  const n = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isFinite(n) && n > 0 ? n : 5 * 1024 * 1024;
})();

export const MAX_DATASET_ROWS = (() => {
  const n = Number(process.env.MAX_DATASET_ROWS);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 500_000) : 50_000;
})();
