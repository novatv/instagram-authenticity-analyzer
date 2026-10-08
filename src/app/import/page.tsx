import { ImportForm } from "@/components/ImportForm";
import { MAX_DATASET_ROWS, MAX_UPLOAD_BYTES } from "@/app/api/_lib";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div className="pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Import data</h1>
        <p className="mt-2 max-w-3xl text-muted">Analyze large follower or comment datasets that you obtained legitimately (official API exports, your own account data, authorized vendors). The same scoring engine runs on your rows, with confidence based on your sample size and the fields you provide.</p>
      </div>
      <ImportForm maxBytes={MAX_UPLOAD_BYTES} maxRows={MAX_DATASET_ROWS} />
    </div>
  );
}
