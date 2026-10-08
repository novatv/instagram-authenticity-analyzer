import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instagram Authenticity Analyzer",
  description: "Estimated audience & engagement authenticity analysis with explicit confidence and data provenance. Estimates, never verdicts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/20 text-accent"><ShieldCheck size={18} /></span>
              <span className="font-semibold tracking-tight">Instagram Authenticity Analyzer</span>
              <span className="ml-2 hidden rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted sm:inline">estimates · not verdicts</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 text-muted hover:bg-panel-2 hover:text-text">Analyze</Link>
              <Link href="/check" className="rounded-md px-3 py-1.5 text-muted hover:bg-panel-2 hover:text-text">Screening check</Link>
              <Link href="/import" className="rounded-md px-3 py-1.5 text-muted hover:bg-panel-2 hover:text-text">Import data</Link>
              <Link href="/methodology" className="rounded-md px-3 py-1.5 text-muted hover:bg-panel-2 hover:text-text">Methodology</Link>
              <Link href="/setup" className="rounded-md border border-warn/40 px-3 py-1.5 text-warn hover:bg-warn/10">Setup</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-muted">
          All scores are statistical estimates derived from detected signals. No account is labelled a bot from a single signal. Only data legitimately available from the active provider or user-supplied datasets is processed; imported files are never stored.
        </footer>
      </body>
    </html>
  );
}
