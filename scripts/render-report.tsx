/**
 * CLI: generate the same PDF report the UI offers, without a browser.
 *   npm run report -- @demo_inflated [out.pdf]
 *   npm run report -- https://www.instagram.com/p/DEMOINFL001/ [out.pdf]
 */
import { writeFileSync } from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { getProvider } from "@/providers";
import { analyzeProfile } from "@/analysis/analyzeProfile";
import { analyzePost } from "@/analysis/analyzePost";
import { parseAnalyzeInput } from "@/utils/parseInput";
import { weightsFromEnv } from "@/config/weights";
import { ReportDocument } from "@/report/ReportDocument";

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("usage: tsx scripts/render-report.tsx <@username|post url> [out.pdf]");
    process.exit(1);
  }
  const parsed = parseAnalyzeInput(input);
  if (parsed.kind === "invalid") throw new Error(parsed.reason);
  const provider = getProvider();
  const weights = weightsFromEnv();
  const result = parsed.kind === "profile" ? await analyzeProfile(provider, parsed.username, weights) : await analyzePost(provider, { shortcode: parsed.shortcode, url: parsed.url }, weights);
  if ("error" in result) throw new Error(`${result.error}: ${result.reason}`);
  const buf = await renderToBuffer(<ReportDocument r={result} />);
  const out = process.argv[3] ?? `authenticity-report-${parsed.kind === "profile" ? parsed.username : parsed.shortcode}.pdf`;
  writeFileSync(out, buf);
  console.log(`wrote ${out} (${buf.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
