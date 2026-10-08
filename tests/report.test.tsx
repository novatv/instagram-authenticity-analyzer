import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { MockProvider } from "@/providers/MockProvider";
import { analyzeProfile } from "@/analysis/analyzeProfile";
import { analyzePost } from "@/analysis/analyzePost";
import { DEFAULT_SUSPICION_WEIGHTS } from "@/config/weights";
import { ReportDocument } from "@/report/ReportDocument";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const mock = new MockProvider({ now: NOW });

describe("PDF report", () => {
  it("renders a profile report", async () => {
    const r = await analyzeProfile(mock, "demo_inflated", DEFAULT_SUSPICION_WEIGHTS, NOW);
    if ("error" in r) throw new Error("unexpected");
    const buf = await renderToBuffer(<ReportDocument r={r} />);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(buf.length).toBeGreaterThan(5000);
  });
  it("renders a post report and an insufficient-data profile report", async () => {
    const p = await analyzePost(mock, { shortcode: "DEMOINFL001", url: "" }, DEFAULT_SUSPICION_WEIGHTS, NOW);
    if ("error" in p) throw new Error("unexpected");
    expect((await renderToBuffer(<ReportDocument r={p} />)).subarray(0, 4).toString()).toBe("%PDF");
    const priv = await analyzeProfile(mock, "demo_private", DEFAULT_SUSPICION_WEIGHTS, NOW);
    if ("error" in priv) throw new Error("unexpected");
    expect((await renderToBuffer(<ReportDocument r={priv} />)).subarray(0, 4).toString()).toBe("%PDF");
  });
});
