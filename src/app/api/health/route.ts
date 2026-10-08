import { NextResponse } from "next/server";
import { getProvider } from "@/providers";

export function GET() {
  const p = getProvider();
  return NextResponse.json({ ok: true, provider: p.name, isDemo: p.isDemo, description: p.describe() });
}
