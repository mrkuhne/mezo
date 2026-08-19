---
title: Insights
type: feature-domain
status: mixed
updated: 2026-08-18
tags: [insights, frontend, data-layer]
key_files:
  - frontend/src/features/insights
  - frontend/src/data/insights/insights.ts
  - frontend/src/data/insights/knowledge.ts
  - frontend/src/data/insights/chat.ts
  - frontend/src/data/insights/chatHooks.ts
  - frontend/src/shared/lib/markdown.tsx
  - frontend/src/data/insights/weeklyHooks.ts
related: [_platform-data-layer, _platform-design-system, today, me, companion]
---

# Insights — Feature Documentation

> One-line: the **pattern/companion "AI brain" surface** — where mezo reflects back what it has *learned* about the user (detected patterns, weekly review, memoir, knowledge base, chat, predictions, experiments). **Status: 🔶 mixed** — **Chat** (companion V0.4), **Patterns** (V3.1), **Knowledge** (V1.2) are ✅ real over the companion backend ([`companion.md`](companion.md)), and **Weekly** is ✅ real since **D′ (`mezo-t16y.1`)** by client-side composition (its „heti tervjavaslat" card now speaks too — the generated prose is live via **proactive W1 `mezo-h4wp.3`**); **Memoir** is ✅ real since **proactive W2 (`mezo-h4wp.4`)** — the tab un-ghosted, rendering the companion's generated weekly memoir (demo reactions/anniversary/archive stay mock-only); **Predictions** is ✅ real since **proactive P1 (`mezo-h4wp.7`)** — the tab un-ghosted, rendering pattern-grounded forecasts with deterministic validation („tanulom" on null confidence, honest accuracy header); and **Experiments** is ✅ real since **proactive P2 (`mezo-h4wp.8`)** — the last tab un-ghosted, rendering companion-proposed N=1 experiments with an L2 accept/dismiss write path + deterministic outcomes. **All seven proactive-epic tabs are now real** (`PHASE3_TAB_IDS` is empty; the proactive epic is complete) — plus the post-epic **Memória** tab (§2.9, `mezo-al1i`, a read-only observatory over the memory pipeline itself), never phase-gated, for **all eight Insights tabs real** today. **Phase-2 exit audit passed (mezo-t16y.4, 2026-07-05):** the sub-nav hiding + per-page `PhaseTeaserCard` guards re-verified; no fabricated Insights number reaches a live user. Reached via the `sparkle`-icon link in the Today `AppHero` (no bottom `TabBar` entry). **The post-epic Motor tab (was §2.8, `mezo-viqs`/`mezo-18bx`) is RETIRED (`mezo-tk88.4`)** — its pattern-gate diagnostics were folded into the Patterns tab's own dashboard (new §2.1: hero + decision inbox + lifecycle sections + a collapsed „Adat-egészség" coverage panel) and the per-pattern **pattern-pair detail page** (§2.1b, `mezo-tk88.5` — `PatternDetailPage.tsx`); `/insights/motor` now redirects to `/insights` (`router.tsx`).

---

## 1. Summary

Insights is the user-facing window onto mezo's N=1 self-model: it presents the behavioral patterns the (future) AI has inferred, a weekly score review, a literary "memoir," an editable knowledge base of facts, a chat companion, predictions, and self-experiments. Every surface today renders **hand-authored Hungarian mock copy** that *simulates* what the Phase-3 AI will eventually generate.

**Status per layer:**

| Layer | Status | Notes |
|---|---|---|
| FE mock | ✅ done | 8 sub-tabs, all views + tests present |
| FE real-mode | ✅ all 8 tabs (Chat + Patterns + Knowledge + Weekly + Memoir + Predictions + Experiments + **Memória**) | **Chat** real since companion V0.4 (`chatHooks.ts` + `chatApi.ts`, SSE — [`companion.md`](companion.md) §5.1); **Patterns** (V3.1) + **Knowledge** (V1.2) real over the companion backend — Patterns' dashboard also reads `GET /api/companion/pattern/monitor` directly since **`mezo-tk88.4`** (the retired Motor tab's diagnostics, §2.1); **Weekly** real since **D′ (`mezo-t16y.1`)** — `data/insights/weeklyHooks.ts` composes the review client-side from existing fuel/train/biometrics reads (no Insights backend); its „heti tervjavaslat" prose is live since **proactive W1 (`mezo-h4wp.3`)** off `GET /api/proactive/weekly-suggestion`; **Memoir** real since **proactive W2 (`mezo-h4wp.4`)** — `data/insights/memoirHooks.ts` reads `GET /api/proactive/memoir` (404→null→honest „készül" state), demo reactions/anniversary/archive mock-only; **Predictions** real since **proactive P1 (`mezo-h4wp.7`)** — `data/insights/predictionsHooks.ts` reads `GET /api/proactive/prediction` (list; `[]`→honest still-learning state, „tanulom" on null confidence); **Experiments** real since **proactive P2 (`mezo-h4wp.8`)** — `data/insights/experimentsHooks.ts` reads `GET /api/proactive/experiment` + `useExperimentActions` writes L2 decisions/propose; **Memória** real (both modes) since **`mezo-al1i`** (post-epic) — `data/insights/memoryHooks.ts` reads the 4 `GET /api/companion/memory/*` endpoints off `MemoryObservatoryService`, §2.9. **No mock-only Insights tab remains** — all 8 are real (§2). **Motor (was the 8th tab) is RETIRED (`mezo-tk88.4`)** — `/insights/motor` redirects to `/insights`. |
| Backend (Java) | 🔶 companion only | `feature/companion` backs the chat (`ai_conversation`/`ai_message`); no `pattern`/`knowledge_fact` backend yet. |

This is **intentional**. Insights is the Phase-3 "AI brain" surface; the single FE↔data boundary (`frontend/src/data/hooks.ts`) is pre-built so the real-mode swap is mechanical, exactly as already proven for biometrics/Train (the barrel is app-wide shared — unrelated domains' re-export additions, e.g. the `mezo-53su` `useFuelSettings` export, move this key_file without touching Insights' own data path). There are **two distinct roadmap stages** the doc keeps separate:
- **Phase-2 Slice D — "Insights seed-only"**: **DROPPED as superseded (2026-07-04 re-map)** — Phase 3 built the real `pattern`/`knowledge_fact`/`ai_conversation` stack, so seeding was never needed. What remains is **D′** (`mezo-t16y.1`): deterministic Weekly review + honest surface for Memoir/Predictions/Experiments — `docs/superpowers/plans/2026-07-04-phase2-completion-roadmap.md` §D′.
- **Phase 3 — the actual AI**: Spring AI + pgvector + RAG + pattern/companion pipeline (`docs/milestones/roadmap.md:13`).

Driving specs: `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (Slice D §126; Phase-3 out of scope §6) · `docs/milestones/roadmap.md:12-13`.

---

## 2. User-facing behavior

**Route:** `/insights` (entered via the `sparkle`-icon link in the Today `AppHero`, `frontend/src/features/today/pages/TodayPage.tsx:221` — no bottom `TabBar` entry). Shell + 8 sub-tabs wired in `frontend/src/app/router.tsx:111-127` from `INSIGHTS_TABS` (`frontend/src/features/insights/pages/tabs.ts`):

| Sub-tab | Route | Pill label (verbatim) | View | Real mode |
|---|---|---|---|---|
| patterns | `/insights` (index) | `Minták` | `PatternsPage` | shown |
| weekly | `/insights/weekly` | `Heti` | `WeeklyPage` | shown |
| memoir | `/insights/memoir` | `Memoár` | `MemoirPage` | **shown** → real (W2) |
| knowledge | `/insights/knowledge` | `Tudástár` | `KnowledgeListPage` | shown |
| chat | `/insights/chat` | `Chat` | `ChatPage` | shown |
| predictions | `/insights/predictions` | `Előrejelzések` | `PredictionsPage` | **real** (P1) |
| experiments | `/insights/experiments` | `Kísérletek` | `ExperimentsPage` | **real** (P2) |
| memory | `/insights/memoria` | `Memória` | `MemoryPage` | shown (both modes, since mezo-al1i) |

**Motor (was the 8th tab, `/insights/motor` → `MotorPage`) is RETIRED (`mezo-tk88.4`)** — the `INSIGHTS_TABS` entry is gone and `router.tsx` maps the bare route to `<Navigate to="/insights" replace />` so any stale link/bookmark lands on the Patterns dashboard instead of a 404; see §2.1/§2.8.

**`InsightsTab.title` was dropped (compact-header redesign, `mezo-ugqb`, 2026-07-18)** — with the per-section `.pghead-np.lav` big header gone (below), the field's only consumer disappeared, so it was removed from the type/array; the pill `label` above is now the only per-tab copy.

**Honest surface (mezo-t16y.1 · proactive W2):** the Phase-3+ demo tabs carried only hand-authored demo fiction, so **in real mode the sub-nav hid them** (`visibleInsightsTabs()` in `tabs.ts` filters `PHASE3_TAB_IDS` when `!isMockMode()`; the shared `SubNavDropdown` maps that instead of `INSIGHTS_TABS`). **Memoir left `PHASE3_TAB_IDS` at W2 (`mezo-h4wp.4`), Predictions at P1 (`mezo-h4wp.7`), and Experiments at P2 (`mezo-h4wp.8`)** — the set is now **EMPTY**, so `visibleInsightsTabs()` returns all eight remaining tabs (**Memória** was never added to the set either) in both modes. No `PhaseTeaserCard` ghost is reachable any more; every tab renders real data or an honest null-state. (The `PhaseTeaserCard` component was **deleted** in the Napív S8 shell migration once it had no reachable consumer — the un-ghost/ghost-guard recipe lives on only in git history.)

**Header (compact-header redesign, `mezo-ugqb`, 2026-07-18):** `InsightsSection` (`frontend/src/features/insights/pages/InsightsSection.tsx`) no longer renders its own `.pghead-np.lav` page-head — it mounts the shared **`AppHero`** (the same identity/progression row Today/Train/Fuel/Me carry) and passes a **`SubNavDropdown`** (`items={visibleInsightsTabs()}`, `accent="var(--lav-deep)"`, `aria-label="Insights alnavigáció"`) as its `utilities` prop, then an `<Outlet/>` (padding unchanged). `InsightsSubNav` and the `.pghead-np.lav`/`.np-pills` markup it used to render are **deleted** — Insights joined the same AppHero family as the other 4 sections (§ [`_platform-design-system.md`](_platform-design-system.md) §3 "AppHero v2" / "`SubNavDropdown`"). **No leaf page has a section `h1` any more** — the chip showing the active tab's label (`"Minták ▾"` etc.) carries the location instead; each leaf view's own content (score cards, chat, journal…) starts directly below the sticky header.

### 2.1 Patterns (`pages/PatternsPage.tsx`) — **the lifecycle dashboard, `mezo-tk88.4`**
Default tab — no longer a flat inbox list, but a full **pattern-lifecycle dashboard**: the old
inbox AND the retired Motor tab's gate diagnostics (was §2.8) now live on one page, entirely
client-side composed off two reads with **no new endpoint**: `usePatterns()`
(`data/insights/patternsHooks.ts`, `['patterns']` dual-read → `{patterns, degraded, mode}`; real
mode maps `GET /api/companion/pattern`, 404⇒degraded; mock keeps the `insights.ts` seeds) and
`usePatternMonitor()` (`data/insights/monitorHooks.ts`, `['pattern-monitor']` dual-read →
`{monitor, degraded, isError, refetch}`; real mode maps `GET /api/companion/pattern/monitor`,
404⇒degraded). `usePatternActions().decide()` still drives the L2 write (real: `POST
/api/companion/pattern/{id}/decision` + invalidate — repeatable transitions; mock: cache
mutation).

**Lifecycle bucketing (`logic/lifecycle.ts`, `bucketize`)** is the page's spine: every `Pattern`
row + every unmatched `PatternMonitorPair` (matched by `pattern.pairKey === pair.key`) sorts into
one of six buckets, in this fixed order (`BUCKET_ORDER`) — **`decide`** (the strength-gated
inbox), **`monitoring`**, **`confirmed`**, **`gathering`** (pairs with no pattern row yet — still
gathering data, regardless of their own verdict), **`noRelationship`**, **`rejected`**. A
user-judged `Pattern.status` (`confirmed`/`monitoring`/`rejected`) always wins outright; otherwise
an `ai_hypothesis` row gates on its own `confidence ≥ MIN_PATTERN_CONFIDENCE`, and a `statistical`
row gates on the monitor pair's live `r`/`p` via `isStrongSignal` — **the display-layer strength
gate is `|r| ≥ 0.3 && p ≤ 0.15`** (`STRONG_SIGNAL` in `insights.ts`; distinct from the *server-side*
n-gate that decides whether a pair even reaches the monitor at all). A pair with no matching
pattern row always lands in `gathering`, whatever its own verdict/status — the nightly job hasn't
produced a row for it yet.

**Stale rows never reach the inbox (`mezo-mqdj`).** The nightly job's gate-fail path is an early
return: when a pair stops passing (data deleted, window slid), `PatternDetectionService` neither
refreshes nor removes the row already persisted from the last live night, so it survives with
frozen stats — while the monitor, recomputing live, reports `few_days`/`no_data`/`degenerate` for
the same pair. The row is kept on purpose (it preserves the `pattern_event` history, the user's own
`monitoring` decision, and a *timestamped* historical truth); the presentation layer is what must
not lie about the present, and it holds both sides already:
- `bucketFor` routes a `proposed` statistical row whose pair exists but is **not `live`** to
  `gathering`, never `decide` — confirming there would promote into permanent knowledge (Tudástár +
  prompt + predictions) a correlation today's window cannot even compute;
- `PatternDecisionCard` and the `monitoring` mini-row replace the row's frozen `mechanism` sentence
  ("Erős pozitív együttjárás … az elmúlt N napban") with the gate's own `verdictSentence`;
- a `monitoring` row **stays** in its section — the user asked to watch it; only its finding line
  becomes honest.
A pair that goes live again returns to `decide` on its own, with no state to unwind.

**Top to bottom:**
1. **`MotorStateHero`** (`components/MotorStateHero.tsx`) — the engine-state card: „N kérdést"
   figyelek + the confirmed/decide counts in prose, six bucket-count tiles (`BUCKET_ORDER` order),
   a „ma HH:mm · N nap" stamp (`monitor.lastRunAt`/`lookbackDays` — **`lastRunAt` is NOT "the job
   last ran"**, it's `max(lastDetectedAt)` over the user's own statistical pattern rows, so it
   reads "—" for a user whose inbox is empty even though the nightly job ran and gated everything
   out, carried over unchanged from the retired Motor tab, `mezo-viqs`), and a domain-chip row (`DOMAIN_META`/`DOMAIN_ORDER`, `logic/domains.ts`) that **filters every
   section below** by the pair's metric-B (outcome) domain — empty selection = no filter; the
   „Mind" chip clears all active domains in **one click**, calling `onToggleDomain` once per active
   domain synchronously in the same event — `PatternsPage`'s `activeDomains` `useState` MUST use
   the functional-updater form (`setActiveDomains(prev ⇒ …)`) or a stale-closure batch would drop
   all but the last toggle.
2. **Decision inbox** (`🔔 Döntésre vár · N` eyebrow + `csak erős jel` meta, not collapsible) — one
   `PatternDecisionCard` (`components/PatternDecisionCard.tsx`) per `decide`-bucket entry: category
   chip + a `confidenceMeta` chip (`megbízható jel`/`ígéretes jel`/`még bizonytalan`, only when the
   pair carries `n`/`p`), the display title (pair's `questionHu` when a pair is matched, else the
   pattern's own `title`), the `📈 Amit eddig látunk` finding block (`findingSentence` — the same
   human-composition Motor used, **raw `r`/`p`/`n` NEVER rendered here**), an explainer block
   („Mi történik a döntéseddel" — **only on the FIRST card**, `showExplainer`), the
   Confirm/Monitor/Reject three-button row, and a „Részletek és előzmények →" link to the
   pattern-pair detail page (§2.1b, `/insights/patterns/{pairKey}`).
3. **Five collapsible `LifecycleSection`s** (`components/LifecycleSection.tsx` — title+count header
   + chevron, `useState`-driven, renders nothing when its (domain-filtered) count is 0): `✓
   Megerősítve — él a tudásban` (defaultOpen, footnote „Ez a N összefüggés benne van a társ
   fejében…"), `👁 Megfigyelés alatt`, `⏳ Még gyűlik az adat` (row sub = `verdictSentence` — the
   same honest per-verdict sentence Motor's `PairRow` used, including the few_days 🎯 nudge),
   `○ Megnéztük — nincs összefüggés` (footnote „Ez is eredmény…"), `✕ Elvetve`. Each row is a
   `LifecycleMiniRow` (title + a one-line sub + a `→` link to the pattern-detail route): confirmed
   rows' sub is a plain „megerősítve" (the promoted-fact reinforcement count isn't part of this
   page's reads — it belongs on the pattern-pair detail page, §2.1b); monitoring/noRelationship rows' sub is a
   `findingSentence`-composed one-liner when the pair has a live `r`.
4. **„Adat-egészség"** — a collapsed card (defaultOpen `false`) hosting the same
   `MetricCoverageRing` list Motor's coverage table used — metrics sorted thinnest-covered-first,
   each ring's `waiting` flag true when NONE of its referencing pairs is `live`. Ported verbatim off
   the retired `MotorPage`'s wiring (§2.8 below).

**Honest states (checked in this order, the same loading/error/degraded/„actually empty" four-way
split Motor pioneered, `mezo-viqs`):** while EITHER `usePatterns()` or `usePatternMonitor()` is
still unresolved (real mode's cold-load window — mock mode's `isPending` is always `false`,
`useDualQuery` seeds synchronously) the page renders `<GhostState message="A minták betöltése…" />`
and nothing else — **without this gate, `patterns=[]`/`monitor=null`/`degraded=false` during the
unresolved window reads as "genuinely empty" and would flash a fabricated „0 kérdést … 0 vár a
döntésedre" hero + all-zero tiles at a live user, the mezo-yew/mezo-0xl bug class** (regression
test: `PatternsPage.test.tsx`'s delayed-response case). Next, a genuinely failed monitor fetch
(500/network, `usePatternMonitor().isError`) — distinct from a 404 — renders a `GhostState` retry
card, never a blank page. **404 on BOTH endpoints** renders the honest degraded card (`A
minta-motor most nem elérhető…`) — no Motor link any more (the page IS the diagnostics now). Only
once none of the above apply does a genuinely empty state (`patterns.length===0 &&
monitor.pairs.length===0`) render the pre-existing „Még nincs felismert minta…" copy, link removed
for the same reason.

### 2.1b Pattern-pair detail (`pages/PatternDetailPage.tsx`) — **`mezo-tk88.5`**
The per-pair drill-down the retired Motor tab's `PairRow` used to expand into — now a full leaf
route, **`/insights/patterns/:pairKey`** (`router.tsx`, a sibling registered BEFORE the `insights`
group, same idiom as `fuel/recipes/:id` — no Insights sub-nav chrome). Since **`mezo-fy97`** every
branch (loaded, pending, error, not-found) renders inside a local `DetailFrame`: page padding
(`14px 16px 24px` — the sibling route sits outside `InsightsSection`'s padded outlet, so the page
brings its own) + the house full-page header row (back chevron `‹` to `/insights`,
`aria-label="Vissza"` + `h1` „Minta részletei" — the `AiUsagePage` idiom; the mockup's bare
`← Minták` text link rendered glued edge-to-edge in the real shell, user QA). Reached from the dashboard's „Részletek és előzmények →" (decision cards, §2.1 step 2) and
every `LifecycleMiniRow`'s `→` link (§2.1 step 3), plus the legacy `?pair=` query param redirect
(§2.1).

**Data:** `usePatternPairDetail(pairKey)` (`data/insights/patternDetailHooks.ts`,
`['pattern-pair-detail', pairKey]` dual-read → `{detail, notFound, degraded, mode, isPending,
isError, refetch}`; real mode maps `GET /api/companion/pattern/pair/{pairKey}` via
`patternDetailApi.ts` — reuses `patternsApi.ts`'s `toPattern`; **any 404 is one honest `notFound`
state**, unknown `pairKey` and the companion switch off are deliberately indistinguishable, same
discipline as the monitor's `degraded`) + `usePatternMonitor()` (§2.1, re-read here purely for the
diagnostics section's window/lag/`sourceHu` meta — "cached" in practice since the dashboard already
warmed the query on the way in). **States:** `isPending` → `GhostState`; a genuine fetch failure
(`isError`) → `GhostState` + retry (`refetch`); `notFound` → the honest „Nincs ilyen minta." card +
back link — never a blank page.

**Top to bottom (spec-mockup screen 2, `docs/superpowers/specs/2026-08-14-patterns-dashboard-redesign-mockup.html`):**
1. **Header** — the dashboard's own `PatternDecisionCard` **reused** (`showExplainer={false}`, a new
   optional `titleSize` prop bumped to `19` for the bigger detail-page title; the judged state reads
   through the button's own active styling, e.g. a green „Megerősítve" — no separate status badge
   was added) when the pair HAS a persisted `Pattern` row (`detail.pattern != null`). A pair with no
   row yet (still gathering, or LIVE but the nightly job hasn't produced one) gets a plain local
   `GatheringHeaderCard` instead — same chips/title/pair-line, but **no decision buttons**, and the
   finding block is replaced by the honest gate status via `verdictSentence` (`logic/verdicts.ts`,
   the same sentence the „Még gyűlik az adat" lifecycle rows use).
2. **„Hogyan erősödött a jel"** — `PatternStrengthChart` (`components/PatternStrengthChart.tsx`,
   Task 12) over `detail.events`, plus a caption computed from the FIRST/LAST snapshot's own `n`
   (common-day count, NOT |r| — `firstLastSnapshotN`, `logic/patternHistory.ts`): *"A jel
   folyamatosan erősödik, ahogy gyűlnek a közös napok — {first} napról {last}-re."*; under 2
   n-bearing snapshots → the honest *"Még nincs előzmény — az éjszakai futások töltik."*
3. **„A {days.length} nap, amiből ez kijött"** — `PatternScatter` (`components/PatternScatter.tsx`,
   Task 12) over `detail.days`, a caption naming the latest aligned day (`latestAlignedDay`,
   `logic/patternHistory.ts`) and a `Napok listája →` toggle (local `useState`) revealing a plain
   `<table>` (`dátum · {metricALabel} · {metricBLabel}`, one row per aligned day). Cell values go
   through **`formatMetricValue`** (`logic/metricFormat.ts`, `mezo-fy97` — the wire carries raw
   doubles): hour-kind metrics (`late-meal-hour`/`bedtime-hour`/`wakeup-hour`, fractional clock
   hours; bedtime past-midnight-shifted `<12 → +24`) render as wall-clock `HH:mm`, binary metrics
   (`weekend`/`ritual-closed`) as `igen`/`nem`, everything else trimmed to one decimal — the key
   sets mirror the backend `MetricKey` extractors and need an entry when a new hour/binary metric
   lands. The scatter's x-axis end labels come from the sibling **`axisEndLabels`** (named columns
   `hétköznap`/`hétvége` for `weekend`, `korábban`/`később` for hour metrics, the mockup's generic
   `alacsony`/`magas` otherwise); under 2 days →
   *"Még nincs elég nap az összevetéshez…"* instead of the chart+toggle (both chart components
   already return `null` under 2 points — Task 12 — this is the page's matching text fallback).
4. **„A minta története"** — `PatternJournal` (`components/PatternJournal.tsx`, new) renders
   `journalEntries()` (`logic/patternHistory.ts`, Task 12 — the append-only `pattern_event` log
   translated to Hungarian) as a left-rail timeline: one tone-colored dot per entry (neutral/
   success/accent), the entry text through `SafeMarkdown` (`**Megerősítetted.**` → bold — the same
   bold-only renderer curated app copy uses elsewhere), and a `→ a Tudástárban` link on the
   `confirmed` entry that was later promoted (`entry.factLink`).
5. **„Mit kezd ezzel az app"** — `PatternImpactCard` (`components/PatternImpactCard.tsx`, new) over
   `detail.impact`. Only renders the real rows when the pattern is judged-and-confirmed
   (`pattern?.status === 'confirmed'`) — **Tudástár-tény** (`×N megerősítve · benne van a társ
   promptjában` / `nincs a promptban`, → `/insights/knowledge`), **N előrejelzés** (`{validated}
   bejött · {pending} még fut`, → `/insights/predictions`), **N kísérlet** / **N kihívás** (an
   honest generic open/closed status breakdown — `experiments`/`challenges` carry DIFFERENT status
   vocabularies (`ExperimentStatus`/`ChallengeStatus`), so the row counts "still open"
   (`proposed`/`active`/`accepted`) vs "closed" rather than importing either enum, → `/insights/experiments` /
   `/train`). Any row whose ref list is empty is simply omitted (a fresh promotion may not have
   grounded anything downstream yet). Not-yet-confirmed (or no-row) pairs get a single future-tense
   row instead: *"Ha megerősíted: bekerül a Tudástárba és a társ fejébe, előrejelzés és kísérlet
   épülhet rá."*
6. **„🔧 Motor-diagnosztika"** — collapsed by default, **`LifecycleSection` reused** (`count={1}` so
   it never hides — the prop's list-count semantics don't quite fit a single diagnostics block, a
   deliberate small mismatch rather than a component fork). Window/lag/last-run
   (`Ablak: {windowFrom} – {windowTo} ({lookbackDays} nap) · lag: {lagDays} nap · utolsó futás:
   {lastRunAt}`, a local `lastRunLabel` mirroring `MotorStateHero`'s private one), a freeze note on
   a judged row (**gated on `pattern?.status` being `confirmed`/`rejected`, deliberately NOT
   `pair.verdict === 'frozen'`** — the mock showcase pair's own `verdict` stays `'live'` even though
   its `Pattern.status` is `'confirmed'`, a Task 11 seed simplification reusing the same
   `patternMonitor.pairs` row for both surfaces, §9), the two metric source chips (`{label} ·
   {sourceHu}`, from `usePatternMonitor().monitor.metrics`), and the mono `r=… · n=… · p=…` stat —
   **the ONLY place this page renders raw statistics**, matching the dashboard's own
   never-raw-stats discipline (§2.1 step 2). Since `mezo-fy97` the stat is rounded to the approved
   mockup's precision via `formatR`/`formatP` (`logic/metricFormat.ts` — r two decimals, p three
   with trailing zeros trimmed, `<0.001` below display precision, `—` on null) instead of printing
   the wire's full double precision.

### 2.2 Weekly (`pages/WeeklyPage.tsx`) — **REAL dual-mode since D′ (`mezo-t16y.1`)**
A big `score` `/100` with a `delta` label, a bordered list of `weekly.items` (label · value · trend arrow `↗/↘/→`), then a "Mezo · heti tervjavaslat" card, and (E3 `mezo-6ng8`) a **"Growth — heti" `GrowthWeekCard`** last. Reads `useWeekly()` (`data/insights/weeklyHooks.ts`, exported via the `hooks.ts` barrel) → `{ weekly:{title,score,delta,items}, deltaLabel, weeklySuggestion, growthWeek, mode }`.
- **Growth-week card (E3):** `<GrowthWeekCard growth={growthWeek} />` (`components/GrowthWeekCard.tsx`) renders the week's **Küldetések** `{completed}/{closed}`, **LIFE XP** `+N`, **Tevékenységek** count, and a **Megtakarítás** `{amount} Ft` row (only when > 0). Empty/zero week (or a null on error) → the honest line *"Még nincs growth-adat ezen a héten."* This is the growth domain's *weekly* Insights surface; the growth domain's dedicated home is the separate **`/me/growth` page** (all-band skills + a 30-day journal + badges/perks, `mezo-rmhr`) — the domain (quests, activity log, savings, adaptive difficulty, flavor copy) lives in [`growth.md`](growth.md).
- **Mock:** byte-parity with the Phase-1 seed — `mockWeekly` + `deltaLabel 'vs hét 20'` + the seed `weeklySuggestion` prose with inert **"Elfogad" / "Hangoljuk"** buttons.
- **Real:** the review is **composed client-side** from the user's own data (no Insights backend — see §3) with a **documented deterministic score** (§4 / the formula in `weeklyHooks.ts:146-154`). `deltaLabel` becomes `'vs előző hét'`; `title` date-derives (`Hét N áttekintés · …`). **Since proactive W1 (`mezo-h4wp.3`) the tervjavaslat card is LIVE:** `weeklySuggestion` fetches the generated plan prose from `GET /api/proactive/weekly-suggestion` (via `weeklySuggestionApi`, `['weeklySuggestion', start]`, `retry:false`); when present the card renders it, and the inert **"Elfogad" / "Hangoljuk"** buttons are **hidden** (`mode !== 'mock'`, `WeeklyPage.tsx:66-71` — false affordance). On the **404** (no prior-week narrative memory yet) `weeklySuggestion` is **null** → the card falls back to the honest placeholder *"A társ heti tervjavaslata hamarosan."* — the D′ null-path is now the **degraded** path, not the default. Details: [`proactive.md` §2/§5.5](proactive.md).
- **Honest null-state:** when no sub-score has data the `score` is **null** and the page renders the patterns-precedent **„tanulom"** placeholder (*"még gyűjtöm az adatokat a heti értékeléshez"*, `WeeklyPage.tsx:27-35`) instead of a fabricated number; `delta` is likewise null when either week's score is missing. The **Súly trend** row is trend-only (goal-ward arrow) and is **excluded from the score**.

### 2.3 Memoir (`pages/MemoirPage.tsx`) — **REAL dual-mode since proactive W2 (`mezo-h4wp.4`)**
The companion's literary weekly narrative. Reads `useMemoir()` (`data/insights/memoirHooks.ts`, exported via the `hooks.ts` barrel) → `{ memoir: Memoir | null; anniversaryNote: string | null; mode }`. The `PhaseTeaserCard` guard is **gone** — the page now renders on real data.
- **The memoir card** (both modes when a memoir exists): `memoir-card` with radial glow, bookmark eyebrow + `Heti memoár · {memoir.week}`, display title, long `body` prose, and an **Anchors** row rendering `RefTag` per `memoir.anchors` (`[kind] label`). Real mode's `memoir.week` is a **client-derived label** `Hét N · …` (from the server `weekStart` via `isoWeekNumber`/`deriveWeekTitle`); the anchors are the code-collected, model-selected `Memory`/`Pattern` refs off `GET /api/proactive/memoir` (owned by the proactive layer — [`proactive.md` §2/§5.6](proactive.md)).
- **Honest null-state (real mode):** on the **404** (no narrative memory in the last completed week) or while loading, `memoir` is **null** → the page renders an honest placeholder card (eyebrow `Heti memoár` + *"Az első memoár a hét zárásakor készül el."*), never demo fiction. Mock always has the seed, so a null memoir only ever occurs in live mode.
- **Mock-only demo extras:** the four reaction toggles (👍 Like / Love / Save / Dismiss, local `Record<ReactionKey, boolean>` — unpersisted), the "Évforduló · 1 hónap" card (`anniversaryNote`), and the static "Memoir archive · 17 darab →" footer all wrap in `mode === 'mock' ? (…) : null` — **hidden in live mode** (unpersisted interactivity / no backend = false affordance; the Weekly „Elfogad/Hangoljuk" precedent). Persisted reactions are a filed follow-up; anniversary + archive are a deferred epic ([`proactive.md` §9 decision o](proactive.md)). Mock render is byte-identical to Phase 1.

### 2.4 Knowledge (`pages/KnowledgeListPage.tsx`) — **real dual-mode since companion V1.2, érthetőség-redesign `mezo-9ryh` + review fix wave**
A companion fact-memóriájának L2 confirm felülete ([`companion.md`](companion.md) §4). Betöltési sorrend, mielőtt bármi más renderelne: `isPending` → `GhostState` („A tudástár betöltése…", `useKnowledge()`-ből forwardolt real-mode-only cold-load guard, a `PatternsPage.tsx` mintáját követve — mock mode `isPending`-je mindig `false`); `isError` (genuinely failed fetch, pl. 500) → `GhostState` retry CTA-val (`refetch`), hogy egy valós hiba sose olvasson az őszinte-de-hazug „0 megy a chatbe" `realEmpty` állapotként; majd a meglévő `degraded` (companion switch-off 404) ág. A lap fentről lefelé:
- **Fejléc** — `Tudástár · N tény` + `M megy a chatbe`, ahol M a ténylegesen injektált tények száma a TELJES (szűretlen) listán, **nem** az összes bekapcsolté: a `bucketFacts()` a backend két injektálási csatornáját tükrözi — a rangsoros top-N blokkot (`reinforced DESC, createdAt DESC`, `PROMPT_TOP_N = 10`, a `mezo.companion.facts.top-n` kézzel szinkronban tartott tükre) ÉS a `renderNewPatternFactsBlock()` friss-minta kivételt (minden bekapcsolt, `source: 'pattern'` tény, ami `PATTERN_ACK_DAYS = 3` napon belül jött létre, a rangsortól függetlenül bekerül — a `mezo.companion.facts.pattern-ack-days` tükre, mindkét konstans `data/insights/knowledge.ts`-ben).
- **`KnowledgeExplainer`** (`components/`) — összecsukható „Hogyan működik a tudástár?" panel; elsőre nyitva, az összecsukott állapot `localStorage`-ben (`mezo.knowledge.explainer.collapsed`, olvasás/írás try/catch-csomagolva — letiltott site-storage-nál `SecurityError`-t dobna render közben, a `morningWindow.ts`/`nightTrace.ts` idiómája szerint best-effort). A „Miért marad ki néhány?" bekezdés megnevezi a friss minta-tény kivételt is.
- **„Jóváhagyásra vár · N"** — `FactCandidateCard` (`components/`, a page-ből kiemelve): **Elfogad** / **Pontosít** (inline input → Mentés) / **Elvet** → `useKnowledgeActions().decide(...)`, alatta a három gomb hatását kiíró sor. Confirm sosem néma (IDENT-6).
- **Genuinely üres tudásbázis** (`facts.length === 0`, nem pending/error/degraded) — a kereső/kategória-chip sor és a szakaszok helyett egy őszinte sor: „Még egy tényt sem tanultam rólad — ahogy beszélgettek, itt fognak megjelenni."
- **Kereső + kategória-chipek** — `.searchfield` + `chip tapchip` sor (`Mind` + `FACT_CATEGORIES`); a szűrés csak a megjelenítést szűkíti, a vödrözés mindig a TELJES listán fut (különben egy aktív szűrő átírná a prompt-státuszokat). A keresés (`matchesQuery`) a humanizált szövegre, a kategória-címkére ÉS az eredet-mondatba fűzött minta-címre (`patternTitle`) illeszkedik. A **„Mind" chip csak a kategóriát törli** — a keresőmezőt érintetlenül hagyja. Nulla találat → „Nincs találat a keresésre." + egy „Szűrők törlése" gomb, ami mindkettőt (keresés + kategória) törli.
- **Három prompt-státusz szakasz** — „Most ezeket kapja meg a társ · N" (a SZŰRT darabszám, a globális fejléccel ellentétben; a lábjegyzet mondja ki a `PROMPT_TOP_N` + friss-minta kivétel szabályt), majd két `LifecycleSection` (újrahasznosítva a Minták dashboardról): „Bekapcsolva, de most kimarad" **nyitva indul** (`defaultOpen`), „Kikapcsolva" csukva — egy frissen elfogadott tény-jelölt `reinforced: 0`-val a várakozó vödörbe sorolódik, és eltűnne a DOM-ból abban a pillanatban, amikor a felhasználó elfogadja, ha a szakasz csukva indulna. Mindkét `LifecycleSection` megkapja a `forceOpen`-t (`LifecycleSection.tsx`, opcionális, visszafelé kompatibilis prop — a `PatternsPage`/`PatternDetailPage` hívói nem adnak át semmit, változatlanok), amíg aktív szűrő fut (nem üres keresés vagy `category !== 'all'`) — enélkül egy csak a „Kikapcsolva" vödörre illeszkedő keresés összecsukott fejlécet mutatna, találat nélkül.
- **`KnowledgeFactRow`** (`components/`) — önmagyarázó kártya: kategória + eredet-chip, humanizált cím, eredet-mondat, visszaigazolás-mondat, és a `Toggle` mellett kimondott státusz-címke („Most benne van a chatben" / „Bekapcsolva, de most kimarad" / „Kikapcsolva — a társ nem látja").

**Minden felhasználói mondat a `logic/factCopy.ts` tiszta moduljából jön** (unit-tesztelt): `humanizeFactText()` az „A ↔ B" alakú minta-tényekből mondatot képez (a promóció a minta CÍMÉT másolja a tény szövegébe — `PatternService.promote()`), `originSentence()`/`originChipLabel()` a `source`-ot fordítja, `reinforcementSentence()` a `×N reinforced`-et. **A régi önismétlő `minta: {title}` chip megszűnt** — a minta-cím már csak akkor jelenik meg (evidenciaként, az eredet-mondat végén), ha eltér a tény szövegétől. A humanizálás egy szó akkor tekinti rövidítésnek (és hagyja változatlanul, névelőt is a betűnév kiejtése — nem az írott alak — szerint választva, pl. **„az RPE"**, **„a HRV"**), ha a szó ELSŐ KÉT karaktere nagybetű (a toldalékolt „HRV-alapú" is helyesen felismerve); a záró mondatvégi írásjelet mindkét oldalról levágja, hogy ne dupláződjon a sablon lezáró pontjával.

Real mode a companion switch-off 404-en változatlanul az őszinte degraded bannert adja (*"A társ jelenleg nincs bekapcsolva…"*). Lábléc: *"A graph nézethez · Me → Knowledge."* (§5).

### 2.5 Chat (`pages/ChatPage.tsx`) — ✅ REAL since companion V0.4 (chips real since V0.5)
The companion conversation, **dual-mode** over `useChat(selection)` + `useChatActions(selection, onCreated)` + `useConversations()` (from `@/data/hooks`; backend + hook details in [`companion.md`](companion.md) §3/§5.1). Header: "Mezo · társ" + an **honest mode subtitle** (`demo beszélgetés` / `Gemini · élő` / `új beszélgetés` / `a társ most nem elérhető`) — the Phase-1 fake "`23 facts active`" string and "L4 aktív" chip are gone — plus two chip actions: **Beszélgetések** (opens `sheets/ConversationPickerSheet.tsx`) and **Új beszélgetés**. **Real mode:** bootstraps the selected conversation + history, `send()` renders the optimistic user bubble + thinking-dots, then the answer **streams in** (SSE deltas into a draft bubble) and the persisted pair lands in the `['chat', <selection>]` cache; stream failure → inline error bubble + history refetch; companion switch off (404) → degraded banner (`A társ jelenleg nincs bekapcsolva…`) + disabled composer, no dead-end (IDENT-3). **Mock mode:** the Phase-1 demo — `initialChat` seed + the 1.2s `cannedReply` (branches on `"fáradt"`, fabricated `tools`/`refs`). Only the seeded `mock-conversation` carries that transcript: a conversation started during the session opens EMPTY and gets its own auto-title from the first message, exactly as it would against the backend (`mockThread()` in `chatHooks.ts` — returning the seed for every id made new mock threads inherit the demo's messages).

**Which conversation is on screen (`mezo-at8x.3`)** lives in the URL: `?c=<uuid>` a persisted thread, `?c=new` an unsent draft one, no param the newest. A draft thread shows a one-line invitation instead of a blank page and only becomes a server row **on the first send** (lazy create → `onConversationCreated` moves `?c=` onto the new id), so opening "Új beszélgetés" and walking away leaves nothing behind. The picker sheet lists the persisted conversations newest-first with their server-side auto-title (first user message, truncated) and a `ma/tegnap/<hó nap>` stamp.

**Scrolling + composer (`mezo-at8x.2`).** The chat rides `.screen-content`, the single app scroller, so `logic/useStickToBottom.ts` drives *that* element **inside a rAF** — `ScreenContent` resets it on every route change and a parent's effect runs *after* its children's, so a scroll issued straight from ChatPage's effect gets undone on the way in. Every scroll uses **`behavior: 'instant'`**: `.screen-content` carries `scroll-behavior: smooth`, which a bare `scrollTop =` (and `behavior: 'auto'`, which per spec defers to the CSS value) inherit — and a smooth scroll in this container is cancelled by the next scroll operation, so it lands nowhere. `ScreenContent` itself was switched to an instant `scrollTo` for the same reason (its animated reset was eating the chat's scroll-to-newest). A `ResizeObserver` re-anchors while the user is parked at the bottom, which covers both late layout (fonts/cards) and a streaming answer; a 500 ms settle window keeps a programmatic scroll's own events from reading as "the user scrolled up". Opening a thread parks on the newest turn, and a streaming answer only pulls the view down while the user is within 96 px of the bottom. The composer is `.chat-composer` — `position: sticky; bottom: var(--screen-bottom-pad)` — pinned right above the tab bar; `.chat-page`/`.chat-thread` turn the page into a column so a two-message thread keeps it at the bottom instead of mid-screen.

**Composer:** mic button (**live since `mezo-at8x.4`** — `logic/useVoiceInput.ts`: `getUserMedia` + `MediaRecorder` → 16 kHz mono WAV (`shared/lib/audio.ts`) → `useTranscribe()` → the transcript is **appended to the input, not sent**, so the user checks it first; recording state = coral chip + `voice-wave` icon + `Hallgatlak…` placeholder, then `Leiratozom…`; unsupported/denied mic → disabled button or an honest one-liner), controlled **auto-grow `<textarea>`** (`mezo-a837`): `rows=1`, and a layout effect re-measures it on every keystroke (height → `auto` → `scrollHeight`, capped at `COMPOSER_MAX_HEIGHT` = 104 px ≈ 5 sor, then the field's own `overflow-y: auto` takes over) — a long message **wraps and stays fully visible** instead of scrolling sideways out of view, which the old single-line `<input>` did. **Enter sends** (unchanged), **Shift+Enter breaks a line**, and an IME composition swallows neither; the composer row is `align-items: flex-end` so the mic/send chips stay pinned to the bottom edge while the field grows. Send button. **`ChatMessage`** (`components/ChatMessage.tsx`): user bubbles right-aligned (`white-space: pre-line`); assistant bubbles left, the answer rendered through **`<Markdown>`** (`shared/lib/markdown.tsx`, `mezo-at8x.1`) as real blocks — paragraphs, `-`/`1.` lists, `##` headings, inline bold/italic/code — instead of the old single `<p>` that printed the model's `**` marks literally and collapsed its line breaks; preceded by a `ToolChipRow` and followed by a "Hivatkozott · L3" footer of `RefTag`s when `refs` present — **real data since companion V0.5**: tool-using turns arrive with `tools[]` (`{type:'read', name:'get_recovery(scope=sleep, days=3)'}` — args baked into the name) and tool-contributed `refs[]` (kinds: `Workout`/`Sport`/`Run`/`WeightTrend`/`Sleep`/`FuelDay`/`Protocol`/`Goal`/`Medication`, plus more since V2.3/mezo-xixu — full kind catalog in [`companion.md`](companion.md) §4); **since mezo-280 chips also render live on the in-flight draft bubble** — each `tool` SSE event appends onto `ChatTurn.tools` and renders through the same `ToolChipRow` as the tool executes, instead of appearing all at once after the answer; the draft (chips included) is still discarded wholesale when the terminal `done` row is appended, so that row's `tools[]` remains the persisted truth. Since
**companion V1.3** an assistant bubble whose answer failed the backend advisor self-check even
after the corrective retry (`MessageResponse.degraded`) carries a subtle `nem ellenőrzött`
eyebrow next to the timestamp (tooltip; [`companion.md`](companion.md) §2) — mock mode never
shows it.

### 2.6 Predictions (`pages/PredictionsPage.tsx`) — **REAL dual-mode since proactive P1 (`mezo-h4wp.7`)**
The tab **un-ghosted at P1**: `usePredictions()` (`data/insights/predictionsHooks.ts`) reads `GET /api/proactive/prediction` (a list; `[]` on loading/error — never a 404) and returns `{predictions, mode}`. Each `Prediction` card renders a status chip (`✓ Validated` / `✗ Missed` / `◐ Pending`), the derived window-label date, the display title, the confidence `bar-fill glow` + `NN%` **only when confidence is present** — otherwise the honest **„tanulom"** chip (a statistical pattern carries no confidence, so most v1 rows read „tanulom", never a fabricated %) — the optional `basis` paragraph, and (once the validation job closed the window) the code-formatted `actual` outcome line. The header's right side is the **accuracy derived from CLOSED rows** (`validated / (validated+missed)`), shown only when at least one has closed. An empty live list renders the honest **still-learning null-state** *"Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul."*. **Mock mode** keeps the Phase-1 seed + the literal `2 validated · 60-day acc 68%` header (byte-parity). Behavior detail in [proactive.md §2](proactive.md).

### 2.7 Experiments (`pages/ExperimentsPage.tsx`) — **REAL dual-mode since proactive P2 (`mezo-h4wp.8`)**
The **last** tab un-ghosts, and it's the first Insights surface with a WRITE. `useExperiments()`
(`data/insights/experimentsHooks.ts`) reads `GET /api/proactive/experiment` (a list; `[]` on
loading/error — never 404), `useExperimentActions()` provides the L2 mutations. Each card renders a
status chip — `◇ Javaslat` (proposed) / `◐ Aktív` (active) / `✓ Megerősítve` / `◯ Nem igazolódott` /
`◌ Nem értékelhető` (completed, by `outcomeGood` true/false/undefined) — a `day/total nap` counter +
progress bar (active/completed only), the title/hypothesis, and the code-formatted `outcome` line.
**Proposed rows** render **Elfogadom / Elvetem** buttons that `POST …/decision` (accept → active,
dismiss → gone); the footer **„+ Új kísérlet javasol Mezo"** button really proposes (`POST …/propose`)
in live mode. An empty live list renders the honest null-state *"Az első N=1 kísérletet a megerősített
mintákból javasolja Mezo."*. **Mock mode** keeps the Phase-1 seed (active + completed cards, the inert
propose CTA — no proposed rows, so no accept/dismiss buttons). Behavior detail in [proactive.md §2](proactive.md).

### 2.8 Motor — **RETIRED** (`mezo-viqs`/`mezo-18bx` → retired `mezo-tk88.4`)
The standalone Motor tab (`pages/MotorPage.tsx`) — a read-only transparency page onto the pattern
gate — **no longer exists**. Its diagnostics were absorbed into the Patterns dashboard (§2.1: the
hero's stamp/tiles, the `MetricCoverageRing` list under „Adat-egészség") and grew into the
per-pattern **pattern-pair detail page** (§2.1b, `/insights/patterns/{pairKey}`, `mezo-tk88.5`) for
the per-pair drill-down (source chips, raw `r/n/p`, the strength timeline).
`router.tsx` maps `/insights/motor` to `<Navigate to="/insights" replace />` so old links/bookmarks
still resolve. Every LIVE-recomputation guarantee Motor made (§2.1: no persistence, no historical
log, never disagrees with the nightly job — [`companion.md`](companion.md) §1 V3.1) carries over
unchanged, since the same `usePatternMonitor()` read now backs the dashboard.

**What did NOT carry over 1:1** (deliberate simplifications of the redesign, not gaps): Motor's
**per-verdict filter chips** (`VerdictFilterChips`, `live`/`few_days`/`no_data`/`degenerate`/`frozen`
toggles) are gone — the dashboard's lifecycle buckets (§2.1) already partition by verdict/status,
so a separate verdict filter would be redundant; only the **domain** chip filter survives, now on
the hero itself. Motor's **domain sections** (`DomainSection`, one collapsible card per
metric-B-domain, `groupPairsByDomain`) are superseded by the lifecycle buckets as the primary
grouping axis — `logic/domains.ts` (`DOMAIN_META`/`groupPairsByDomain`) itself is **kept** and
still used for the hero's domain chips. Motor's expandable **`PairRow`** (source pills + raw
`r/n/p` + „Minta megnyitása →") is gone — the raw stats moved to the pattern-pair detail page's
collapsed „Motor-diagnosztika" section instead (§2.1b); the dashboard's decision cards and
lifecycle rows never render raw `r`/`p`/`n`, only the human
`findingSentence`/`confidenceMeta`/`verdictSentence` translations that already existed
(`logic/findings.ts`/`logic/verdicts.ts`, unchanged, still exercised by the dashboard).

### 2.9 Memória (`pages/MemoryPage.tsx`) — read-only memory-layer observatory since `mezo-al1i`
The companion's own memory pipeline made legible: not another results tab, but a transparency page
onto the **L0→L3 memory stack itself** (raw daily metrics → the L1 episodic journal + vectors → the
L2 judgement inbox → L3 durable knowledge) — the spine [`companion.md`](companion.md) documents by
version slice, rendered live. Four **local segments** behind `useStickyTab('insights.memoria.view')`
(`Áttekintés` / `Napló` / `Kereső` / `Audit`, a segmented-control bar identical to the
Growth/FuelSlots idiom, `MemoryPage.tsx:37-45`) — this is a **page-local** sub-nav, not a router
route; all four read off two page-level hooks (`useMemoryOverview()`, `useMemorySummaries()`, both
`@/data/hooks`), so switching segments never refetches. A single **degraded card** (companion off →
404 on the overview call) replaces the whole page with a link to `/insights/motor` (redirects to
`/insights`, §2.8 — the link survives the Motor retirement as an extra hop, not yet repointed); the
loading window renders `GhostState` — the same loading/degraded/error three-state discipline the
retired Motor tab pioneered, now carried by the Patterns dashboard (§2.1).

- **Áttekintés (`components/MemoryLayersPanel.tsx` + `MemoryLayerCard.tsx`):** four wash-tinted
  layer cards top to bottom — **L0** (neutral `text-tertiary` wash: `daysWithAnyData/windowDays` —
  how many days in the pattern-detection lookback window carry data on ANY `MetricKey`; **the
  synthetic `MetricKey.WEEKEND` series is deliberately excluded from this union** — it is a
  calendar-derived 0/1 that never misses a day, so folding it in would always saturate the count to
  the full window), **L1** (`--wash-lav`: `daily_summary` count + `dailySummary`/`chatTurn`
  embedding counts + the first/last summary date — tappable, opens the Napló segment), **L2**
  (`--warning` wash: pattern rows by `kind`×`status` + the pending `learned_fact` candidate count,
  "last" stamp = `jobs.lastDetectedAt` — tappable, routes to `/insights` the Patterns inbox), **L3**
  (`--success` wash: confirmed-fact counts by `source` + total `reinforcement_count` +
  `factsInPrompt` — tappable, routes to `/insights/knowledge`). Between cards, a pulsing dashed
  **`FlowConnector`** in the NEXT layer's own accent colour, labelled with the raw cron string for
  the job that fills that layer (`summaryCron`/`patternCron`/`hypothesisCron` — the FE never parses
  cron, same discipline as the Patterns dashboard's hero, §2.1) — the pulse is CSS (`.memory-flow-line`,
  `prototype.css`) and is disabled under `prefers-reduced-motion: reduce`. A footer link — "Miért
  nem lát még mintát a motor? →" — completes the mutual cross-link with `/insights/motor` (§2.8
  carries the reverse link).
- **Napló (`components/MemoryJournalPanel.tsx`):** the L1 journal as `memoir-card`-styled cards
  (reusing the Memoir tab's card anatomy, §2.3), grouped under `eyebrow` month separators (client
  month-derived from `date`), each card carrying a small corner dot — solid `--success` = a live
  `daily_summary` embedding exists (`embedded: true`), dim `--text-tertiary` = not yet vectorized —
  and the full narrative prose. A `focusDate` prop (set by the Kereső segment's `onPick`, §below)
  scrolls the matching card into view via `scrollIntoView({block:'center'})` in a `useEffect` keyed
  on `focusDate`, and outlines it. Empty state: an honest ghost line that the first nightly summary
  hasn't run yet — never demo fiction.
- **Kereső (`components/MemorySearchPanel.tsx` + `SimilarDayCard.tsx`):** a **lazily-submitted**
  search — the query fires on form `onSubmit`, never on keystroke (`useSimilarDays(query)`,
  `data/insights/memoryHooks.ts`, a raw `useQuery` — not `useDualQuery` — gated `enabled: query
  trim non-empty`; mock branch resolves the deterministic `similarDaysSeed` via `initialData`; real
  branch calls `memoryApi.similarDays(query, 3)`, 404→`degraded`). Each **`SimilarDayCard`** renders
  an SVG similarity ring + a mirrored bar + the excerpt + the **`egyezés × frissesség = végső`**
  three-chip score row: `similarity` (raw cosine, the wire's own field) × a client-derived
  **`frissesség`** (freshness — recovered as `finalScore / similarity`, i.e. exactly the server's
  own `exp(-age/τ)` decay factor divided back out, never resent on the wire) = `finalScore` (the
  wire's rank key); freshness colours `--success` at ≥0.9, else `--warning`. Tapping a card calls
  `onPick(date)`, which `MemoryPage` wires to set `focusDate` **and** switch the segment to Napló —
  a cross-segment jump, not a route change.
- **Audit (`components/MemoryAuditPanel.tsx` + `TokenColumns.tsx`):** two independently-degradable
  blocks. **(1) Cost** — a cost-hero (`totals.costUsd`, `$0.000` formatted, `—` when null) plus
  `TokenColumns` (a small stacked SVG bar chart, one bar per day — `--dv-lav` bottom segment =
  input tokens, `--dv-sage` top = output tokens) off `useLlmUsage()` (`GET
  /api/companion/memory/llm-usage?days=30`); **`enabled:false` renders its own explicit "audit-log
  ki van kapcsolva" card** (the response itself says so — not an error state, not the degraded
  banner) — a THIRD honest state alongside loading/degraded/data, because "audit switch off" and
  "companion switch off" are different truths the panel must not conflate. **(2) Provenance** —
  reuses `useKnowledge().facts` (the same hook the Knowledge tab uses) grouped by `source` in
  **trust-chain order** `chat → pattern → manual`; each `FactProvenanceRow` shows the fact text,
  `×N megerősítve`, the last-reinforced date or an honest "még nem erősítette meg újra", and (on
  `source=pattern` facts) the existing V3.3 `minta: {title}` evidence chip. This panel is the FIRST
  consumer of `KnowledgeFact.source`/`lastReinforcedAt` (below) beyond the wire itself.
- **Degraded ties:** the page-level degraded card (companion 404 on `useMemoryOverview`) covers
  Áttekintés/Napló; Kereső and Audit carry their OWN inline degraded lines because their two queries
  (`useSimilarDays`, `useLlmUsage`) are independently lazy/dual-mode — a mid-session companion outage
  can surface per-panel rather than page-wide.

**Known asymmetry since the Motor retirement (`mezo-tk88.4`):** the retired `MotorPage` used to
carry the reverse of the Áttekintés footer link — a "Memória-obszervatórium →" line under its
coverage table, making the two read-only diagnostics surfaces mutually reachable. The Motor-retire
task ported only the metric-coverage-ring wiring into the new Patterns dashboard (§2.1), not this
cross-link, so today the link is **one-way** (Memória → `/insights/motor`, redirecting to
`/insights`); a reverse link back to Memória from the dashboard's „Adat-egészség" section is a
small filed follow-up, not yet done.

---

## 3. Architecture & data flow

The Insights data flow is a **degenerate (truncated) version** of mezo's standard `view → hook → mock/real → api → backend → db` pipeline — it stops at the hook:

```
View (PatternsPage, WeeklyPage, …)
  → hook (useInsights / useKnowledge / useChat — frontend/src/data/hooks.ts:11-18)
    → static module import (data/insights/insights.ts, data/insights/knowledge.ts, data/insights/chat.ts)
      → [PHASE-3 GAP: no api client, no apiFetch, no backend, no db]
```

Contrast with a real-mode feature (e.g. `useWeight` in `weightHooks.ts` / `useSleep` in `hooks.ts:79`) which switches on `isMockMode()` between static `initialData` and a real `*Api` call over `apiFetch`. The Insights hooks have **none of that machinery** — no TanStack Query, no `initialData`, no mutation, no mode switch:

- `useInsights()` (`data/insights/insightsHooks.ts`) → `{ patterns, recentlyConfirmed, memoir, anniversaryNote, predictions, experiments }` — direct static re-exports. **Every page has now split out to its own dual-mode hook** (Weekly at D′, Memoir at W2, Predictions at P1, **Experiments at P2** → `useExperiments()`/`useExperimentActions()`). **`useInsights` has NO live consumers left** — `PatternsPage` uses `usePatterns` (V3.1). The `memoir`/`anniversaryNote`/`predictions`/`experiments` fields survive only because the dedicated hooks re-import the seed straight from `insights.ts` for their mock branch; `useInsights` itself is now effectively dead and can be removed in a cleanup pass.
- `useKnowledge()` (`data/insights/knowledgeHooks.ts` since V1.2) → dual-mode `{ facts, candidates, edges, activeCount, degraded, mode, isPending, isError, refetch }` (`['knowledge']` `useDualQuery`; real fetches `GET /api/companion/fact` + `.../fact/candidate`, `edges` real-mode `[]`; mock = seed). `isPending`/`isError`/`refetch` forwarded straight from `useDualQuery` (`mezo-9ryh` review fix) — `KnowledgeListPage` gates on them before rendering any prompt-status number (§2.4). Actions: `useKnowledgeActions()` → `{ toggle, decide, pending }`.

**Exception — Chat swapped at companion V0.4:** `useChat()` + `useChatActions()` moved to
`data/insights/chatHooks.ts` (re-exported from the `hooks.ts` barrel) and are **real dual-mode**
— `useChat` is a `useDualQuery` bootstrap (`{conversationId, messages, degraded, mode}`; mock =
`initialChat` seed, real = newest conversation + history via `chatApi`, 404 → degraded ghost),
`useChatActions` is the send/stream state machine over the SSE client (`chatApi.streamMessage`,
`apiSse` in `data/_client/api.ts`). Details: [`companion.md`](companion.md) §5.1.

**Exception — Weekly is REAL by CLIENT-SIDE COMPOSITION (D′, `mezo-t16y.1`):** `useWeekly()` (`data/insights/weeklyHooks.ts`, re-exported from the barrel) needs **no Insights backend** — real mode composes the review from reads the other features already expose, so the pipeline fans OUT instead of stopping at a single api client:

```
WeeklyPage → useWeekly()  (data/insights/weeklyHooks.ts)
  MOCK: { mockWeekly, deltaLabel 'vs hét 20', mockWeeklySuggestion }   (byte-parity seed)
  REAL: deterministic composition over the user's own reads —
    ├─ ['fuelWeek', start] ×2 weeks  → mealApi.getWeek(start)   (F-P4 aggregate GET /api/fuel/week/{start})
    ├─ ['insightsWeekly','workouts', start] ×2 → trainApi.listWorkouts(start, weekEnd)   (GET /api/train/workouts?from&to — completed workouts = "done" since mezo-cd8s)
    ├─ ['insightsWeekly','sportSessions'|'gymSchedule'|'sportSchedule'] → trainApi.*   (sessions "done" + schedules "planned")
    ├─ useSleep().sleepLog        (client-filtered per week via inWeek())
    ├─ useWeight().weightTrends   (EWMA last7d.weeklyRate — trend-only row)
    ├─ ['weeklySuggestion', start] → weeklySuggestionApi.get   (W1: GET /api/proactive/weekly-suggestion; 404→null)
    └─ ['insightsWeekly','growth', start] → growthWeekApi.get   (E3: GET /api/progression/growth-week/{start}; .catch→null)
      → deriveWeekMetrics() ×2 → deriveItems() + deriveScore()  (pure fns, weeklyHooks.ts:65-154)
```

The composition uses the `useRealQuery` idiom (the `fuelWeekHooks` pattern): mock resolves `null`, real fetches. Fuel rollups **share the F-P4 cache key** (`['fuelWeek', start]`); the raw train reads sit under an **own `['insightsWeekly',…]` namespace** so they don't collide with `trainHooks`' keys (which cache MAPPED domain shapes). The **`['weeklySuggestion', start]`** query (W1, proactive) and the **`['insightsWeekly','growth', start]`** query (E3, a Progression-backend read — the second backend-served field of `WeeklyView`, after W1's suggestion) are **bare `useQuery`** — `enabled: !mock`, `retry: false`, `weeklySuggestion` 404→null / `growthWeek` `.catch(()=>null)` — the rest are `useRealQuery`. **Known simplification:** `trainPlanned` uses the CURRENT gym+sport schedules for BOTH the current and previous week (no historical schedule read) — the schedule is treated as stable week-to-week (`weeklyHooks.ts:211`).

**Exception — Memoir is REAL by a PROACTIVE BACKEND READ (W2, `mezo-h4wp.4`):** `useMemoir()` (`data/insights/memoirHooks.ts`, re-exported from the barrel) is a dual-mode `['memoir']` `useQuery` (`retry: false`): mock returns the `insights.ts` seed + `anniversaryNote` synchronously (`initialData`, `staleTime: Infinity`, no fetch), real fetches `GET /api/proactive/memoir` via `memoirApi.latest` (`memoirApi.ts`, `toMemoir` wire→FE `Memoir` with the client-derived `Hét N …` label), 404→null. Returns `{ memoir: Memoir | null; anniversaryNote: string | null; mode }` — the note is always null in live mode. Unlike Weekly (composed client-side) the memoir is a single proactive-owned backend read; the endpoint + generator live in [`proactive.md`](proactive.md).

The remaining mock "interactivity" (pattern Confirm/Monitor/Reject, memoir reactions) lives in **component-local `useState`** and evaporates on unmount (in live mode the memoir reactions are hidden, not just ephemeral); the knowledge Toggle + candidate decisions are REAL since V1.2. The single FE↔data boundary (`hooks.ts`) is intact — chat (V0.4), knowledge (V1.2), patterns (V3.1), **weekly (D′)**, **memoir (W2)**, **predictions (P1)** and **experiments (P2, incl. the L2 write mutations)** all proved the swap; **no Insights tab is mock-only any more**.

---

## 4. Data model & API

> **No Insights-owned backend, contract, or DB.** Everything below is the **mock data shape** (the contract the views and tests pin). All types live in `frontend/src/data/types.ts:349-418` ("--- Tudás (knowledge) ---" + "--- Insights (AI-memory surface) ---"). Instances in `data/insights/insights.ts` / `data/insights/knowledge.ts` / `data/insights/chat.ts`. **Exception — Weekly (D′):** real mode is composed client-side over OTHER features' contracts (Fuel week, Train workouts/sport/schedules, biometrics) — no Insights endpoint; the one contract change D′ required is the new Train `listWorkouts` op (see below + `train.md` §4).

**Knowledge** (`types.ts:350-352`):
- `FactCategory = 'physiology' | 'preference' | 'trigger' | 'tendency' | 'goal_state'`
- `FactSource = 'chat' | 'pattern' | 'manual'` (`types.ts`, `mezo-al1i`) — the backend `knowledge_fact.source` CHECK values, mirrored FE-side for the Audit panel's provenance grouping (§2.9).
- `KnowledgeFact { id; text; category: FactCategory; active: boolean; reinforced: number; patternTitle?; source: FactSource; lastReinforcedAt: string | null }` — 15 facts (`f1`–`f15`, `knowledge.ts`). **`source`/`lastReinforcedAt` are new FE fields (`mezo-al1i`)** — the wire (`KnowledgeFactResponse`) has carried both since V1.1/V3.3, but `knowledgeApi.ts`'s `toKnowledgeFact` mapper only started reading them now, driven by the Memória Audit panel's need for provenance grouping + a last-reinforced date; the Knowledge tab itself (§2.4) does not render either field.
- `KnowledgeEdge { from; to; type: 'reinforces' | 'context' | 'causes' }` — 13 edges, a directed graph over fact ids
- Helpers in `knowledge.ts`: `FACT_CATEGORIES` (ordered `[id,label]`), `factCategoryColor()`

**Patterns** (`types.ts:355-373`):
- `PatternCategory = 'physiology' | 'trigger' | 'response'` (NB: distinct from `FactCategory`)
- `PatternStatus = 'confirm' | 'monitor' | 'reject'` (UI-local only, never on the data)
- `PatternCritique { statistical; confounders; l3align; actionability }` — four 0–1 scores
- `Pattern { id; category; categoryLabel; confidence; title; mechanism; evidence: string[]; critique; thinking? }` — 3 patterns `p1`–`p3` (`insights.ts`)
- `MIN_PATTERN_CONFIDENCE = 0.65` and `patternCategoryColor()` (`insights.ts:10-14`)

**Pattern-pair detail** (`types.ts:768-795`, `mezo-tk88.5`) — the §2.1b detail page's payload:
`PatternEventKind = 'snapshot'|'confirmed'|'monitoring'|'rejected'|'reinforced'|'promoted'` (mirrors
the backend `pattern_event` CHECK constraint 1:1), `PatternEvent { kind; occurredAt; r?; n?; p?;
reinforcementCount?; factId? }`, `AlignedDay { date; a; b }` (a live-computed scatter point, never
stored), `PatternImpactRef { id; title; status }`, `PatternImpact { fact; predictions; experiments;
challenges }`, `PatternPairDetail { pair: PatternMonitorPair; pattern: Pattern | null; events;
days; impact }`. Real mode maps **`GET /api/companion/pattern/pair/{pairKey}`**
(`data/insights/patternDetailApi.ts`, reuses `patternsApi.ts`'s `toPattern`) via
`usePatternPairDetail(pairKey)` (`patternDetailHooks.ts`, `['pattern-pair-detail', pairKey]`
dual-read; any 404 → one honest `notFound`, unlike the monitor's `degraded` — no distinct
"companion off" signal on this endpoint). Mock seeds in `insights.ts`: one hand-authored confirmed
„showcase" pair (`sleep-quality~next-day-training-rpe`) with a full 9-event history + 24 aligned
days + a promoted fact/2 predictions/1 experiment/1 challenge, and a minimal synthesized detail
(`pattern: null`, empty history/impact, `pair` straight off `patternMonitor.pairs`) for every other
catalog pair — a still-gathering pair with no persisted row yet.

**Memoir** (`types.ts:375-381`): `MemoirAnchor { kind; label }`, `Memoir { week; title; body; anchors }` — single `memoir` + `anniversaryNote` string. **Real mode (W2)** maps the same `Memoir` shape from the proactive `GET /api/proactive/memoir` (`MemoirResponse {weekStart, title, body, anchors[], generatedAt}` → `toMemoir`, the `week` label derived client-side); the FE type is reused **unchanged**, `anniversaryNote` stays a mock-only seed. Owned by the proactive layer, not Insights ([`proactive.md` §4](proactive.md); `api/feature/proactive/proactive.yml`).

**Weekly** (`types.ts:406-408`): `WeeklyTrend = 'up'|'down'|'flat'`, `WeeklyItem { label; value; trend }`, `WeeklyReview { title; score; delta; items }` — mock `weekly` + `weeklySuggestion` seed. **Real mode (D′)** builds the same shape client-side in `useWeekly` (`weeklyHooks.ts`), returning `WeeklyView { weekly; deltaLabel; weeklySuggestion: string|null; growthWeek: WeeklyGrowth|null; mode }`. Two of its fields come from real backend reads (the rest stays client-composed): **`weeklySuggestion`** (W1 — the proactive `GET /api/proactive/weekly-suggestion` → `prose`, 404→null) and **`growthWeek`** (E3 `mezo-6ng8` — the Progression `GET /api/progression/growth-week/{start}`, `.catch(()=>null)`).

**WeeklyGrowth** (E3, `types.ts`): `WeeklyGrowth { weekStart; questCompleted; questClosed; lifeXp; activities; savingsHuf }` — mirrors the backend `GrowthWeekResponse` (owned by the **Progression** domain, [`growth.md` §4](growth.md)); mock seed `growthWeek` in `insights.ts`, MSW defaults to honest zeros (never 404). This is the first WeeklyView field fed by the Progression backend rather than proactive/Fuel/Train.

**Weekly score — the documented deterministic formula (D′, `weeklyHooks.ts:146-154`):** `score = round(100 × mean(available sub-scores))`, equal weights, only sub-scores with data participate; **no data → null → the „tanulom" null-state** (never a fabricated number). Sub-scores: **kcal** closeness-to-target inside a ±`KCAL_BAND` linear band · **protein** hit-days/7 · **sleep** avg/`SLEEP_TARGET_H` (capped) · **train** done/planned (capped, skipped when planned=0). **Weight is EXCLUDED from the score** — it is a trend-only row whose arrow maps goal-ward (`weightTrendOf`: losing = good = `up`, single-user cut) off the EWMA `weeklyRate`, gated by `WEIGHT_RATE_EPSILON`. Constants are **exported FE `const`s** — `SLEEP_TARGET_H=8`, `KCAL_BAND=0.25`, `WEIGHT_RATE_EPSILON=0.1` (`weeklyHooks.ts:22-24`); **promote to backend config with the proactive epic** (`configuration_conventions.md`), same trajectory as `MIN_PATTERN_CONFIDENCE`. "Done" = the same semantics as Train's `weekDoneDates` — **explicitly completed workouts** (`status='completed'`) since `mezo-cd8s`, no longer the old ≥1-logged-set count (a started-but-unclosed gym session no longer counts toward the weekly train sub-score); trend arrows compare the current vs previous week (`trendOf`, epsilon-tied → honest `flat`).

**Predictions** (`types.ts`): `PredictionStatus = 'pending'|'validated'|'missed'`, `Prediction { id; title; confidence: number | null; status; date; basis?; actual? }` — **`confidence` went nullable + the `missed` status at P1** (honest-state additions); real data comes from `GET /api/proactive/prediction` (`predictionsApi`/`predictionsHooks`), the mock seed stays in `insights.ts`.

**Experiments** (`types.ts`): `ExperimentStatus = 'proposed'|'active'|'completed'|'dismissed'`, `Experiment { id; title; status; day; total; hypothesis; outcome?; outcomeGood? }` — **`proposed`/`dismissed` added at P2**; real data comes from `GET /api/proactive/experiment` (`experimentsApi`/`experimentsHooks`), the mock seed stays in `insights.ts`. The `day` counter derives client-side from the wire `startDate`/`totalDays`.

**Chat** (`types.ts:410-418`): `ChatRole = 'user'|'assistant'`, `ChatRef { kind; id }`, `ChatMessage { role; ts; text; tools?: Tool[]; refs?: ChatRef[] }`. `Tool` is imported from `@/shared/ui/ToolChip` (`{ type: ToolType; name; args? }`, `ToolType = 'read'|'compute'|'write'`). `initialChat` = 3 messages (assistant → user → assistant).

**Memory** (`types.ts`, `mezo-al1i`) — like Weekly/Memoir, real data comes from ANOTHER feature's backend (here: companion), not an Insights-owned one: `MemoryOverview { l0: {daysWithAnyData; windowDays}; l1: {summaryCount; firstDate; lastDate; embeddings: {dailySummary; chatTurn}}; l2: {patterns: MemoryPatternCount[]; pendingFactCandidates}; l3: {facts: MemoryFactSourceCount[]; totalReinforcements; factsInPrompt}; jobs: {summaryCron; patternCron; hypothesisCron; lastSummaryDate; lastDetectedAt} }`, `MemorySummaryItem { date; narrative; embedded }`, `SimilarDay { date; excerpt; similarity; finalScore }`, `MemoryLlmUsage { enabled; perDay: LlmUsageDay[]; totals }` with `LlmUsageDay { date; calls; inputTokens; outputTokens; costUsd: number|null }`. These four shapes are **companion-owned** (`api/feature/companion/companion.yml`), not an Insights contract — mirrors the Weekly/Memoir precedent of a real-mode field fed by another feature's backend, except here ALL of a tab's data is companion-served. Mock seeds in `data/insights/memory.ts` (`memoryOverview`, `memorySummaries`, `similarDaysSeed`, `memoryLlmUsage`); wire mapping + the 4 REST calls in `data/insights/memoryApi.ts`; full endpoint + backend detail in [`companion.md`](companion.md) (new Memory-observatory block, near the pattern-monitor block).

**Endpoints / contract:** the **chat is contract-backed since companion V0.2/V0.4, tool-chips real since V0.5, knowledge facts + candidates since V1.1/V1.2, the 4 memory-observatory reads since `mezo-al1i`** — `api/feature/companion/companion.yml` (conversations, messages, sync + SSE stream turn, fact CRUD, candidate inbox + decision, `memory/{overview,summary,similar-days,llm-usage}`; see [`companion.md`](companion.md) §4). The FE `FactCategory` is the backend enum (`train|fuel|health|life`) since V1.2. Patterns still have **no dedicated Insights contract** (served by the companion `pattern` endpoints) — **except the pair-detail read**, which has carried its own contract-backed schema (`PatternPairDetailResponse`) since backend S1 close (`mezo-tk88.3`); see [`companion.md`](companion.md) §4 for the endpoint row + schema, and above for the FE mapping. **Weekly's** deterministic review (D′) owns no endpoint — it composes over existing contracts, and the only new op it required is Train's **`GET /api/train/workouts?from&to`** → `WorkoutSummaryResponse {id, date, status}[]` (inclusive range, date-asc; **completed instances** (`status='completed'`) = "done", the same semantics as `weekDoneDates` since `mezo-cd8s` — was ≥1-non-skipped-set; `from>to` → 400 `TRAIN_INVALID_DATE_RANGE`) — documented in full in [`train.md`](train.md) §4 + `api/feature/train/train.yml`. **Its two backend-served fields** are `weeklySuggestion` (W1) and `growthWeek` (E3). **`weeklySuggestion`** — the proactive **`GET /api/proactive/weekly-suggestion?date=`** → `WeeklySuggestionResponse {weekStart, prose, generatedAt}` (lazy-generated smart-tier prose; **404** when the prior week has no `daily_summary`, which the FE reads as the honest placeholder), owned by the proactive layer ([`proactive.md` §4](proactive.md); `api/feature/proactive/proactive.yml`). **`growthWeek`** — the Progression **`GET /api/progression/growth-week/{date}`** → `GrowthWeekResponse {weekStart, questCompleted, questClosed, lifeXp, activities, savingsHuf}` (aggregates the ISO week; **honest zeros, never 404**), owned by the Progression/growth domain ([`growth.md` §4](growth.md); `api/feature/progression/progression.yml`) — the FE client is `data/insights/growthWeekApi.ts`. Both are single backend reads composed into the otherwise client-side Weekly. Real turns now carry the read-tool calls (15 scope-enumerated hub-tools since mezo-xixu: `get_training_log`, `get_training_plan`, `get_weight_trend`, `get_fuel_log`, `get_recovery`, `get_protocol`, `get_goal`, `get_medication`, plus `get_exercise_records`/`get_recipes`/`get_pantry`/`get_growth`/`get_daily_practice`/`get_insights`/`find_similar_past_days` — [`companion.md`](companion.md) §4 catalog); only the MOCK seed's fancier names (`predictAppetiteCurve()`, `recallSharedMemory(theme=…)`) remain demo theater. **Where the rest of the backend plugs in:** rewrite `useInsights`/`useKnowledge` in `data/insights/insightsHooks.ts` (re-exported by the `hooks.ts` barrel) to dual-mode on `isMockMode()` — the chat swap (`chatHooks.ts`) is the worked example — see §7.

---

## 5. Integrations

Insights is the **hub the other tabs point *toward*** and is itself **fed conceptually by a cross-system "pattern engine."** Today these are **mock-level cross-references** (shared copy / shared data module), not live data flows — but they define the contracts Phase 3 must honor.

### 5.1 `useKnowledge` is shared by THREE views across TWO features — co-design any backend
`useKnowledge()` (`hooks.ts:127`) backs the Insights `KnowledgeListPage` **and** the Me-tab `KnowledgePage` (`frontend/src/features/me/pages/KnowledgePage.tsx:20`) **and** `ProfilePage` (`frontend/src/features/me/pages/ProfilePage.tsx:18`). Responsibility splits:
- **Insights/Knowledge** = flat editable list with prompt-active toggles (consumes `facts`).
- **Me/Knowledge** = the "Knowledge graph" / "Élő mindmap" view (consumes `facts` **and** `edges` + `activeCount`; the graph render itself "deferred to Slice 4", `KnowledgePage.tsx:62`; the placeholder reads "Gráf nézet · hamarosan (Slice 4)", `:74`).
- The Insights footer literally routes across: *"A graph nézethez · Me → Knowledge."* (`KnowledgeListPage.tsx`).

**Crossing type:** `KnowledgeFact[]` + `KnowledgeEdge[]`. Since V1.2 the backend IS live and serves both tabs through the same `useKnowledge()`: Insights/Knowledge consumes the real facts + candidates; Me/Knowledge keeps rendering the seed in mock mode and gets an honest `edges: []` in real mode (the graph/edges layer has no backend yet — a future slice).

### 5.2 Today → Insights (nav entry, no live teaser)
The `InsightsTeaser.tsx` Today-tab card (a real-mode `usePatterns()` teaser, per Today's `useInsightsTeaser` hook) was **removed** by the Napív S3 Today re-composition (`mezo-8141`, 2026-07-13 — spec §4.2: the Insights entry point is the ✨ icon, nothing else). Today's only remaining path into this tab is that plain `<Link to="/insights" aria-label="Insights">` — navigation only, no pattern preview. It originally lived in the now-deleted `BrandRow.tsx`; since the gamified-header slice (`mezo-k7rn`, 2026-07-18) it's one of the `utilities` Today passes into the shared `AppHero` header (see [today.md §2](today.md)) — same ✨ affordance, different carrier component. The orphaned `useInsightsTeaser` hook (+ `InsightsTeaserItem` type and its `data/hooks.ts` re-export) was DELETED in S8 (`mezo-mifi`) — see [today.md §9](today.md).

### 5.3 Me-tab `InsightCard` + `TrendInsight` — a parallel, lighter "insight" type
`frontend/src/features/me/components/InsightCard.tsx` renders a **different** type: `TrendInsight { type: 'milestone'|'pattern'|'warning'; text }` (`types.ts:157-158`). `TrendInsight[]` arrays are embedded in **Goals** (`data/me/goals.ts`, `insights` field on the goal aggregate, `types.ts:186,218`) and **Sleep**. So the *insight concept leaks into Me/Goals/Sleep* via a lighter inline type. The `pattern` icon in `InsightCard` is literally `'insights'`. **Phase-3 reconciliation needed:** rich `Pattern` (Insights tab) vs lightweight `TrendInsight` (embedded) — decide whether to unify or keep two tiers.

### 5.4 The cross-system "pattern engine" — the conceptual feeder (most important seam)
Multiple features narrate an off-screen **"pattern engine"** that Insights surfaces, and **reference the same pattern IDs (`P2`/`P3`) by hand in mock copy**:
- **Train** (`data/train/train.ts`): `volumeRecompute.trigger = 'Heti pattern engine batch'` (`train.ts:57`), framing the MEV/MAV/MRV auto-recompute as driven by the same weekly batch that produces Insights patterns. Volume `source.adjustments` carry `{ kind: 'pattern', label, delta }` entries (pattern-derived volume nudges). The Train tab map even has an `Insights` entry (`label: 'Patterns'`, icon `insights`).
- **Sleep** (`data/me/sleep.ts:25-33`): insight rows cite `"P2 pattern"` (`evidence: '8/10 nap megerősítve · P2 pattern'`) and `"Pattern P3 megerősítve"` — the **same IDs** as `insights.ts` patterns `p2`/`p3` (Mg-stack→quality, caffeine→onset).
- **Fuel/Week** (`data/fuel/fuelWeek.ts:55,151,156`): `"Pattern P2 megerősítve"`, `"Pattern P2 megfigyelve"`, and a reasoning tool `get_pattern_correlation(P2)`.
- **Goals** (`data/me/goals.ts:50`): a warning insight cites `"Pattern P2 alapján …"`.

**Takeaway:** Insights/Patterns is the *read surface* of a **cross-domain inference layer** that today exists only as coordinated mock copy referencing shared `P2`/`P3` identifiers. Phase 3 makes the engine real; the patterns/IDs must then be **stable, shared identifiers** across Train/Sleep/Fuel/Goals/Insights — build the pattern engine as a shared service, not an Insights-local feature.

### 5.5 Chat ↔ everything (the tool/ref graph)
`ChatMessage.refs` point at cross-domain entities by `kind` (`Workout`, `PR`, `Pattern`, `SleepLog`, `CheckIn`); the fabricated tool calls read across Train/Sleep/biometrics. This sketches the **Phase-3 RAG retrieval surface** (the companion pulls from every domain). `RefTag` (`frontend/src/shared/ui/RefTag.tsx`) is the **shared rendering** of these cross-feature references; `ToolChipRow`/`ToolChip` render the tool-transparency row.

### 5.6 Shared design primitives
`Icon`, `Eyebrow`, `PageTitle`, `Toggle`, `RefTag`, `ToolChipRow`/`ToolChip` (UI primitives). **Category palette tokens** `--cat-physiology/-preference/-trigger/-response/-tendency/-goal-state` — **since S8 (`mezo-mifi`) these are `var()` aliases re-pointed 1:1 onto the Napív domain accents** (`prototype.css:42–47`: physiology→sky, preference→lav-deep, trigger→amber-deep, response→sage-deep, tendency→rose, goal-state→coral-deep), so `PatternCard`'s `patternCategoryColor(cat)` now renders in-family Napív hues. There is **no separate `--cat-*` dark block any more** — each alias inherits its Napív accent's own light/dark value (see the §3 token cascade in [_platform-design-system.md](_platform-design-system.md)). Insights is the only place all six are exercised. Since the **Napív vocabulary retirement** (`mezo-x3x0`, 2026-07-16) the inline `--ff-mono` numeric readouts across `ChatMessage`/`ChatPage`/`WeeklyPage`/`KnowledgeListPage` inherit Jakarta with `font-variant-numeric: tabular-nums` instead — mono now survives only on the `.toolchip` debug/tool chips (which is what `RefTag`/`ToolChip` render).

---

## 6. How to use it (consume)

Import the three hooks from the boundary — **never** from `@/data/insights/insights` directly (except the stateless helpers below):

```ts
import { useInsights, useKnowledge, useChat, useWeekly, useMemoir } from '@/data/hooks'

const { patterns, recentlyConfirmed, predictions, experiments } = useInsights()  // memoir/anniversaryNote fields dead since W2
const { facts, edges, activeCount } = useKnowledge()
const { initialChat } = useChat()

// Weekly (D′) — dual-mode; score/delta may be null (render the „tanulom" null-state),
// weeklySuggestion is null in real mode (render the honest placeholder).
const { weekly, deltaLabel, weeklySuggestion } = useWeekly()

// Memoir (W2) — dual-mode; memoir is null in real mode on 404 (render the honest „készül" state),
// anniversaryNote is mock-only (always null in live mode).
const { memoir, anniversaryNote, mode } = useMemoir()
```

Two pure helpers may be imported straight from the data module (stateless constants/utils, not data): `MIN_PATTERN_CONFIDENCE` and `patternCategoryColor` from `@/data/insights/insights`; `factCategoryColor` and `FACT_CATEGORIES` from `@/data/insights/knowledge`.

Today these return **synchronous static data** (safe to read in render with no loading/null guard). **When Phase 3 lands they may become async** — write new consumers defensively now (ghost-guard for null), matching the real-mode convention used by biometrics/Train. To render a full sub-tab, mount the corresponding `pages/*View.tsx` under a child route of `/insights` (see `router.tsx:111-127` + `tabs.ts`).

---

## 7. How to extend it

### 7.1 Add a sub-tab or field while still mock-only (cheap)
1. Add/extend the type in `frontend/src/data/types.ts` (Insights/Knowledge region).
2. Add mock instances in `data/insights/insights.ts` (or `knowledge.ts`/`chat.ts`).
3. Surface via the relevant hook in `hooks.ts` — **keep the returned object's shape stable** so the Phase-3 swap stays mechanical.
4. New sub-tab: add to `INSIGHTS_TABS` (`tabs.ts`) + a child route in `router.tsx:111-127` + a view in `pages/`.
5. Add a Vitest test mirroring the existing per-view + per-data tests (§8).

### 7.2 Make it real (Phase 3 / Slice D) — the recipe
The boundary is **engineered for this swap**: rewrite `useInsights`/`useKnowledge`/`useChat` to dual-mode on `isMockMode()` exactly like `useWeight` (`weightHooks.ts:11`) / `useSleep` (`hooks.ts:79`) — `initialData: mock ? <static> : undefined`, `queryFn: mock ? async()=>static : insightsApi.list`. Follow, in order, the house standards (do **not** duplicate them here):

- **`docs/references/api_contract_conventions.md`** — contract-first: write `api/feature/insights/insights.yml` (+ `knowledge`, `chat`/`conversation`) **before** code, merge via `api/generate`, regenerate FE types (`frontend/src/data/_client/api.gen.ts`) + BE `*Api` interfaces.
- **`docs/references/liquibase_conventions.md`** — create `pattern` / `knowledge_fact` / `knowledge_edge` / `ai_conversation` tables; changeset `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`; UUID PKs; seed in Java `@Profile("demodata")` (never SQL).
- **`docs/references/java_package_structure.md` + `spring_patterns.md`** — `feature/insights/{controller,service,repository,entity,dto,mapper}`; constructor DI; method-level `@Transactional`; UUID PKs; `OwnedEntity` + `CurrentUserId` (single-user ownership), soft delete via `@SQLDelete`/`@SQLRestriction`.
- **`docs/references/error_handling.md`**, **`configuration_conventions.md`** (e.g. a `mezo.feature.ai.enabled` flag; promote `MIN_PATTERN_CONFIDENCE` — currently a hard-coded FE constant — to a `@Validated *Properties` value), **`testing_standards.md` / `integration_test_framework.md`** (new tables → add to `ResetDatabase` TRUNCATE list, add populators, write an ownership-isolation test).
- **Phase-3 AI substrate:** Spring AI + pgvector + RAG (`docs/milestones/roadmap.md:13`). `knowledge_fact.active` is the "in system prompt" toggle; `KnowledgeEdge` is the graph the companion traverses; `ai_conversation` backs Chat. The `confidence`/`critique` scores and human-in-the-loop **Confirm/Monitor/Reject** are the pattern-validation pipeline — **persist these** (currently UI-local).

**Hard constraints (both non-negotiable):**
- **Contract-first + dual-mode + both test modes:** every boundary DTO comes from the OpenAPI contract; the hook must keep working in mock mode; ship both `pnpm test` and `VITE_USE_MOCK=true pnpm test` green.
- **Shared pattern IDs:** patterns must become **stable cross-domain identifiers** (Train volume engine, Sleep factors, Fuel-week, Goals all reference `P2`/`P3` by ID today, §5.4). Build the pattern engine as a **shared service**, not Insights-local.
- **Co-design knowledge for two tabs:** any knowledge backend serves Insights/Knowledge **and** Me/Knowledge simultaneously (§5.1).

---

## 8. Testing

All tests are **frontend Vitest** (no backend tests exist). They assert **verbatim Hungarian copy + mock counts + local interactivity** — i.e. they pin the mock as a contract.

- **Data-layer:** `frontend/src/data/insights/insightsData.test.tsx` (3 patterns all ≥ floor; `p1` critique; weekly score / 4 items; memoir title + 3 anchors; `recentlyConfirmed`×3; 4 predictions w/ validated `actual`; active experiment; `patternCategoryColor('response')`). `frontend/src/data/insights/chatData.test.tsx` (3 msgs assistant→user→assistant; tool/ref shapes). *(Knowledge has no dedicated `data/` test.)*
- **Views:** `pages/{PatternsPage,WeeklyPage,MemoirPage,KnowledgeListPage,ChatPage,PredictionsPage,ExperimentsPage}.test.tsx`, plus `components/PatternDecisionCard.test.tsx` (the decision-inbox card, `mezo-tk88.4`). `WeeklyPage.test.tsx` has real-mode describes for the „tanulom" null-state and, since **W1**, a case asserting the live suggestion prose renders **without** the inert „Elfogad/Hangoljuk" buttons. `MemoirPage.test.tsx` gained a **`(real mode)` describe** (since **W2**): with an MSW memoir fixture it renders the real title/body/anchors and does NOT render reactions/anniversary/archive; on the default 404 it renders the honest „készül" placeholder, not the demo fiction — the `(mock mode)` describe is unchanged.
- **Weekly hook (dual-mode):** `data/insights/weeklyHooks.test.tsx` — real-mode composition/null-state cases + (W1) `weeklySuggestion` served from the GET / kept null on the default 404 (MSW `/api/proactive/weekly-suggestion` defaults to 404) + (E3) `growthWeek` from the MSW default honest-zeros. Card: `components/GrowthWeekCard.test.tsx` (E3 — renders the rows on data, the honest empty line on a zero/null week).
- **Memoir hook (dual-mode, W2):** `data/insights/memoirHooks.test.tsx` (3) — real mode maps the server memoir with a derived `Hét N …` week label (anniversaryNote null, mode live); returns null memoir on the default 404; mock returns the seed + anniversaryNote without fetching (MSW `/api/proactive/memoir` defaults to 404).
- **`ChatPage.test` gotchas** (documented in-file): `userEvent.type` deadlocks under `vi.useFakeTimers()`, so the test uses `fireEvent.change` + `fireEvent.keyDown` and `vi.advanceTimersByTime(1300)` to exercise the 1200 ms canned-reply timer; and since `mezo-at8x.3` the page reads `?c=` so `renderPage()` wraps it in a `MemoryRouter` (which also lets a test open a thread directly: `renderPage('/insights/chat?c=new')`). The `mezo-at8x` cases: markdown renders as blocks with no `**` left in the text, "Új beszélgetés" empties the thread, a draft thread POSTs `/conversation` on the first send, the picker lists the persisted titles, and — since jsdom implements neither — `Element.prototype.scrollIntoView` is stubbed to assert the page parks on the newest message.
- **Chat plumbing (`mezo-at8x`):** `shared/lib/markdown.test.tsx` (11 — inline set, snake_case left alone, no HTML injection, each block kind), `features/insights/logic/useVoiceInput.test.tsx` (3 — record→transcribe→callback, denied mic, unsupported browser; a `FakeMediaRecorder` + stubbed `navigator.mediaDevices` stand in for what jsdom lacks), and the multipart case in `data/insights/chatApi.test.ts` (the request must go out as `multipart/form-data`, not JSON).
- **Nav/shell:** `insights.nav.test.tsx` (real: opens the `Minták` chip's dropdown and reaches `Heti`/`Memoár`/`Előrejelzések`/**`Kísérletek`** via `menuitem` clicks → their null-states; mock: `Memoár` navigation renders the demo) — since the compact-header redesign (`mezo-ugqb`) it drives navigation through the shared `SubNavDropdown` popover rather than the retired `InsightsSubNav`'s pills. The dedicated `InsightsSubNav.test.tsx` (which asserted **both modes render all 7 `.np-pill`s since P2 — nothing hidden**) is gone; the dropdown mechanics themselves are covered generically by `shared/ui/SubNavDropdown.test.tsx`, and `insights.nav.test.tsx` still exercises `visibleInsightsTabs()` end-to-end by reaching every tab via the popover in both modes. Plus app-level `src/app/navigation.test.tsx` clicks the `aria-label="Insights"` sparkle entry link and asserts the `aria-label="Insights alnavigáció"` landmark (§2); `TabBar.test.tsx` asserts the opposite — the bottom `TabBar` renders only the four tab labels (`Ma`/`Edzés`/`Fuel`/`Én`) and explicitly has **no** `Insights` tab; and `features/progression/components/appHeroMount.test.tsx` asserts `.apphero` renders on `/insights` too.
- **No ghost pages remain (since P2):** every page test now has a `(mock mode)` + `(real mode)` describe asserting real data / the honest null-state — no test asserts a `hamarosan` teaser any more. `ExperimentsPage.test.tsx` real-mode: an MSW proposed row renders `◇ Javaslat` + Elfogadom/Elvetem and clicking Elfogadom POSTs the decision; the default empty array shows the still-learning null-state. `experimentsHooks.test.tsx` mirrors the P1 `predictionsHooks.test.tsx` idiom (maps a wire row, `[]` default, mock no-fetch). Mode is set per-describe with `vi.stubEnv('VITE_USE_MOCK', …)`.
- **`MotorPage.test.tsx` is DELETED with the page (`mezo-tk88.4`)** — its scenarios live on now as
  `PatternsPage.test.tsx` cases instead: `(mock mode)` — the hero sentence/tiles/lifecycle-section
  headers render off the seeds, decide-bucket cards show the pair-backed question (falling back to
  the pattern's own title when unmatched), confirming a decide card moves it into „Megerősítve" (an
  end-to-end `usePatternActions().decide()` exercise), „Adat-egészség" expands to the coverage rings
  **thinnest-first** (proving the page's own `metrics.sort`, not an already-sorted fixture — the
  Motor-era assertion, ported), the domain chips multi-select and the „Mind" chip **batch-clears all
  active domains in one click** (a regression test for the `mezo-tk88.4` functional-setState
  correction — `PatternsPage`'s `activeDomains` update must use `setActiveDomains(prev ⇒ …)` or a
  same-batch stale closure drops all but the last toggle), and the `?pair=` param **redirects** to
  `/insights/patterns/:pairKey` (stubbed locally in this test file — the real page now lives at
  §2.1b, `PatternDetailPage.tsx`) instead of highlighting a row in
  place; `(real mode)` — MSW stubs BOTH `/api/companion/pattern` and `/api/companion/pattern/monitor`
  to compose the dashboard from two live reads, raw `r=…` is asserted absent from the decision card,
  a 404 on **both** endpoints renders the degraded card **with no Motor link**, a legitimately empty
  (non-404) pair on both endpoints keeps the honest „Még nincs felismert minta…" copy (link removed
  too), and a non-404 monitor failure still renders the honest retry card the old `MotorPage.test.tsx`
  proved (`isError`/`refetch`, review fix wave `mezo-viqs`, unchanged). **`domains.test.ts`** still
  covers `groupPairsByDomain` pure (the module survives the retirement, §2.8).
- **Pattern-pair detail (§2.1b, `mezo-tk88.5`):** `data/insights/patternDetailHooks.test.tsx` (dual-mode —
  the showcase pair's full snapshot/decision/reinforcement history + days + impact; a gathering
  catalog pair synthesizes to `pattern: null`; an unknown key → `notFound`; real mode maps the wire
  payload reusing `toPattern`, and any 404 → the same honest `notFound`). `logic/patternHistory.test.ts`
  — pure, the append-only `pattern_event` → journal/strength-series/tick-label/first-last-snapshot-n
  derivations (`journalEntries`/`strengthSeries`/`strengthTickLabels`/`firstLastSnapshotN`) + the
  scatter's `fitLine`/`latestAlignedDay`. `pages/PatternDetailPage.test.tsx` — `(mock mode)`: the
  confirmed showcase renders all five blocks in order + the judged header (button label, not a
  status badge) + the strength/scatter captions off the real first/last-snapshot-n and latest-day
  values; the diagnostics section stays collapsed by default (raw `r/n/p` absent) until clicked,
  then shows the freeze note; `Napok listája →` toggles the inline aligned-days `<table>`; a
  gathering (no-row) pair renders the `verdictSentence` gate nudge, both chart empty-state
  fallbacks, and the future-tense impact row with no decision buttons; an unknown key renders the
  honest not-found card. `(real mode)`: an MSW confirmed payload renders the five blocks; a
  weekend×late-meal payload proves the `mezo-fy97` formatting end-to-end (named scatter columns,
  `HH:mm`/`igen`/`nem` table cells, rounded `r/p` in the diagnostics — full-precision doubles never
  reach the DOM); a 404 renders the not-found state. Both header assertions target the `DetailFrame`
  back row (`link name="Vissza"` + `heading "Minta részletei"`). `logic/metricFormat.test.ts` —
  pure: clock folding (incl. the bedtime `+24` shift and the `:60` minute carry), binary mapping,
  decimal trimming, axis-end labels, and the `formatR`/`formatP` precision rules.
  `PatternDecisionCard.test.tsx` is unchanged by the new optional
  `titleSize` prop (default `17`, unused by its existing assertions).

**Commands** (run from `frontend/`):
```bash
pnpm test                         # vitest run (REAL mode default — Insights is static, so identical to mock)
VITE_USE_MOCK=true pnpm test      # mock mode — both must be green
pnpm build                        # tsc -b && vite build
```
When Phase 3 makes the hooks real, add backend ITs (`AbstractIntegrationTest`/`ApiIntegrationTest` + Postgres + populators) and MSW handlers for the real-mode FE path, then keep **both** FE modes green.

---

## 9. Decisions, gotchas & deferred

- **Mock-only, intentionally** — Insights is the Phase-3 brain surface; the FE↔data boundary (`hooks.ts`) is pre-built for a mechanical real-mode swap, matching biometrics/Train.
- **Two roadmap stages, do not conflate:** (a) Phase-2 Insights work is now **D′** (deterministic Weekly + honest surface, `mezo-t16y.1` — the old seed-only Slice D was dropped as superseded on 2026-07-04); (b) Phase-3 = the actual AI (Spring AI/pgvector/RAG) — ✅ shipped (`mezo-fnnq`, see `companion.md`).
- **All interactivity is local/ephemeral:** pattern Confirm/Monitor/Reject, knowledge Toggle, memoir reactions, chat send — none persist. Knowledge Toggle + candidate decisions + pattern decisions are REAL since V1.2/V3.1; **memoir reactions are now hidden entirely in live mode (W2)** rather than shown-but-ephemeral (false affordance). The rest are the **validation/feedback loops to wire to the backend**.
- **Chat is fully faked:** `setTimeout` + keyword branch on `"fáradt"`; `"Gemini 3.1 Pro"`, `"23 facts active"`, `"L4 aktív"`, `"60-day acc 68%"` are **hard-coded strings**, not derived. The named tool calls are illustrative, not real endpoints.
- **Two overlapping "insight" types:** rich `Pattern` (Insights tab) vs lightweight `TrendInsight` (`InsightCard`, embedded in Goals/Sleep, `types.ts:157-158`). And **two category enums** that overlap but differ: `PatternCategory` (`physiology|trigger|response`) vs `FactCategory` (`physiology|preference|trigger|tendency|goal_state`). Phase 3 must decide whether to unify.
- **`MIN_PATTERN_CONFIDENCE = 0.65`** is a hard-coded FE constant — should become backend config (`configuration_conventions.md`) when the engine is real.
- **Weekly's REVIEW is real by CLIENT-SIDE composition, its SUGGESTION by the proactive backend (D′ `mezo-t16y.1` + W1 `mezo-h4wp.3`):** `useWeekly` composes the review (score + items) from existing fuel/train/biometrics reads — cheaper than an Insights backend and honest (real numbers or the „tanulom" null-state, never fabricated). The **score formula is deterministic + documented** (§4); its constants (`SLEEP_TARGET_H`/`KCAL_BAND`/`WEIGHT_RATE_EPSILON`) are FE `const`s to **promote to backend config** — same trajectory as `MIN_PATTERN_CONFIDENCE`. **W1 did NOT promote them** (kept them FE consts to stay in scope; a small follow-up bd issue owns the promotion — the proactive epic files it). **Known simplification:** both weeks use the CURRENT schedules for `trainPlanned` (no historical schedule read, §3). **`weeklySuggestion` is now LIVE in real mode (W1)** — the generated plan prose from `GET /api/proactive/weekly-suggestion` (404→null→the honest placeholder); it is no longer the honest-null-only path. The review composition still adds only one Train op (`listWorkouts`, §4) and no Insights endpoint/table; the suggestion endpoint is proactive-owned ([`proactive.md`](proactive.md)).
- **`useKnowledge` is shared across Insights + Me tabs** (§5.1) — co-design any knowledge backend for both.
- **Cross-domain pattern IDs** (`P2`/`P3`) are referenced as mock copy in Sleep/Fuel/Train/Goals — making them real requires a shared pattern-engine service with stable IDs (§5.4).
- **Inert affordances:** "+ Új kísérlet javasol Mezo", the Weekly "Elfogad/Hangoljuk" pair and the **Memoir reactions + "Memoir archive →" footer + anniversary card** (all still handler-less/unpersisted — but since **W1/W2** they are **hidden in live mode** `mode !== 'mock'`, shown only over the mock seed; false-affordance rule), mic button — all handler-less.
- **Honest surface (mezo-t16y.1 · W2 · P1 · P2 — now COMPLETE):** the Phase-3+ demo tabs were hidden from the sub-nav (`visibleInsightsTabs()` filtering `PHASE3_TAB_IDS`) until each got real data — Memoir at W2, Predictions at P1, **Experiments at P2**. `PHASE3_TAB_IDS` is now **empty**: no tab is hidden, no `PhaseTeaserCard` ghost is reachable, every tab renders real data or an honest null-state. The un-ghost recipe (drop the `PHASE3_TAB_IDS` entry, remove the page guard, render real + honest null-state, keep unpersisted extras mock-only) is preserved in the git history of the four un-ghost commits should a future Phase-gated tab need it.

---

## 10. Key files

**Feature (`frontend/src/features/insights/`):**
- `InsightsSection.tsx` — shell: mounts the shared `AppHero` with a `SubNavDropdown` (`items={visibleInsightsTabs()}`, `accent="var(--lav-deep)"`) as its `utilities` prop, then the outlet (compact-header redesign, `mezo-ugqb` — the old `.pghead-np.lav` head + `InsightsSubNav` are gone)
- **`InsightsSubNav.tsx` is DELETED (`mezo-ugqb`)** — superseded by the shared `@/shared/ui/SubNavDropdown` mounted via `InsightsSection`
- `tabs.ts` — `INSIGHTS_TABS` (id/to/label/end — **`title` field dropped**, `mezo-ugqb`: its only consumer was the retired per-page `h1`; **`memory` entry added `mezo-al1i`; the `motor` entry (added `mezo-viqs`) REMOVED `mezo-tk88.4`**) + `visibleInsightsTabs()` (`PHASE3_TAB_IDS` now **EMPTY** — memoir left at W2, predictions at P1, experiments at P2, memory never gated; all 8 remaining tabs visible in both modes)
- `pages/PatternsPage.tsx` — **rewritten `mezo-tk88.4`**: the lifecycle dashboard (§2.1) — hero + decision inbox + 5 collapsible `LifecycleSection`s + the collapsed „Adat-egészség" coverage panel; owns the `activeDomains`/`dataHealthOpen` `useState`, the `bucketize()` call + per-bucket domain filtering, and the ported `metrics.sort`/referencing/waiting coverage-ring wiring (the retired `MotorPage`'s, verbatim)
- `pages/PatternDetailPage.tsx` — **`mezo-tk88.5`**, the pattern-pair detail leaf page (§2.1b, `/insights/patterns/:pairKey`, sibling route registered before the `insights` group in `router.tsx`): header (`PatternDecisionCard` reuse or the local `GatheringHeaderCard`) → strength chart → scatter + aligned-days table → `PatternJournal` → `PatternImpactCard` → collapsed `LifecycleSection`-reused diagnostics; own `isPending`/`isError`/`notFound` `GhostState` triad, no Insights sub-nav
- `pages/WeeklyPage.tsx · MemoirPage.tsx · KnowledgeListPage.tsx · ChatPage.tsx · PredictionsPage.tsx · ExperimentsPage.tsx` — the other 6 content sub-tabs, **all real dual-mode** (Memoir W2, Predictions P1, Experiments P2 — each with an honest null-state; ExperimentsPage adds the L2 accept/dismiss + propose write actions)
- **`pages/MotorPage.tsx` is DELETED (`mezo-tk88.4`)** — the 8th sub-tab (`mezo-viqs`, redesigned `mezo-18bx`) is retired; its diagnostics folded into `PatternsPage.tsx` above (§2.8 carries the full retirement note + what did/didn't carry over)
- `pages/MemoryPage.tsx` — **`mezo-al1i`**, the 9th sub-tab (now the 8th): read-only memory-pipeline observatory (§2.9), 4 page-local segments (`useStickyTab('insights.memoria.view')`) over `useMemoryOverview`/`useMemorySummaries`, one page-level degraded card (companion 404) + per-panel `GhostState`/degraded lines in Kereső/Audit, shown in both modes
- `components/Memory{LayerCard,LayersPanel,JournalPanel,SearchPanel,AuditPanel}.tsx` — **`mezo-al1i`**: the L0→L3 wash-tinted layer cards + cron-labelled pulsing `FlowConnector`s (Áttekintés), the memoir-styled journal cards with month separators + embed dot + `focusDate` scroll (Napló), the lazy-submit search form (Kereső), and the two-block cost-hero/provenance panel (Audit) — §2.9 has the full per-panel breakdown
- `components/SimilarDayCard.tsx` — **`mezo-al1i`** the Kereső result card: similarity ring + bar + the `egyezés × frissesség = végső` three-chip score row (freshness recovered client-side as `finalScore/similarity`); `onPick(date)` jumps the page to Napló focused on that day
- `components/TokenColumns.tsx` — **`mezo-al1i`** the Audit panel's small stacked SVG bar chart (`--dv-lav` input / `--dv-sage` output tokens per day)
- `data/insights/experimentsApi.ts` + `experimentsHooks.ts` — **P2** the Experiments consumer (`useExperiments()` → `GET /api/proactive/experiment`; `useExperimentActions()` → the decision/propose mutations)
- `data/insights/predictionsApi.ts` + `predictionsHooks.ts` — **P1** the Predictions consumer (`usePredictions()` → `GET /api/proactive/prediction`, list; `[]`→still-learning null-state)
- **`components/PatternCard.tsx` is DELETED (`mezo-tk88.4`)** — superseded by `PatternDecisionCard.tsx` below (the flat-inbox card had no lifecycle awareness; `highlighted`/`?pair=` scroll-and-ring is gone too, replaced by the `?pair=` → detail-route redirect, §2.1)
- `components/MotorStateHero.tsx` — **`mezo-tk88.4`**, the dashboard hero (§2.1 step 1): question count + confirmed/decide prose, the six `BUCKET_ORDER` tiles, the domain-chip filter row (`onToggleDomain`, the „Mind" chip's same-batch multi-toggle) — pure props, `bucketize()`'s counts computed by the caller
- `components/PatternDecisionCard.tsx` — **`mezo-tk88.4`**, the decision-inbox card (§2.1 step 2, the `PatternCard` successor): category/confidence chips, the `findingSentence` finding block (never raw `r/p/n`), the optional „Mi történik a döntéseddel" explainer (first card only), Confirm/Monitor/Reject, a „Részletek és előzmények →" link to the pattern-pair detail route (§2.1b). **`mezo-tk88.5`** added an optional `titleSize` prop (default `17`) — the detail page's header (§2.1b step 1) reuses the whole card at `19` instead of forking a second header component
- `components/LifecycleSection.tsx` — **`mezo-tk88.4`**, `LifecycleSection` (collapsible title+count card, renders nothing at count 0) + `LifecycleMiniRow` (title + one-line sub + `→` link) — the five bucket sections (§2.1 step 3) and „Adat-egészség" (step 4) are built from these. **`mezo-tk88.5`** reuses bare `LifecycleSection` a THIRD way, for the detail page's collapsed „Motor-diagnosztika" (§2.1b step 6, `count={1}` so it never hides — the prop's list-count semantics don't perfectly fit a single block, a deliberate small mismatch)
- `components/PatternStrengthChart.tsx` — **`mezo-tk88.5`** (Task 12), the strength-over-time hand-drawn SVG (§2.1b step 2): |r| per snapshot off `strengthSeries`, dashed „érezhető"/„határozott" guide lines, the confirm point picked out in accent; `null` under 2 points (the page renders the text fallback instead)
- `components/PatternScatter.tsx` — **`mezo-tk88.5`** (Task 12), the aligned-days scatter (§2.1b step 3): metric A × metric B, a least-squares trend line (`fitLine`), the latest day ringed in accent; `null` under 2 days; x-axis end labels metric-aware via `axisEndLabels` (`mezo-fy97`)
- `logic/metricFormat.ts` — **`mezo-fy97`**, human-readable rendering of the engine's raw wire doubles: `formatMetricValue` (hour-kind → `HH:mm`, binary → `igen`/`nem`, else one decimal; key sets mirror the backend `MetricKey` extractors), `axisEndLabels` (scatter x-ends), `formatR`/`formatP` (diagnostics precision) — pure, unit-tested in `metricFormat.test.ts`
- `components/PatternJournal.tsx` — **`mezo-tk88.5`**, the history timeline (§2.1b step 4): a left rail + one tone-colored dot per `journalEntries()` row, entry text through `SafeMarkdown` (bold-only inline renderer), a `→ a Tudástárban` link on a promoted `confirmed` entry
- `components/PatternImpactCard.tsx` — **`mezo-tk88.5`**, „Mit kezd ezzel az app" (§2.1b step 5): the fact/predictions/experiments/challenges rows (only when `pattern.status === 'confirmed'`, each row omitted if its ref list is empty) or the single future-tense fallback row otherwise
- `components/GrowthWeekCard.tsx` — **E3** the Weekly "Growth — heti" card (quests/LIFE XP/activities/savings + honest empty line); growth domain in [`growth.md`](growth.md)
- **`components/MotorHero.tsx · VerdictFilterChips.tsx · DomainSection.tsx · PairRow.tsx` are DELETED (`mezo-tk88.4`)** — the Motor page's `mezo-18bx` presentational units (hero card, verdict-filter chips, collapsible domain sections, expandable pair rows); superseded by `MotorStateHero`/`LifecycleSection` above. **`components/MetricCoverageRing.tsx` survives unchanged** — its `metric`/`referencingTitles`/`waiting` props are still exactly what the „Adat-egészség" panel needs
- `logic/domains.ts` — **mezo-18bx, KEPT `mezo-tk88.4`**: `DOMAIN_META`/`DOMAIN_ORDER` (token-based domain colors, feeds `MotorStateHero`'s chip row) + `comparePairs` + `groupPairsByDomain` (primary domain = metric-B; `comparePairs`/`groupPairsByDomain` no longer have a live page consumer post-retirement but stay pure-tested, `domains.test.ts`)
- `logic/lifecycle.ts` — **`mezo-tk88.4`**, the dashboard's bucketing spine: `LifecycleBucket`/`BUCKET_ORDER` (the six-bucket taxonomy + section order), `isStrongSignal` (the display-layer `|r|≥0.3 && p≤0.15` gate, `STRONG_SIGNAL` in `insights.ts`), `bucketize(patterns, monitor)` — matches `Pattern.pairKey` to `PatternMonitorPair.key`, a user-judged `status` always wins, an unmatched pair always lands in `gathering`; pure, unit-tested in `lifecycle.test.ts`
- `logic/verdicts.ts` — **`mezo-tk88.4`** (lifted off the retired `PairRow.tsx`, unchanged): `bottleneckLabel` + `verdictSentence` (the honest per-verdict sentence, few_days' 🎯 nudge included) — now backs the „Még gyűlik az adat"/„Elvetve" lifecycle rows
- `logic/findings.ts` — **mezo-fj1g**, the human-finding composition: `strengthWord` (|r| bands), `findingSentence` (authored direction reading + „Igen/Meglepő" prefix + `{erősség}` substitution), `confidenceMeta` (honest Hungarian p-translation), `pairLine` — pure, unit-tested in `findings.test.ts`
- `logic/patternHistory.ts` — **`mezo-tk88.5`** (Task 12 + 13), the detail page's pure derivations over `PatternEvent[]`/`AlignedDay[]`: `strengthSeries`/`strengthTickLabels` (the strength chart's per-point |r| + accent-on-confirm tick labels), `journalEntries` (the append-only `pattern_event` log → the Hungarian journal, `promoted` folding into the preceding `confirmed` entry's `factLink`), `fitLine` (the scatter's least-squares trend), `firstLastSnapshotN`/`latestAlignedDay` (the strength/scatter captions' first-last-n and latest-day picks), `chartDateLabel` (the chart axis's undotted date style — the journal's own dotted `huShortDate` stays a private helper) — pure, unit-tested in `patternHistory.test.ts`
- `components/ChatMessage.tsx` — chat bubble + tool/ref rows; the answer body renders via `@/shared/lib/markdown`
- `sheets/ConversationPickerSheet.tsx` — **`mezo-at8x.3`** the conversation list + "Új beszélgetés" row (presentational; ChatPage owns the `?c=` selection)
- `logic/useStickToBottom.ts` — **`mezo-at8x.2`** rAF bottom-anchoring + the stick-while-at-bottom rule for the streamed answer
- `logic/useVoiceInput.ts` — **`mezo-at8x.4`** the record → convert → transcribe state machine (`unsupported | idle | recording | transcribing`)
- **`components/PhaseTeaserCard.tsx` — DELETED in the Napív S8 shell migration (`mezo-mifi`):** with `PHASE3_TAB_IDS` empty no tab is Phase-gated, so the ghost had no reachable consumer; the component is gone and the un-ghost/ghost-guard recipe survives only in git history (§2).
- Tests: `pages/*.test.tsx` (incl. `PatternDetailPage.test.tsx`, `mezo-tk88.5`), `components/PatternDecisionCard.test.tsx`, `logic/{lifecycle,domains,patternHistory}.test.ts`, `insights.nav.test.tsx` (`InsightsSubNav.test.tsx` deleted with the component, `mezo-ugqb`; **`pages/MotorPage.test.tsx` + `components/PatternCard.test.tsx` deleted with their components, `mezo-tk88.4`**)

**Data layer (`frontend/src/data/`):**
- `insights.ts` — patterns (`p1` seeded `status: 'confirmed'` since `mezo-tk88.4` so the dashboard's mock „Megerősítve" bucket isn't empty — the other two stay `proposed`), weekly (seed), memoir, predictions, experiments, **growthWeek (E3 seed)** + `MIN_PATTERN_CONFIDENCE`, `STRONG_SIGNAL` (**`mezo-tk88.4`**, the decision-inbox display gate `|r|≥0.3 && p≤0.15` — `logic/lifecycle.ts`'s `isStrongSignal` reads it), `patternCategoryColor`
- `knowledge.ts` — facts, edges, `FACT_CATEGORIES`, `factCategoryColor`
- `chat.ts` — `initialChat`
- `weeklyHooks.ts` — **`useWeekly` (D′ + W1 + E3)**: dual-mode client-side composition + the pure rollup fns (`deriveWeekMetrics`/`deriveItems`/`deriveScore`/`trendOf`) + score constants (`SLEEP_TARGET_H`/`KCAL_BAND`/`WEIGHT_RATE_EPSILON`); the `weeklySuggestion` real branch fetches the proactive GET (W1), the `growthWeek` real branch the Progression GET (E3)
- `weeklySuggestionApi.ts` — **W1** `weeklySuggestionApi.get(date)` → proactive `GET /api/proactive/weekly-suggestion` (wire → `prose` string, 404→null)
- `growthWeekApi.ts` — **E3** `growthWeekApi.get(date)` → Progression `GET /api/progression/growth-week/{date}` (wire → `WeeklyGrowth`; caller `.catch(()=>null)`)
- `memoirHooks.ts` — **`useMemoir` (W2)**: dual-mode `['memoir']` read (mock seed no-fetch / real `GET /api/proactive/memoir`, 404→null); returns `{ memoir, anniversaryNote, mode }`
- `memoirApi.ts` — **W2** `memoirApi.latest()` → proactive `GET /api/proactive/memoir` (wire → FE `Memoir` via `toMemoir`, `Hét N …` week label derived client-side)
- `monitorApi.ts` + `monitorHooks.ts` — **mezo-viqs**, consumer moved from the retired `MotorPage` to `PatternsPage` at **`mezo-tk88.4`**: `usePatternMonitor()` (`['pattern-monitor']` dual-mode, real → `GET /api/companion/pattern/monitor`, 404→degraded, `isError`/`refetch` for a genuine non-404 failure) — read-only, no writes; the mock seed `patternMonitor` (`insights.ts`) deliberately mixes all 5 verdicts + a spread of metric coverage so every render state is visible in mock/demo mode. **`mezo-tk88.5`** added a THIRD consumer, `PatternDetailPage` (§2.1b) — re-reads `usePatternMonitor()` purely for the diagnostics section's window/lag/`sourceHu` meta
- `patternDetailApi.ts` + `patternDetailHooks.ts` — **`mezo-tk88.5`** (Task 11), the §2.1b detail page's read: `usePatternPairDetail(pairKey)` (`['pattern-pair-detail', pairKey]` dual-mode, real → `GET /api/companion/pattern/pair/{pairKey}` via `patternDetailApi.get`, wire→FE mapping reuses `patternsApi.ts`'s `toPattern`; any 404 → one honest `notFound`, no separate `degraded`) — read-only, decisions still go through `usePatternActions()` (above)
- `memory.ts` — **`mezo-al1i`** mock seeds: `memoryOverview`, `memorySummaries` (6 entries spanning 2 months, so the month separator renders), `similarDaysSeed` (3 deterministic hits), `memoryLlmUsage` (7-day series, `totals` = the exact sum of `perDay`)
- `memoryApi.ts` — **`mezo-al1i`** the 4 REST calls + wire→FE mappers (`toOverview` normalizes optional wire fields to `null`) over `api.gen.ts`'s `MemoryOverviewResponse`/`MemorySummaryListResponse`/`SimilarDaysResponse`/`LlmUsageResponse`
- `memoryHooks.ts` — **`mezo-al1i`** `useMemoryOverview`/`useMemorySummaries`/`useLlmUsage` (`useDualQuery`, `['memory', …]` keys, 404→`degraded`) + `useSimilarDays(query)` (a **raw** `useQuery`, not `useDualQuery` — `enabled` gates on a non-empty trimmed query so the lazy-submit search never fires on mount); re-exported from `hooks.ts`
- `insightsHooks.ts` — `useInsights` (no longer returns `weekly`/`weeklySuggestion` since D′; its `memoir`/`anniversaryNote` fields no longer consumed since W2 — only `predictions`/`experiments` are live)
- `hooks.ts` — barrel: re-exports `useKnowledge`, `useInsights`, `useChat`, **`useWeekly`**, **`useMemoir`**, **`usePatternMonitor`**, **`usePatternPairDetail`** (`mezo-tk88.5`), **`useLlmUsage`/`useMemoryOverview`/`useMemorySummaries`/`useSimilarDays`** (the boundary / Phase-3 swap point). It is a **shared, app-wide barrel** — every domain lands its re-export line here (most recently the ritual/recap hooks, `mezo-ilsj`; before that the account-progression hooks, `mezo-k7rn`), so a change to this file is not by itself evidence of an Insights-relevant change; check which exported names moved.
- `types.ts:599-743` — all Insights/Knowledge/Chat types (`PatternMonitor`/`PatternMonitorPair`/`PatternMetricCoverage` at `types.ts:644-683`; `MemoryOverview`/`MemorySummaryItem`/`SimilarDay`/`MemoryLlmUsage`/`FactSource` added `mezo-al1i`; `PatternEventKind`/`PatternEvent`/`AlignedDay`/`PatternImpactRef`/`PatternImpact`/`PatternPairDetail` at `types.ts:768-795`, added `mezo-tk88.5`)
- Tests: `insightsData.test.tsx`, `chatData.test.tsx`, `memoryHooks.test.tsx` (**`mezo-al1i`**, dual-mode + the lazy-search enabled-gate + the `enabled:false` audit branch), `pages/MemoryPage.test.tsx` (**`mezo-al1i`**, all 4 segments + degraded + the Napló focus-scroll), `patternDetailHooks.test.tsx` (**`mezo-tk88.5`**, dual-mode — see §8 for the full case list)

**Cross-feature seams:**
- `frontend/src/app/router.tsx:111-127` — the `insights` group's sub-tab wiring; `router.tsx:110` — the `insights/patterns/:pairKey` sibling route (§2.1b, `mezo-tk88.5`, registered before the group, the `fuel/recipes/:id` idiom) · `frontend/src/features/today/pages/TodayPage.tsx:221` — the `sparkle`-icon entry link (no bottom `TabBar` entry, §2)
- `frontend/src/features/me/pages/KnowledgePage.tsx` + `ProfilePage.tsx` — share `useKnowledge`
- `frontend/src/features/me/components/InsightCard.tsx` — `TrendInsight` (lightweight insight, used by Goals/Sleep)
- `frontend/src/data/train/train.ts:57` · `sleep.ts:25-33` · `fuelWeek.ts:55,151,156` · `goals.ts:50` — "pattern engine" references (shared `P2`/`P3` IDs)
- `frontend/src/shared/ui/RefTag.tsx · ToolChip.tsx` — chat tool/ref rendering
- `frontend/src/styles/prototype.css:42–47` — `--cat-*` tokens (S8 `mezo-mifi`: `var()` aliases onto Napív accents, no dark block)

**Docs (link, don't duplicate):**
- `docs/superpowers/specs/2026-07-05-insights-weekly-honest-design.md` (D′ — deterministic Weekly v0 + honest surface for Memoir/Predictions/Experiments)
- `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (Slice D §126; Phase-3 out-of-scope §6)
- `docs/milestones/roadmap.md:12-13` (Slice D remaining; Phase-3 AI brain)
- House standards: `docs/references/{api_contract_conventions,liquibase_conventions,java_package_structure,spring_patterns,error_handling,configuration_conventions,testing_standards,integration_test_framework}.md`

**Confirmed absent (Phase-3 gap):** no `api/feature/insights|knowledge|chat`, no `backend/**` Java for any Insights domain, no Liquibase changeset. **Weekly (D′) has a real-mode hook path but no Insights backend** — it composes over other features' contracts (Fuel/Train/biometrics) client-side. **Memoir (W2) has a real-mode hook path over a PROACTIVE-owned backend** (`GET /api/proactive/memoir` — not an Insights endpoint; the `memoir` table + generator live in `feature/proactive`, see [`proactive.md`](proactive.md)).

