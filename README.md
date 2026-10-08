# Instagram Authenticity Analyzer

A professional, dark-dashboard web app that produces an **estimated** authenticity analysis of an Instagram profile, post/reel, or an imported dataset of followers / comments.

> Every output is an **estimate** built from detected signals, shown with a **confidence level**, **data coverage** and **intervals**. The app never claims that an account *is* a bot, never invents data, and shows **INSUFFICIENT DATA** (with the exact missing inputs) whenever the active data source cannot legitimately supply what a metric needs.

## What it does

| Input | Output |
|---|---|
| `@username` | Followers / following / posts (observed), engagement rate vs. expected for similar accounts, **Organic / Overall Authenticity Score**, **Audience Authenticity Score**, **Bot/Fake Follower Score**, estimated real / suspicious / bot-like / inactive / mass-following shares (with 95% intervals), follower quality distribution, suspicion histogram, per-signal explanation, confidence. |
| `https://instagram.com/p/…` or `/reel/…` | Likes / comments / views (observed), engagement vs. expected, estimated authentic vs. suspicious likes and comments, Comment Authenticity Score, Engagement Authenticity Score, Overall Post Authenticity Score, duplicate groups, temporal bursts, flagged comments, confidence. |
| CSV / JSON import | Runs the same audience or comment engine on datasets you obtained legitimately (API exports, your own account data, authorized vendors). Processed in memory, never stored. |

Each dashboard has **Overview · Audience · Engagement · Posts · Comments · Signals · Methodology** tabs, a **“Why this score?”** panel per score, OBSERVED / ESTIMATED / UNAVAILABLE labels on every number, and a **Download PDF report** button.

## Install & run

```bash
npm install
cp .env.example .env.local   # optional: defaults to the mock provider
npm run dev                  # http://localhost:3200
```

Production:

```bash
npm run build && npm start
```

Docker:

```bash
docker compose up --build    # http://localhost:3200
```

Quality gates:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run check   # all of the above
```

## Demo data

The default provider is `MockProvider`, which serves a **synthetic, clearly labelled DEMO DATA** set. Known demo usernames:

| Username | Scenario |
|---|---|
| `@demo_organic` | healthy audience, HIGH confidence |
| `@demo_inflated` | heavy bot-like audience, flat like counts, spam comments |
| `@demo_mixed` | mixed audience |
| `@demo_small_sample` | 2M followers, only 30 sampled → LOW confidence, wide intervals |
| `@demo_noaudience` | posts but no follower sample → audience INSUFFICIENT DATA |
| `@demo_private` | private account → nothing beyond counts |

Demo posts: `https://www.instagram.com/p/DEMOORGA001/`, `…/p/DEMOINFL001/`, `…/p/DEMOMIXE001/` (numbers 001–012). Any other username or post is reported as *not available* — the app never shows random numbers for unknown inputs.

## Architecture

```
src/
  app/                      Next.js App Router (pages + API routes)
    api/analyze/profile     POST { username }
    api/analyze/post        POST { url }
    api/analyze/dataset     POST multipart file | { format, content }
    api/health              GET  active provider
    import/                 Import Data page
    methodology/            /methodology page
  components/               dashboards, forms, charts (Recharts), UI primitives
  analysis/
    statistics/             median, percentiles, z / robust z (MAD), IQR, entropy, Wilson intervals, temporal bursts
    followers/              per-account feature extraction → weighted suspicion score → audience aggregation
    engagement/             benchmarks by follower tier, engagement anomaly model, liker-sample analysis
    comments/               NLP features (normalization, shingles/Jaccard, emoji, spam, mentions) + comment scoring
    confidence/             data coverage × sample adequacy → LOW / MEDIUM / HIGH
    scoring/                weighted combination of available components
    analyzeProfile.ts, analyzePost.ts, analyzeDataset.ts   orchestrators
  providers/
    types.ts                InstagramDataProvider interface
    MockProvider.ts         DEMO DATA
    MetaGraphProvider.ts    official Meta Graph API (Business Discovery)
    index.ts                factory driven by INSTAGRAM_PROVIDER
  config/weights.ts         configurable feature weights + classification bands
  data/demoDataset.ts       deterministic synthetic generator (tests/demo only)
  report/ReportDocument.tsx PDF report (@react-pdf/renderer)
  types/                    domain (observed data) and results (tagged metrics)
  utils/                    input parsing, CSV/JSON import, sanitization, formatting
tests/                      Vitest suites
```

The pipeline is strictly separated: **data collection → feature extraction → scoring → confidence estimation → presentation**. Features return `null` (not `0`) when their input is missing, so feature coverage is honest.

### API response shape

```json
{
  "ok": true,
  "score": 73,
  "confidence": "HIGH",
  "dataCoverage": 0.81,
  "sampleSize": 600,
  "result": { "kind": "profile", "profile": {...}, "audience": {...}, "engagement": {...}, "facets": [...], "disclaimers": [...] }
}
```

Every metric inside `result` is `{ label, status: "observed" | "estimated" | "unavailable", value?, interval?, unit?, note? }`.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `INSTAGRAM_PROVIDER` | `mock` | `mock` or `meta-graph` |
| `META_GRAPH_ACCESS_TOKEN` | — | long-lived token for the Graph API |
| `META_IG_BUSINESS_ACCOUNT_ID` | — | the Instagram Business Account ID performing `business_discovery` |
| `META_GRAPH_API_VERSION` | `v21.0` | Graph API version |
| `MAX_UPLOAD_BYTES` | `5242880` | import size limit |
| `MAX_DATASET_ROWS` | `50000` | import row limit |
| `SUSPICION_WEIGHTS_JSON` | — | JSON object overriding feature weights, e.g. `{"ratioAnomaly":2.5}` |

Secrets live only in `.env.local` (git-ignored). Never commit them.

## Connecting a real provider

### Meta Graph API (official)

1. Convert your Instagram account to a **Professional** account and link it to a Facebook Page.
2. Create a Meta app, add the **Instagram Graph API** product, request `instagram_basic`, `pages_read_engagement`, `business_management` (and go through App Review for production use).
3. Obtain a long-lived access token and your Instagram Business Account ID.
4. Set `INSTAGRAM_PROVIDER=meta-graph`, `META_GRAPH_ACCESS_TOKEN`, `META_IG_BUSINESS_ACCOUNT_ID`.

What the official API provides for public professional accounts: profile counts and recent media with like/comment counts → the **engagement model** works. What it does **not** provide: follower lists, liker lists, comments on media you do not own → audience / like / comment authenticity show **INSUFFICIENT DATA** unless you **import** such data legitimately.

### Writing another provider

Implement `InstagramDataProvider` in `src/providers/` and register it in `src/providers/index.ts`. Rules: official or authorized sources only; return `unavailable(reason)` instead of fabricating; respect rate limits (no forced retries), authentication, CAPTCHAs and privacy settings; never access private profiles.

## Import formats

**Accounts CSV** — `username` required; recognized aliases: `followers|followers_count`, `following|follows_count`, `posts|media_count`, `has_profile_pic`, `bio|has_bio`, `is_private`, `is_verified`, `last_post_at`, `created_at`.

**Comments JSON / CSV** — `author|username` and `text|comment` required; optional `timestamp|created_at`, `likes`, and flat or nested author profile fields.

JSON wrappers may carry metadata: `{ "type": "accounts", "followersTotal": 48200, "method": "API export", "accounts": [...] }` or `{ "type": "comments", "totalComments": 1240, "comments": [...] }`.

Files are size-limited, row-limited, sanitized (control characters stripped, lengths capped, usernames validated) and never persisted.

## Methodology (summary)

- **Account suspicion**: Σ(activation × weight) / Σ(weights of evaluable features) × damping (0.5 for one active signal, 0.75 for two, 1 for three+) → 0–100. Bands: 0–25 Likely Authentic, 26–50 Some Suspicious Signals, 51–75 Highly Suspicious, 76–100 Very High Suspicion. Features: abnormal following ratio, mass-follow, empty profile, very few posts, no picture, username anomaly (digit runs, generated tokens, entropy), inactivity, no bio, new-account-high-following, low-activity combination.
- **Audience**: ≥ 30 sampled accounts required; shares per band with Wilson 95% intervals and finite-population correction; counts scaled to observed follower total.
- **Engagement**: median (likes+comments)/followers vs. tier benchmark; anomalies for far-above / far-below, comment starvation, flat like counts (MAD/median < 4%), robust-z outliers.
- **Comments**: exact duplicates across accounts, near-duplicates (3-shingle Jaccard ≥ 0.8), generic stock phrases, repeated emoji, mass mentions, spam patterns, low entropy, temporal bursts, repeat authors, suspicious commenter profiles. Short comments are not flagged alone.
- **Confidence**: data coverage (weighted facet availability) × sample adequacy (Wilson half-width, log size term, sampling fraction). HIGH ≥ 70% coverage & ≥ 300 sampled; MEDIUM ≥ 50% & ≥ 100; otherwise LOW.

The in-app `/methodology` page documents all of this with the current weights.

## Limitations

- Estimates, not proof. A high suspicion score indicates patterns, not intent or automation.
- Benchmarks for "expected engagement" are reference values by follower tier, not per-niche truth.
- Without a follower / liker / comment sample, audience- and post-level authenticity cannot be computed and the UI says so.
- Imported datasets are assumed to be non-random unless you say otherwise; confidence reflects that.

## Testing

```bash
npm test
```

Suites cover: statistics (median, percentiles, z / robust z, outliers, entropy, Wilson intervals, bursts), suspicion scoring (single-signal damping, multi-signal detection, weights, bands), audience aggregation (minimum sample, intervals, signal shares), confidence, score combination, comment NLP features and analysis (duplicates, bursts, repeat authors, short-comment safety), CSV/JSON parsing and sanitization, input parsing, mock and Meta Graph providers, and end-to-end profile/post/dataset analyses on DEMO DATA.

## Privacy

No database. No persistence of inputs, results or uploads. No private profiles. Inputs are validated with Zod and sanitized. Upload size and row limits are enforced server-side.
