import { ManualCheckForm } from "@/components/ManualCheckForm";

export const metadata = { title: "Screening check — Instagram Authenticity Analyzer" };

export default async function CheckPage({ searchParams }: { searchParams: Promise<{ u?: string }> }) {
  const { u } = await searchParams;
  return (
    <div className="space-y-6">
      <div className="pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Screening check (no credentials)</h1>
        <p className="mt-2 max-w-3xl text-muted">Open the artist&apos;s public profile, copy the numbers you see, paste them here. The engine computes the real engagement rate, compares it with accounts of the same size and flags the fingerprints of bought followers or likes: engagement far below the benchmark, suspiciously uniform like counts, comment-starved posts and outliers. Takes about two minutes per artist.</p>
      </div>
      <ManualCheckForm initialUsername={u ? `@${u.replace(/^@/, "").slice(0, 30)}` : ""} />
    </div>
  );
}
