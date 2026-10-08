import { Suspense } from "react";
import Link from "next/link";
import { AnalyzeForm } from "@/components/AnalyzeForm";
import { getProvider } from "@/providers";
import { DEMO_PROFILES } from "@/data/demoDataset";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const provider = getProvider();
  return (
    <div className="space-y-6">
      <div className="pt-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Estimate how organic an Instagram audience really is.</h1>
        <p className="mt-2 max-w-3xl text-muted">Paste a public username or a post/reel URL. The engine collects only legitimately available data, extracts independent signals, scores them with a weighted multi-feature model and tells you exactly what is <span className="text-ok">observed</span>, what is <span className="text-accent">estimated</span>, and what is <span className="text-muted">unavailable</span>.</p>
        {provider.isDemo ? (
          <div className="mt-3 max-w-3xl rounded-lg border border-warn/40 bg-warn/5 p-3 text-sm">
            <b className="text-warn">Modo DEMO.</b> No hay ninguna fuente de datos real conectada: solo funcionan las cuentas de demo de abajo. Cualquier cuenta real devolverá INSUFFICIENT DATA.{" "}
            <Link href="/check" className="font-semibold text-accent hover:underline">Verificar una cuenta real ahora con sus números públicos (Screening check) →</Link>{" "}
            <span className="text-muted">o</span>{" "}
            <Link href="/setup" className="font-semibold text-accent hover:underline">conectar la API oficial de Meta →</Link>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">Active provider: <b className="text-text">{provider.name}</b></p>
        )}
      </div>
      <Suspense fallback={null}>
        <AnalyzeForm demoUsernames={provider.isDemo ? DEMO_PROFILES.map((p) => p.username) : []} />
      </Suspense>
    </div>
  );
}
