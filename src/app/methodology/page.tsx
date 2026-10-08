import { DEFAULT_SUSPICION_WEIGHTS, FEATURE_LABELS, FEATURE_DESCRIPTIONS, FEATURE_KEYS } from "@/config/weights";
import { ENGAGEMENT_TIERS } from "@/analysis/engagement/benchmarks";
import { DEFAULT_COMMENT_WEIGHTS } from "@/analysis/comments/commentAnalysis";

export const metadata = { title: "Methodology — Instagram Authenticity Analyzer" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel p-5"><h2 className="mb-3 text-lg font-semibold">{title}</h2><div className="space-y-2 text-sm leading-relaxed text-muted">{children}</div></section>;
}

export default function MethodologyPage() {
  return (
    <div className="space-y-5">
      <div className="pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Methodology</h1>
        <p className="mt-2 max-w-3xl text-muted">How scores are produced, what they mean, and — above all — what they do not mean. Every output is an estimate built from signals; nothing here proves that any account is automated.</p>
      </div>

      <Section title="1. Observed · Estimated · Unavailable">
        <p>Every number in the app carries one of three statuses:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b className="text-ok">OBSERVED</b> — returned by the data source as-is (follower counts, like counts, comment text).</li>
          <li><b className="text-accent">ESTIMATED</b> — produced by the model from observed signals. Proportions and scaled counts carry a 95% Wilson interval; the UI shows ranges (e.g. 18%–25%) instead of false precision.</li>
          <li><b className="text-muted">UNAVAILABLE</b> — the active provider does not legitimately expose it. The UI shows <i>INSUFFICIENT DATA</i> with the exact missing inputs. Nothing is invented and no random numbers are ever displayed.</li>
        </ul>
      </Section>

      <Section title="2. Pipeline">
        <ol className="list-decimal space-y-1 pl-5">
          <li><b className="text-text">Data collection</b> — a provider implementing <code className="mono">InstagramDataProvider</code> (getProfile, getPublicPosts, getPost, getFollowerSample, getComments, getLikers). Each call returns data or an explicit <i>unavailable</i> reason.</li>
          <li><b className="text-text">Feature extraction</b> — independent 0–1 activations per account / comment / post. A feature that cannot be evaluated returns <i>null</i>, never 0, so coverage stays honest.</li>
          <li><b className="text-text">Scoring</b> — weighted average over evaluable features, damped when only one or two signals fire, normalized to 0–100.</li>
          <li><b className="text-text">Confidence estimation</b> — data coverage × sample adequacy → LOW / MEDIUM / HIGH.</li>
          <li><b className="text-text">Presentation</b> — every score ships with a “Why this score?” explanation listing the contributing signals.</li>
        </ol>
      </Section>

      <Section title="3. Account suspicion model">
        <p>suspicion = Σ(activation<sub>i</sub> × weight<sub>i</sub>) / Σ(weight<sub>i</sub> over evaluable features) × damping × 100, where damping = 0.5 for a single active signal, 0.75 for two, 1.0 for three or more. <b className="text-text">One signal alone can never push an account past the lower bands.</b></p>
        <table className="mt-2 w-full text-xs">
          <thead className="text-left text-muted"><tr><th className="py-1">Feature</th><th className="py-1">Default weight</th><th className="py-1">What it measures</th></tr></thead>
          <tbody>{FEATURE_KEYS.map((k) => <tr key={k} className="border-t border-line"><td className="py-1 pr-2 text-text">{FEATURE_LABELS[k]}</td><td className="mono py-1 pr-2">{DEFAULT_SUSPICION_WEIGHTS[k]}</td><td className="py-1">{FEATURE_DESCRIPTIONS[k]}</td></tr>)}</tbody>
        </table>
        <p className="mt-2">Weights are configurable through <code className="mono">SUSPICION_WEIGHTS_JSON</code> or a per-request <code className="mono">weights</code> object. Bands: 0–25 Likely Authentic · 26–50 Some Suspicious Signals · 51–75 Highly Suspicious · 76–100 Very High Suspicion.</p>
        <p>Rejected heuristics: “username contains digits ⇒ bot”, “no bio ⇒ bot”, “private ⇒ bot”. These only contribute as weak, weighted components in combination with others.</p>
      </Section>

      <Section title="4. Audience aggregation">
        <p>Requires a follower sample of at least 30 accounts. Shares of each band become the audience estimates; <i>bot-like</i> = Highly Suspicious + Very High Suspicion, <i>suspicious</i> = everything above Likely Authentic. Inactive and mass-following percentages are only shown when the sample contains the needed fields. Counts are scaled to the observed follower total with a finite-population-corrected Wilson interval. Bot/Fake score = ½ · mean account suspicion + ½ · band-weighted suspicious share.</p>
      </Section>

      <Section title="5. Engagement model">
        <p>Engagement rate = median over recent posts of (likes + comments) / followers — the median is robust to a single viral post. The expected rate comes from a reference table by follower tier and is clearly labelled as an estimate:</p>
        <table className="mt-1 w-full max-w-md text-xs"><tbody>{ENGAGEMENT_TIERS.map((t) => <tr key={t.label} className="border-t border-line"><td className="py-1 text-text">{t.label} followers</td><td className="mono py-1">{t.expectedRatePct}% ± {t.spreadPct}</td></tr>)}</tbody></table>
        <p className="mt-2">Anomaly components: engagement far above (×3+) or far below (&lt;25%) the benchmark, extremely low comments per 100 likes on well-liked posts, unusually uniform like counts across posts (MAD/median &lt; 4%, a known purchased-likes fingerprint) and robust-z outliers (MAD-based z ≥ 3.5).</p>
      </Section>

      <Section title="6. Comment model">
        <p>Per-comment features with weights: {Object.entries(DEFAULT_COMMENT_WEIGHTS).map(([k, v]) => `${k} ${v}`).join(" · ")}. Exact duplicates require the same normalized text from ≥ 2 different accounts; near-duplicates use character 3-shingle Jaccard ≥ 0.8; temporal bursts are windows with ≥ 5 comments much faster than the median inter-arrival gap. Short comments (“nice”, “🔥”) are <b className="text-text">not</b> flagged on their own.</p>
      </Section>

      <Section title="7. Statistics used">
        <p>Median, percentiles, z-scores, robust z-scores (MAD × 1.4826), Tukey IQR fences, Shannon entropy of usernames and comment text, Wilson score intervals with finite population correction, temporal clustering, duplicate detection, ratio analysis.</p>
      </Section>

      <Section title="8. Confidence">
        <p>Data coverage is a weighted availability of the facets the model wants (profile counts, posts, follower sample, comment sample, liker sample…). Sample adequacy combines the Wilson half-width at p = 0.5, a log-scaled absolute size term and the sampling fraction. HIGH needs coverage ≥ 70% and ≥ 300 sampled accounts; MEDIUM needs ≥ 50% and ≥ 100; everything else is LOW. Thirty accounts sampled from a two-million-follower audience are always LOW.</p>
      </Section>

      <Section title="9. Data sources & limits">
        <p>Only official or authorized sources: Meta Graph API (Business Discovery) provides profile counts and recent media for public professional accounts but no follower, liker or third-party comment lists — those metrics therefore show INSUFFICIENT DATA unless you import a dataset you are authorized to process. The app never bypasses authentication, rate limits, CAPTCHAs or privacy settings, and never accesses private profiles. Imported files are validated, size-limited, sanitized and processed in memory only.</p>
      </Section>
    </div>
  );
}
