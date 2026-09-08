# Admin value dashboard — design spec (mezo: admin redesign, "Pulzus")

- **Date:** 2026-09-08 · **Round:** superpowers:brainstorming + brainstorm-recon
- **Supersedes the UI layer** of `2026-09-06-admin-hub-design.md` and the view-composition
  layer of `2026-09-06-rag-memory-explorer-design.md`. Backend contracts, slices and
  security decisions of both specs stay valid; this spec restructures what the owner sees
  and adds a value-analytics layer on top.
- **Mockup (approved 2026-09-08):** scratchpad `admin-redesign-iranyok.html`, direction
  **A — "Pulzus"** (single smart dashboard landing + shared section template). To be
  redrawn as committed prototypes during implementation
  (`docs/design_2.0/prototypes/admin-pulzus.html` et al.).

## Problem

The freshly shipped `/admin` surface is technically complete but unusable for its one
user, the non-engineer owner: long scrollable tables everywhere, raw technical
identifiers (feature slugs, table names, screen keys), no per-section overviews, no
guidance about what to click, and two pages (cost, accounts) are mobile-shaped bodies
dropped into the desktop shell. Meanwhile the actual product questions of the beta are
unanswered anywhere:

1. Which features give users the most value?
2. What does everything cost — total, per user, per feature, per model?
3. Where can we charge money (high value), where can we save (high cost / low value)?
4. Which features are loved and habitual, which are ignored or never discovered?
5. Which LLM features succeed by explicit feedback (helped / didn't help), and when they
   fail, why?
6. Do testers come back (retention/churn), and where is the experience bad
   (slow/failing calls)?
7. Unit economics: what does one tester cost per month (future pricing basis)?
8. Does the companion remember well (are recalled memories actually useful)?

The same dashboard doubles as the day-to-day production monitor after the beta.

## Product decisions (Daniel, 2026-09-08)

1. **Primary questions:** system health + cost. Entry page answers them without a click.
2. **Direction A — "Pulzus":** the landing page IS the dashboard (status band + KPI row +
   trends + top-N lists), chosen over B ("gates" landing) from browser-rendered mockups.
3. **Landing is opinionated:** an alert band evaluates rules and says "all good" or lists
   clickable warnings that deep-link to the problem, pre-filtered. Rules are config,
   tunable, and designed to keep working in production.
4. **Full redesign** of every admin page, not incremental polish.
5. **Memory explorer stays first-class but must become intelligible**: Hungarian labels,
   plain-language explanations, summaries first, technical detail on expand.
6. **Data browser is demoted to a tool** ("Nyers adatok" under the rail's Eszközök
   group), reached mainly by drill-through links from summary views. The
   feature-usage page dissolves into the new Funkciók section.
7. **App-side capture changes are approved**: discard/accept recording on generator
   features and extending the 👍/👎 surface — the admin value view must not be built on
   half the signal.
8. **Hungarian everywhere in the admin UI**, zero raw identifiers on default views; slugs
   appear only in the deepest drill-down (data browser, call detail).

## Information architecture

```
Rail:  Pulzus · Emberek · Funkciók · Költés · Memória · Meghívók
       ── Eszközök ──
       Nyers adatok        (the data browser, demoted; also the drill-through target)

/admin                 → Pulzus            (status band + KPI + trends + top-N)
/admin/users           → Emberek           (tester cards + summary strip)
/admin/users/:id       → Tesztelő-részlet  (timeline · domains · features · feedback · cost · memory link)
/admin/features        → Funkciók          (scorecard list + value/cost quadrant)  [NEW]
/admin/features/:key   → Funkció-részlet   (trend · funnel · feedback reasons · reliability · calls)  [NEW]
/admin/cost            → Költés            (KPI strip · breakdowns · model mix · daily trend)
/admin/users/:id/memory→ Memória           (overview first; Felidézések · Gráf · Térkép · Rétegek)
/admin/memory          → Memória-belépő    (user picker + installation-wide health)  [NEW]
/admin/accounts        → Meghívók és fiókok (kept, desktop-mosaic treatment)
/admin/data            → Nyers adatok      (kept as-is functionally; rail placement changes)
/admin/usage           → redirect → /admin/features (screen usage panel moves there)
```

**Every section follows one template** (the approved "szekció-minta"): KPI strip on top →
breakdown cards (top-N with "összes →" links) → the full table/list only behind an
explicit action, arriving pre-filtered from whatever the user clicked. Long lists are
never a landing state.

**Label dictionary (foundation):** one frontend module mapping every `llm_log_history`
feature slug (41 today), every telemetry screen key, every browsable table name, and
every memory term to a Hungarian label + one-line description ( tooltip). Unknown keys
render as the raw slug with a "nincs címke" marker so new features are noticed, and a
unit test fails when a slug used by `LlmCallContext` call sites has no entry.

## Page designs

### 1 · Pulzus (`/admin`)

Approved layout: status band → 4 KPI posters → 2 trend tiles → 3 top-N tiles.

- **Status band** (`GET /api/admin/alerts`, new): evaluates server-side rules and returns
  `alerts[] {key, severity info|warn|bad, title (HU), detail, link}` where `link` is an
  in-admin deep link with query params (e.g. `/admin/cost?day=2026-09-07`). Green
  "Minden rendben" state when empty. Initial rules:
  1. `cost_spike` — yesterday's cost > 2× trailing 7-day average.
  2. `memory_stuck` — failed/stale memory processing rows > 0 (from the existing
     memory health rollup).
  3. `job_missed` — a registered nightly job's last success older than 26 h.
  4. `llm_errors` — feature error rate > 20 % over the last 24 h (min 5 calls).
  5. `tester_quiet` — tester inactive 7+ days (severity `info`, feeds the third top-N
     tile rather than the yellow band).
  Thresholds live in a `@Validated` properties record (`mezo.admin.alerts.*`).
- **KPI posters:** Rendszer (ring: healthy jobs / all, from alerts + job registry),
  Költés ma (with Δ vs 7-day average), Aktív ma (n / all testers), Memória (healthy
  vector share, stuck count) — all from existing `overview` + `memory/health` data plus
  the new alerts endpoint.
- **Trends:** cost 30d (legend = top features by spend, HU labels) and activity 30d
  (legend = per-domain counts — the `domainSeries` the backend already returns and the
  current UI ignores).
- **Top-N tiles:** top spenders 7d (incl. "Háttér"), top features by spend 7d, quiet
  testers. Each row and each "összes →" navigates into the owning section.

### 2 · Emberek (`/admin/users`, `/admin/users/:id`)

- **Summary strip** above the list: aktív ma / aktív héten / csendesedik (3–7 nap) /
  lemorzsolódott (7+ nap) — clickable filters.
- **Tester cards** (not a table): avatar + name, 90-day GitHub-style heat strip (per-day
  intensity, already computable from `activitySeries`), "utoljára: X napja", 30-day cost,
  a small 👍/👎 balance from `feedback_rollup`, and a status chip (aktív / csendesedik /
  lemorzsolódott). Sort: by risk (quiet first) or by cost. Existing table remains as the
  "összes adat táblázatban →" fallback view for sorting by arbitrary columns.
- **Detail page** keeps the 5-tab structure but every tab opens with a summary layer:
  - *Aktivitás:* per-domain heat strips (not summed), streaks, first/last seen.
  - *Funkciók:* adoption list — feature (HU label) · first use · last use · frequency ·
    "szokás" flag (used in ≥3 of last 4 weeks) · never-discovered section at the bottom
    ("ezeket még nem találta meg").
  - *Visszajelzések:* the tester's 👍/👎 history by surface with down-reasons, and their
    memory-recall feedback ratio.
  - *Költség* and *Adatok* keep their content behind the new summary-first template.
  - *Memória* tab links into the explorer as today.

### 3 · Funkciók (`/admin/features`, `/admin/features/:key`) — NEW, the value centre

- **Scorecard list:** one row per feature (union of the admin feature-map domains and
  the LLM feature slugs, HU-labelled, grouped AI / non-AI). Columns rendered as
  graphics, not numbers-only: Kipróbálták (n users) · Használat/hét sparkline ·
  Szokás-mutató (share of users with a weekly habit) · Segített-arány (👍 ratio where a
  feedback surface maps; "n/a" honestly otherwise) · Elfogadás (accept vs discard where
  capture exists) · Költség 30d · Ár/használat · Megbízhatóság (error % + p90 latency
  dot). Sortable; each row → detail page.
- **Value/cost quadrant:** scatter of usage-value score (x: weekly active users ×
  habit + feedback bonus) vs 30-day cost (y). Quadrant captions in product language:
  "ezért kérhetünk pénzt" (high/high), "ingyenes csali" (high value / low cost),
  "spórolni itt lehet" (low value / high cost), "figyelni" (low/low). Points = clay dots
  in domain colours, labelled on hover, click → detail.
- **Feature detail:** 30/90-day usage trend · adoption funnel (kipróbálta → ismételte →
  szokás, absolute tester counts, at beta scale shown as named avatars) · feedback
  panel: 👍/👎 trend and the 👎-reason breakdown (pontatlan / túl sok / rossz időzítés /
  nem rólam szól) with the freshest verbatim artifacts behind a lenyitó · reliability
  panel (error codes, latency distribution) · cost panel (per model, per user) · "minden
  hívás →" pre-filtered into the existing call list.
- **Screen usage** (telemetry) moves here as a supporting tile: "melyik képernyőn járnak"
  with HU labels, linked from feature rows where a screen maps.
- **Backend:** new `AdminInsights` operations
  `GET /api/admin/features` (scorecard aggregate) and
  `GET /api/admin/features/{key}` (detail), joining: usage (feature-map + llm log),
  `feedback_rollup`/`message_feedback` via a **new artifact-kind ↔ feature-slug mapping**
  (config record, e.g. `chat_message→companion_chat`, `weekly_suggestion→proactive_weekly`),
  `memory_retrieval_feedback` for recall, latency/error aggregates from
  `llm_log_history`, and accept/discard from the new outcome capture (§6). Feedback
  aggregation gains a per-feature admin query (the nightly per-user rollup is not
  historical, so admin reads aggregate live with the 5 s statement timeout, beta-scale).

### 4 · Költés (`/admin/cost`)

Approved section template: KPI strip (e havi költés + Δ vs previous month same-day ·
várható hó végén (run-rate) · egy tesztelőre jutó havi ár · ismeretlen költségű hívások) →
"mire megy a pénz" and "ki költi" top-5 cards → **model mix table** (model · calls ·
tokens · cost · trend · "olcsóbb modell jelölt" flag when a feature runs a premium model
with low feedback lift) → daily 30d trend with anomaly dots (cost_spike days), clicking
a day filters the call list to that day. The existing AiUsage call list + call detail
remain as the deepest layer, restyled into the desktop mosaic. The user × feature cost
matrix (backend exists, UI never shipped) renders here as a heat grid behind a "teljes
mátrix" toggle.

### 5 · Memória

- **`/admin/memory` (new entry):** user picker + installation-wide health KPIs (vectors
  ready/stale/failed, items by state, last nightly jobs) — the health endpoint summed
  across users needs a small owner-wide variant or client-side aggregation over the
  per-user call for the beta headcount.
- **Per-user explorer:** view order becomes **Áttekintés (new) · Felidézések · Gráf ·
  Térkép · Rétegek**.
  - *Áttekintés:* health summary + recall quality ("a felidézett emlékek 78%-a volt
    hasznos" from `memory_retrieval_feedback`), recall volume trend, last problems.
  - *Felidézések* (ex-Futások): each run row leads with a **plain-Hungarian verdict
    sentence** generated client-side from the stored score breakdown — the dominant
    contributor verbalized ("főleg szó szerinti egyezés miatt", "a tudásgráf kapcsolat
    miatt", "mert friss és fontos emlék") — then the technical contribution bar and the
    full score table only on expand. Column names humanized; SHADOW badge copy kept.
  - *Gráf / Térkép:* interaction unchanged, plus a legend tile explaining node kinds and
    edge meanings in Hungarian, and the inspector's source links labelled in product
    words.
- Feedback actions (useful/irrelevant/suppress counts) surface per memory item in the
  inspector.

### 6 · App-side capture (approved)

1. **Generator outcome capture:** persist AI-draft outcomes for the two big generator
   flows — meal draft (accepted / edited / discarded) and meso plan (generated →
   accepted / discarded). Minimal shape: a small `ai_draft_outcome` table (owned entity:
   feature slug, draft ref/hash, outcome, created_at) written by the existing accept
   paths and by new lightweight discard signals from the FE (fire-and-forget like
   telemetry). No UI burden beyond what users already do; "edited" derived by comparing
   accepted payload to draft where cheap (meal), else omitted.
2. **Feedback surface extension:** add `FeedbackChips` (existing pattern, CK-swap
   migration precedent) to meal-coach prose and recipe-breakdown results —
   `FeedbackArtifactKind` grows `meal_coach|recipe_breakdown` (checking the character
   slice's own feedback service first to avoid duplication).
3. **Artifact↔feature mapping + admin feedback endpoint:** the mapping record from §3
   plus `GET /api/admin/feedback/summary?period=` powering scorecards and Pulzus.
4. All of this respects the beta consent already documented for admin visibility.

## Error handling

- Per-tile isolation stays (`AdminTile`); a failing aggregate degrades one tile.
- Alerts endpoint failure → the band renders "az ellenőrzés most nem fut" (grey), never
  fake green.
- Features with no feedback surface show "nincs visszajelzés-forrás" rather than 0 %.
- Memory switches off → existing degraded-404 "ki van kapcsolva" tiles kept.
- Statement timeout 5 s on every new aggregate query (existing admin convention).

## Testing

- Backend ITs (Testcontainers pgvector, focused runs locally, full suite in CI): alert
  rule evaluation incl. threshold edges and the "no data" day; scorecard aggregation
  joins (feedback mapping, null `created_by`, ERROR-status exclusion); outcome capture
  writes; non-owner 403 on every new endpoint.
- Frontend: both `VITE_USE_MOCK` modes per page; label-dictionary completeness test
  against the slug list; verdict-sentence pure function unit-tested against stored
  breakdown fixtures; redirect test `/admin/usage → /admin/features`; mock seeds for
  every new endpoint + MSW handlers.
- Gates: contract-drift, codemap, ArchUnit via plain `./mvnw test`; CI self-PR flow per
  house rules. No visual-golden gate exists for admin (retired, mezo-ryb6) — the
  committed prototypes + manual owner review are the visual gate.

## Slices (each = one bd issue + one feat branch + self-PR)

0. **Foundations** — HU label dictionary (+ completeness test), rail rework (Funkciók in,
   Eszközök group, usage redirect), section-template shared components (KPI strip,
   top-N card, "összes →" pattern).
1. **Pulzus backend** — alerts endpoint + rules config + ITs.
2. **Pulzus UI** — status band, KPI posters, trends (per-domain legend), top-N tiles.
3. **Funkciók backend** — artifact↔feature mapping, feedback summary, scorecard +
   feature-detail endpoints, ITs.
4. **Funkciók UI** — scorecard list, quadrant, feature detail, screen-usage tile,
   `/admin/usage` redirect.
5. **Emberek UI** — summary strip, tester cards, detail-tab summaries (per-domain heat,
   adoption, feedback tab).
6. **Költés UI** — section template, model mix, cost matrix heat grid, anomaly-linked
   drill-down.
7. **Memória** — entry page, Áttekintés view, verdict sentences on Felidézések, HU
   legends on Gráf/Térkép, recall-quality wiring.
8. **App-side capture** — outcome table + write paths + FE discard signals; FeedbackChips
   extension; feeds back into Funkciók numbers.
9. **Docs + polish** — feature docs update (admin-hub.md, admin-memory-explorer.md),
   committed prototypes, codemap, redirects verified, staleness fixes.

Order: 0 → (1,3 parallel) → 2 → 4 → 5 → 6 → 7 → 8 → 9. Each slice lands via the
self-PR CI gate before the next depends on it.

## Prior art

Researcher report (2026-09-08), filtered:

- **Adopted — Shneiderman "overview first, zoom & filter, details on demand"** as the
  universal section template; detail tables are drill-down destinations, never landing
  states. https://www.recordedfuture.com/blog/information-seeking-mantra
- **Adopted — Plausible's one-page opinionated dashboard**: KPI strip over a main trend,
  top-N cards with "view all", plain-word labels; the shape of Pulzus and of every
  section. https://plausible.io/simple-web-analytics
- **Adopted — NN/g progressive disclosure** for the memory explorer and data browser:
  human summary by default, raw scores/IDs one deliberate click deeper.
  https://www.nngroup.com/articles/progressive-disclosure/
- **Adopted — Langfuse's curated cost dashboard shape** (spend + trend on top, breakdowns
  by model/user/feature, trace table as endpoint) for Költés.
  https://langfuse.com/docs/metrics/overview
- **Adopted — Pencil & Paper enterprise-table patterns** (summary above table, hidden
  technical columns, row-click → detail) for the surfaces that stay tabular.
  https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables
- **Rejected —** shipping a flexible query builder (one known user with known
  questions); moving analytics to Grafana (that's infra observability, part 3).

## Codebase terrain

Investigator reports (2026-09-08), filtered:

- **The feedback signal is rich and live:** `message_feedback` (7 artifact kinds,
  👍/👎 + 4 down-reasons, real UI mounts via `FeedbackChips`), nightly `feedback_rollup`
  (17 scopes/user, no history, per-surface not per-slug), `memory_retrieval_feedback`
  (useful/irrelevant/suppress, wired on ChatPage), decision states on learned facts,
  patterns, experiments, challenges, auto-validated predictions. **Nothing in the admin
  reads any of it today.**
- **Gaps to close (§6):** no discard capture on meal draft (`MealAiDraftService` is
  ephemeral; accept visible only via `meal.provenance`), nothing persisted for meso-plan
  generation, no artifact-kind↔feature-slug mapping, no admin feedback endpoint.
- **Underused aggregates already returned:** `overview.domainSeries` + `loggedToday`
  per-domain (summed away by the UI), the user×feature cost matrix (never rendered),
  memory health rollups (buried in Rétegek), per-user `activitySeries` per-domain keys
  (summed by HeatStrip).
- **Key frontend files:** `features/admin/adminRoutes.tsx` (lazy chunk discipline),
  `AdminLayout.tsx` (ClaySprites/Toast/ArrivalProvider self-mount), `AdminRail.tsx`,
  pages under `features/admin/pages/*` and `features/admin/memory/*`,
  `components/AdminTile.tsx` (per-tile error isolation — keep), mosaic kit
  `shared/ui/mozaik` (`MosaicDesktop`, `StatCell`, `MCells`, `CollapsibleStrip`),
  graphics: `Sparkline`, `ScoreRing`, `TrendChart`, `.ad-ring`/`.ad-heat` CSS,
  `lib/adminViz.ts`.
- **Cost/latency source:** `LlmLogEntity` (`status`, `error_code`, `latency_ms`,
  `cost_usd`, `pricing_snapshot`; nullable `created_by`; null usage on failed calls —
  filter in aggregates); 41 feature slugs at `LlmCallContext` call sites.
- **Patterns to follow:** contract-first (yml fragment → generated Api → controller with
  `requireOwner()` first), `useDualQuery` + `enabled: isOwner` + MSW handlers + mock
  seeds in both modes, per-tile `AdminTile`, URL-as-state for deep links,
  `@Validated` properties records, `SystemMessage` errors.
- **Traps:** ArchUnit cycle rule (admin → companion/llmlog/auth only, nothing imports
  admin); frozen archunit store corruption check before commits; contract-drift and
  codemap CI gates; `VITE_USE_MOCK` unset ⇒ mock; mock queries need `staleTime`;
  telemetry is view-events only and server-side switchable — verify prod enablement
  before trusting screen numbers; `message_feedback` uniqueness spans soft-deleted rows;
  admin visual coverage is zero (goldens retired) — owner review is the visual gate;
  entrance choreography must stay inside `ArrivalProvider`.
