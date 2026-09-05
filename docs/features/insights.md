---
title: Insights (the Mezo tab)
type: feature-domain
status: mixed
updated: 2026-09-04
tags: [insights, mezo-tab, frontend, data-layer]
key_files:
  - frontend/src/features/insights/pages/MezoHubPage.tsx
  - frontend/src/features/insights
  - frontend/src/data/insights/insights.ts
  - frontend/src/data/insights/knowledge.ts
  - frontend/src/data/insights/chatHooks.ts
  - frontend/src/data/feedback
  - frontend/src/shared/lib/markdown.tsx
related: [_platform-data-layer, _platform-design-system, today, me, character, companion, proactive]
---

# Insights — the Mezo tab — Feature Documentation

> One-line: the **pattern/companion "AI brain" surface** — where mezo reflects back what it has *learned* about the user (detected patterns, memoir, knowledge base, chat, predictions, experiments). **Status: 🔶 mixed** — **Chat** (companion V0.4), **Patterns** (V3.1), **Knowledge** (V1.2) are ✅ real over the companion backend ([`companion.md`](companion.md)); **Memoir** is ✅ real since **proactive W2 (`mezo-h4wp.4`)** — the tab un-ghosted, rendering the companion's generated weekly memoir (anniversary/archive stay mock-only; the mock-only demo reaction row was RETIRED at Phase 5 W4.1 `mezo-b3pp.15` in favour of real 👍/👎 feedback chips that render in both modes — §2.3, closes `mezo-kr9v`); **Predictions** is ✅ real since **proactive P1 (`mezo-h4wp.7`)** — the tab un-ghosted, rendering pattern-grounded forecasts with deterministic validation („tanulom" on null confidence, honest accuracy header); and **Experiments** is ✅ real since **proactive P2 (`mezo-h4wp.8`)** — the last tab un-ghosted, rendering companion-proposed N=1 experiments with an L2 accept/dismiss write path + deterministic outcomes. **All proactive-epic tabs are now real** (`PHASE3_TAB_IDS` is empty; the proactive epic is complete) — plus the post-epic **Memória** tab (§2.9, `mezo-al1i`, a read-only observatory over the memory pipeline itself), never phase-gated, for **all seven remaining Insights tabs real** today. **Phase-2 exit audit passed (mezo-t16y.4, 2026-07-05):** the sub-nav hiding + per-page `PhaseTeaserCard` guards re-verified; no fabricated Insights number reaches a live user. **Reached as the `Mezo` tab** — the fourth of the five first-class tabs, promoted out of a hidden ✨-icon link in Today's header by Design 2.0 ([ADR 0032](../decisions/0032-five-tab-ia-dissolved-section-shells.md)). **The name changed with the promotion: the section is called `Mezo`, its routes are `/mezo/*`, and `/insights/*` is a redirect** (§2). **The post-epic Motor tab (was §2.8, `mezo-viqs`/`mezo-18bx`) is RETIRED (`mezo-tk88.4`)** — its pattern-gate diagnostics were folded into the Patterns tab's own dashboard (new §2.1: hero + decision inbox + lifecycle sections + a collapsed „Adat-egészség" coverage panel) and the per-pattern **pattern-pair detail page** (§2.1b, `mezo-tk88.5` — `PatternDetailPage.tsx`); `/mezo/motor` now redirects to `/mezo/patterns` (`router.tsx`). **The Weekly tab (was §2.2, `mezo-t16y.1`/D′) is also RETIRED (`mezo-p2tr`)** — the weekly score review, its growth card and the weekly tervjavaslat prose all moved to **`/me/week`** (the `Heti` hub + view-pages, backed by the backend-computed `GET /api/me/week` — [`me.md`](me.md)); `/mezo/weekly` now redirects to `/me/week` (`router.tsx`).

>
> **Mozaik 2.0 (Design 2.0, `mezo-d20`, 2026-08-29) — a rename, a promotion and a new render layer, over an unchanged brain.** The Insights *section* dissolved into the **Mezo tab**: `/mezo` is now the `MezoHubPage` tile mosaic and every former sub-tab is a full-page sibling on a `/mezo/*` route ([ADR 0032](../decisions/0032-five-tab-ia-dissolved-section-shells.md)); the pages were re-faced onto the tile/clay/`--mz-*` vocabulary ([ADR 0033](../decisions/0033-mozaik-2-tile-language.md), superseding ADR 0026). **Not one hook, endpoint, honesty gate or bucketing rule below changed.** `usePatterns`, `usePatternMonitor`, `useKnowledge`, `useChat`, `useMemoir`, `usePredictions`, `useExperiments`, `useMemoryOverview`, `useFeedback` and the whole `logic/{lifecycle,findings,verdicts,factCopy,patternHistory,metricFormat}` layer are byte-for-byte the same reads and derivations this doc has described since `mezo-tk88`. Read §2 for the new faces and the **new seam rule** they carry, and §3–§5 for the model they render.
>
> **Hub-tile-reorg (`mezo-o486`, 2026-09-01) — a wide `Karakter` tile joins the hub.** Spec: [`2026-09-01-hub-tile-reorg-design.md`](../superpowers/specs/2026-09-01-hub-tile-reorg-design.md). The character dossier (`/me/karakter`, [character.md](character.md)) moved its hub entry point from the Én hub to a new full-width `Karakter` tile here, alongside `Diagnózis`. The reorg's guiding principle: **Mezo = everything AI-derived, Én = personal data** — a principle that also emptied the Én hub's `Heti`/`Tudás`/`Értesítés`/`AI-napló` tiles onto the Mezo hub or a new Beállítások page (`/me/beallitasok`, [me.md §2](me.md)). See §2.0 item 6.

---

## 1. Summary

Insights is the user-facing window onto mezo's N=1 self-model: it presents the behavioral patterns the (future) AI has inferred, a weekly score review, a literary "memoir," an editable knowledge base of facts, a chat companion, predictions, and self-experiments. Every surface today renders **hand-authored Hungarian mock copy** that *simulates* what the Phase-3 AI will eventually generate.

**Status per layer:**

| Layer | Status | Notes |
|---|---|---|
| FE mock | ✅ done | the hub + 7 sibling pages, all views + tests present |
| FE real-mode | ✅ all 7 tabs (Chat + Patterns + Knowledge + Memoir + Predictions + Experiments + **Memória**) | **Chat** real since companion V0.4 (`chatHooks.ts` + `chatApi.ts`, SSE — [`companion.md`](companion.md) §5.1); **Patterns** (V3.1) + **Knowledge** (V1.2) real over the companion backend — Patterns' dashboard also reads `GET /api/companion/pattern/monitor` directly since **`mezo-tk88.4`** (the retired Motor tab's diagnostics, §2.1); **Memoir** real since **proactive W2 (`mezo-h4wp.4`)** — `data/insights/memoirHooks.ts` reads `GET /api/proactive/memoir` (404→null→honest „készül" state), anniversary/archive mock-only, the demo reaction row retired at W4.1 for real feedback chips (§2.3); **Predictions** real since **proactive P1 (`mezo-h4wp.7`)** — `data/insights/predictionsHooks.ts` reads `GET /api/proactive/prediction` (list; `[]`→honest still-learning state, „tanulom" on null confidence); **Experiments** real since **proactive P2 (`mezo-h4wp.8`)** — `data/insights/experimentsHooks.ts` reads `GET /api/proactive/experiment` + `useExperimentActions` writes L2 decisions/propose; **Memória** real (both modes) since **`mezo-al1i`** (post-epic) — `data/insights/memoryHooks.ts` reads the 4 `GET /api/companion/memory/*` endpoints off `MemoryObservatoryService`, §2.9. **No mock-only Insights tab remains** — all 7 are real (§2). **Motor (was the 8th tab) is RETIRED (`mezo-tk88.4`)** — `/mezo/motor` redirects to `/mezo/patterns`. **Weekly (was the 2nd tab) is RETIRED (`mezo-p2tr`)** — `/mezo/weekly` redirects to `/me/week` ([`me.md`](me.md)). **All seven surfaces survived the Design 2.0 rename unchanged in data terms** — they are now full pages under `/mezo/*` instead of sub-tabs under `/insights/*` (§2). |
| Backend (Java) | 🔶 companion only | `feature/companion` backs the chat (`ai_conversation`/`ai_message`); no `pattern`/`knowledge_fact` backend yet. |

This is **intentional**. Insights is the Phase-3 "AI brain" surface; the single FE↔data boundary (`frontend/src/data/hooks.ts`) is pre-built so the real-mode swap is mechanical, exactly as already proven for biometrics/Train (the barrel is app-wide shared — unrelated domains' re-export additions, e.g. the `mezo-53su` `useFuelSettings` export, move this key_file without touching Insights' own data path). There are **two distinct roadmap stages** the doc keeps separate:
- **Phase-2 Slice D — "Insights seed-only"**: **DROPPED as superseded (2026-07-04 re-map)** — Phase 3 built the real `pattern`/`knowledge_fact`/`ai_conversation` stack, so seeding was never needed. What remains is **D′** (`mezo-t16y.1`): deterministic Weekly review + honest surface for Memoir/Predictions/Experiments — `docs/superpowers/plans/2026-07-04-phase2-completion-roadmap.md` §D′.
- **Phase 3 — the actual AI**: Spring AI + pgvector + RAG + pattern/companion pipeline (`docs/milestones/roadmap.md:13`).

Driving specs: `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (Slice D §126; Phase-3 out of scope §6) · `docs/milestones/roadmap.md:12-13`.

---

## 2. User-facing behavior

**Route: `/mezo`** — a first-class tab in the bottom `TabBar` (`Nap · Edzés · Fuel · Mezo · Én`, `app/TabBar.tsx`), no longer a ✨ icon hidden in another tab's header. `/mezo` renders **`MezoHubPage`** (§2.0); the former sub-tabs are **full-page siblings** registered flat in `router.tsx`:

| Surface | Route | Tile label (verbatim) | View | Real mode |
|---|---|---|---|---|
| hub | `/mezo` (index) | — | `MezoHubPage` | orb + chat opener + decision card + tiles |
| patterns | `/mezo/patterns` | `Minták` | `PatternsPage` | shown |
| pattern detail | `/mezo/patterns/:pairKey` | — (drill-in) | `PatternDetailPage` | shown |
| weekly | `/me/week` | `Heti` | `WeekHubPage` + view-pages ([me.md](me.md)) | **real** (`mezo-p2tr`) |
| memoir | `/mezo/memoir` | `Memoár` | `MemoirPage` | **real** (W2) |
| knowledge | `/mezo/knowledge` | `Tudástár` | `KnowledgeListPage` | shown |
| chat | `/mezo/chat` | — (the composer opener) | `ChatPage` | shown |
| predictions | `/mezo/predictions` | `Előrejelzések` | `PredictionsPage` | **real** (P1) |
| experiments | `/mezo/experiments` | `Kísérletek` | `ExperimentsPage` | **real** (P2) |
| memory | `/mezo/memoria` | — (the L0→L3 band) | `MemoryPage` | shown (both modes) |

**The rename is a redirect, not a break (`mezo-d20.1.1`).** `router.tsx` mounts `{ path: 'insights/*', element: <LegacyPathRedirect prefix="/insights" to="/mezo" /> }` — a component that rewrites `location.pathname` and re-navigates with `replace`, **preserving the subpath and the query string**. So `/insights` → `/mezo`, `/insights/knowledge` → `/mezo/knowledge`, `/insights/patterns/late_meal__sleep_quality?x=1` → the same under `/mezo`. PWA bookmarks and any in-app `navigate()` not yet migrated keep working; `PatternsPage`'s own row links still emit `/insights/patterns/{key}` and arrive correctly through this hop. The two older intra-section redirects survive underneath, now on `/mezo`: **`/mezo/weekly` → `/me/week`** (the Heti retirement, `mezo-p2tr`) and **`/mezo/motor` → `/mezo/patterns`** (the Motor retirement, `mezo-tk88.4`).

> ### ⚠️ The header seam rule INVERTED — read this before touching any page below
>
> **Old rule (dead):** `InsightsSection` rendered the shared `AppHero` + a `SubNavDropdown` above an `<Outlet>`, and it owned the location display — so **no leaf view was allowed its own `h1`/page header**; the active tab's dropdown chip ("`Minták ▾`") said where you were, and a page-local header would have doubled it. `PatternDetailPage`, a sibling *outside* that outlet, was the documented exception that had to bring its own padding and back row.
>
> **New rule:** `InsightsSection.tsx`, `pages/tabs.ts` (`INSIGHTS_TABS`, `visibleInsightsTabs()`, `PHASE3_TAB_IDS`), the shared `AppHero` and `SubNavDropdown` are **all deleted** (`mezo-d20.5.1`, cleaned up in `mezo-d20.9.1`). There is no outlet, no shared padding and no shared header. **Every page under `/mezo/*` is a full page that owns its own head, padding and way back** — what `PatternDetailPage` used to be alone in doing is now what all of them do. A new page here that renders bare content will float headerless at the top of the viewport; that is the failure mode this box exists to prevent.
>
> **How the pages actually satisfy it today is uneven, and that unevenness is real:** `MemoirPage` and `KnowledgeListPage` mount the shared **`PageHero`** (`@/shared/ui/mozaik`); `PatternsPage` renders its own `.mz-page-hero` block with the same anatomy; `PatternDetailPage` keeps its `DetailFrame` back row (`‹` → **`/mezo`**, repointed from `/insights`) + `h1`; `ChatPage`, `PredictionsPage`, `ExperimentsPage` and `MemoryPage` render straight into their content. **No page under `/mezo/*` mounts `PageHead`, so none has the `‹ vissza` chip the Nap/Én/Fuel siblings carry** — the tab bar and browser back are the only way up. Recorded as a gap in §9.

**`PHASE3_TAB_IDS` and the phase-gating machinery are gone with `tabs.ts`** — and they were already empty. The honest-surface epic (`mezo-t16y.1` · W2 · P1 · P2) had ended with every tab real, `visibleInsightsTabs()` returning all of them in both modes, and `PhaseTeaserCard` deleted for want of a reachable consumer. Design 2.0 removed the mechanism that had nothing left to hide; the un-ghost recipe survives only in git history (§9).

### 2.0 The Mezo hub (`pages/MezoHubPage.tsx`) — the `/mezo` index (`mezo-d20.5.1`)
Source of truth: `docs/design_2.0/prototypes/src/mezo-body.html` hub section (prototype px ×1.18). The hub is deliberately **the companion's face first and a directory second** — it leads with the orb and the chat, not with the tiles. Top to bottom:

1. **Header — the shell's, not the hub's.** Since `mezo-atry` this page renders no header of its own: the app shell's single `AppHeader` (`frontend/src/app/AppHeader.tsx`, mounted by `AppLayout` above every tab-root and sub-page, [today.md](today.md#the-header-is-the-shells-not-the-hubs)) sits above it — section label + clay spot · daypart switch (always jumps to `/nap`) · Mezo-messages circle → `/nap/uzenetek` · notification bell (unread badge, three-row „Értesítések · ma" popover, `useNotificationFeed`) · profile orb → `/me`. Before `mezo-atry` this hub, like the other four, carried its own copy of the recipe; that per-hub duplication is gone.
2. **Breathing orb hero — and deliberately NO number.** A `ClaySpot name="s-orb"`, the name „Mezo", **one** companion sentence, and a quiet status line. The sentence is the `MezoChip` precedent applied verbatim: the first paragraph of the latest `buildMezoMessages()` entry, preferring a row with a real `artifactId`; **the labelled demo briefing is used only in mock mode** (`chatMode === 'mock'`), so a live user never sees demo prose presented as the companion's live voice. The status line reads `a társ most nem elérhető` / `demo beszélgetés` / `Gemini · élő` off `useConversations()`, plus „együtt **N napja**" when `useMemoryOverview()`'s `l0.daysWithAnyData > 0` — omitted entirely when it is not.
3. **Composer-shaped chat opener** — a button styled as the chat composer („Mondj valamit…" + mic + send glyph) navigating to `/mezo/chat`. It is an opener, not a composer: it captures nothing, so it cannot lose a typed message on navigation.
4. **The motor's ONE decision card** — the top entry of `bucketize()`'s `decide` bucket, in a gold ring: the `🔔 Döntésre vár · N` eyebrow, the `confidenceMeta` chip, the pair's `questionHu` (falling back to the pattern's own title), the pair line + `N közös nap`, the `📈 Amit eddig látunk` finding block (`findingSentence`, falling back to `verdictSentence` or the pattern's `mechanism`), and **Megerősítem / Figyeljük / Elvetem** over the **same `usePatternActions().decide` mutation `PatternsPage` uses**. Deciding flips the card in place to a sage acknowledgement (`✓ Beépítettem a tudásba…` / `👁 Rendben, figyeljük tovább…` / `✕ Elvetve — nem hozom fel újra.`). It renders only once both pattern reads have resolved — no card is shown over an unresolved window, and the full inbox stays on `/mezo/patterns`.
5. **The 6-tile mosaic** — `Minták` · `Heti` · `Memoár` · `Tudástár` · `Előrejelzések` · `Kísérletek`, each with a bottom line from that page's own hook: `{confirmed} él a tudásban · {N} döntés`, `{score} pont · {±Δ} ↗`, `{hét} · új fejezet`, `{N} tény · {M} a chatben`, `{N} aktív · {P}% bevált`, `{N} aktív · {d}/{total} nap`. **A line is absent while its source is pending/degraded/empty**; where a page has its own honest word for "not yet", the tile borrows it rather than inventing one — `Heti`, `Előrejelzések` and `Kísérletek` read **„tanulom"**, exactly as those pages do. Note that **`Heti` navigates out of the tab**, to `/me/week`: the weekly review lives in Me and is *linked* from here, not duplicated ([me.md](me.md)).
6. **`Karakter` — a wide tile, full-width like `Diagnózis` (hub-tile-reorg, `mezo-o486`, 2026-09-01)**, moved here from the Én hub. **In markup it is the last child of the same `<Mosaic>` as the 6 small tiles above** (right after `Diagnózis`, still inside the mosaic, before it closes) — it only *reads* as its own numbered item here because it is visually wide, not because it sits outside the mosaic; the memory band below is a true sibling, outside the `<Mosaic>` entirely. Bottom line = the **average CORE-band maturity**, gated by the shared `isDossierEmpty` predicate (absent when the dossier has nothing yet — the same honest-line contract every other tile carries). Tapping it opens the existing `/me/karakter` (`KarakterHubPage`) — the route did not move, only the tile did; this is a second precedent for a cross-hub tile alongside `Heti`. The `useCharacterOverview()` call + the line-deriving logic moved with it, from `EnHubPage.tsx` into `MezoHubPage.tsx`. Rationale: the guiding principle behind the reorg is **Mezo = everything AI-derived, Én = personal data** — the character dossier is companion-derived, so it belongs here now ([me.md](me.md) §2, ADR 0032's 2026-09-01 amendment; [character.md](character.md)).
7. **The L0→L3 memory band** — a full-width row off `useMemoryOverview()`, **the first element after the `<Mosaic>` closes** (so it follows `Karakter` in DOM order even though its own stagger delay fires first — see below): `{daysWithAnyData} nyers nap › {summaryCount} napló › {Σ l2} ítélet › {Σ l3} tény`, tapping into `/mezo/memoria`. **With no overview** (cold load, companion switched off) it renders as a plain labelled door — „Memória-rétegek" — with **no fabricated layer counts**.

The whole panel rides an `EntranceGroup` (orb 0 ms → chat opener 70 ms → decision card 110 ms → the 6 small tiles 160–360 ms → memory band 400 ms → `Karakter` 440 ms), one-shot, reduced-motion-guarded. **DOM order and stagger order disagree on purpose, not by accident:** `Karakter` sits earlier in the markup than the memory band (item 6 before item 7 above, both inside/after the same `<Mosaic>`), but its `delayMs={440}` was appended after the band's pre-existing `--d: 400ms`, so on screen the band's entrance completes 40 ms before `Karakter`'s does — a cosmetic ordering only, with no honesty-contract or navigation implication.

### 2.1 Minták (`pages/PatternsPage.tsx`) — **the lifecycle dashboard, `mezo-tk88.4`; Mozaik re-face `mezo-d20.5.3`**
The hub's first tile, at **`/mezo/patterns`** (it used to be the `/insights` index; the hub took that slot). Not a flat inbox list but a full **pattern-lifecycle dashboard**: the old
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
1. **Page hero + motor-state card** — since `mezo-d20.5.3` these are **page-local markup**, not
   `MotorStateHero`: a `.mz-page-hero` (clay `i-minta` + the count-up confirmed big number +
   „megerősített összefüggés él a tudásban") over „A motor állapota", a prose card carrying three
   bold numbers and the colorful **3×2 lifecycle grid** (`BUCKET_ORDER` order; „döntésre vár" is
   white with a gold ring and pulses — reduced-motion-guarded). Its content is unchanged: the
   „N kérdést figyelek" prose, the six bucket counts, and the „ma HH:mm · N nap" stamp
   (`monitor.lastRunAt`/`lookbackDays` — **`lastRunAt` is NOT "the job last ran"**, it is
   `max(lastDetectedAt)` over the user's own statistical pattern rows, so it reads "—" for a user
   whose inbox is empty even though the nightly job ran and gated everything out; carried from the
   retired Motor tab, `mezo-viqs`). The six cells are semantic **buttons** (`aria-pressed`): only
   the selected lifecycle bucket is rendered below, so the page is a compact catalogue rather than
   six full lists stacked vertically. Initial selection is `decide` when non-empty, otherwise the
   first non-empty `BUCKET_ORDER` bucket. Counts always describe the complete motor state and do not
   change when the catalogue is filtered. A visible **Szűrés** button opens the house `Sheet` with
   one optional outcome-domain filter (`DOMAIN_META`/`DOMAIN_ORDER`) and progress/domain sorting.
   Domain choices and status cells use `ClayIcon`/`Icon`, never emoji. Pairless persisted patterns
   belong to the honest `other` domain.
   **`components/MotorStateHero.tsx` still exists but has no importer** — §9.
2. **Selected lifecycle catalogue** — `decide` renders one
   `PatternDecisionCard` (`components/PatternDecisionCard.tsx`) per `decide`-bucket entry: category
   chip + a `confidenceMeta` chip (`megbízható jel`/`ígéretes jel`/`még bizonytalan`, only when the
   pair carries `n`/`p`), the display title (pair's `questionHu` when a pair is matched, else the
   pattern's own `title`), the `📈 Amit eddig látunk` finding block (`findingSentence` — the same
   human-composition Motor used, **raw `r`/`p`/`n` NEVER rendered here**), an explainer block
   („Mi történik a döntéseddel" — **only on the FIRST card**, `showExplainer`), the
   Confirm/Monitor/Reject three-button row, and a „Részletek és előzmények →" link (§2.1b,
   `/mezo/patterns/{pairKey}`). The other five buckets render the existing unboxed `Lsec` header
   over their tile mosaic. Each state keeps its own tile language — confirmed =
   sage tiles with a domain clay icon and a **human-word confidence chip** (never raw `r`/`p`),
   watching = lavender tiles with an animated evidence bar, gathering = dashed amber tiles — and a
   selected empty result renders an explicit empty card: `Megerősítve — él a tudásban` (footnote
   „Ez a N összefüggés benne van a társ fejében…"), `Megfigyelés alatt`, `Még gyűlik az adat`
   (row sub = `verdictSentence` — the
   same honest per-verdict sentence Motor's `PairRow` used, including the few_days 🎯 nudge),
   `Megnéztük — nincs összefüggés` (footnote „Ez is eredmény…"), `Elvetve`. `patternCatalog.ts`
   applies filter/sort and **five-item pagination**; status or filter changes reset to page one.
   Every `PatternTile` links to the detail route, including a persisted pattern with no matching
   monitor pair; monitoring/noRelationship rows use a `findingSentence` one-liner when available.
3. **„Adat-egészség"** — a coverage-ring **tile strip** (was a collapsed card), still the same
   data Motor's coverage table showed: metrics sorted thinnest-covered-first, each ring's `waiting`
   flag true when NONE of its referencing pairs is `live`, the „utoljára látva" copy still from
   `MetricCoverageRing`'s exported **`lastSeenLabel`** — which is now the only thing `PatternsPage`
   imports from that component file (the ring markup itself is drawn page-locally). The sort and the
   `waiting` derivation are ported verbatim off the retired `MotorPage`'s wiring (§2.8 below).

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

### 2.1b Pattern detail (`pages/PatternDetailPage.tsx`) — **pair-backed + persisted-artifact fallback**
The per-pattern drill-down is a full leaf
route, **`/mezo/patterns/:pairKey`** (`router.tsx`, registered above the rest of the `/mezo` routes,
same idiom as `fuel/recipes/:id`). It was the first `/insights` page with no section chrome; since
`mezo-d20.5.1` every page in the tab is like it. Since **`mezo-fy97`** every
branch (loaded, pending, error, not-found) renders inside a local `DetailFrame`: page padding
(`14px 16px 24px` — the sibling route sits outside `InsightsSection`'s padded outlet, so the page
brings its own) + the house full-page header row (back chip `‹ Minták` to **`/mezo/patterns`**,
`aria-label="Vissza"` + `h1` „Minta részletei" — the `AiUsagePage` idiom; the mockup's bare
`← Minták` text link rendered glued edge-to-edge in the real shell, user QA). Reached from the dashboard's „Részletek és előzmények →" (decision cards, §2.1 step 2) and
every `LifecycleMiniRow`'s `→` link (§2.1 step 3), plus the legacy `?pair=` query param redirect
(§2.1).

**Data:** `usePatternPairDetail(pairKey)` (`data/insights/patternDetailHooks.ts`,
`['pattern-pair-detail', pairKey]` dual-read → `{detail, notFound, degraded, mode, isPending,
isError, refetch}`; real mode maps `GET /api/companion/pattern/pair/{pairKey}` via
`patternDetailApi.ts` — reuses `patternsApi.ts`'s `toPattern`; **any 404 is one honest `notFound`
state**, unknown `pairKey` and the companion switch off are deliberately indistinguishable, same
discipline as the monitor's `degraded`) + `usePatterns()` to resolve persisted rows that have no
catalogued monitor pair + `usePatternMonitor()` (§2.1, re-read here purely for the
diagnostics section's window/lag/`sourceHu` meta — "cached" in practice since the dashboard already
warmed the query on the way in). **States:** `isPending` → `GhostState`; a genuine fetch failure
(`isError`) → `GhostState` + retry (`refetch`); successful pair detail → the rich story flow below;
pair 404 + a persisted pattern with the same `pairKey` → `PatternArtifactDetail`; only a key absent
from both reads becomes the honest „Nincs ilyen minta." card. The fallback reuses
`PatternDecisionCard` while proposed; judged rows receive a read-only status hero plus only their
saved mechanism/evidence and an explicit explanation that no chart is available. It never invents
paired days, history or statistics.

**Top to bottom (`mezo-0469`; normative visual spec:
`docs/superpowers/specs/2026-09-04-pattern-detail-redesign-design.md`):**

1. **Story hero (`PatternDetailHero`)** — hypothesis and finding are separate deterministic
   sentences (no LLM). „Azt vizsgáljuk…” says the question; the large answer says what is currently
   knowable. State mapping: `imbalanced_groups`/other non-live → „Még gyűlik”; live weak → „Még
   bizonytalan”; live strong + proposed → „Döntésre vár” and three decision buttons; monitoring →
   „Figyeljük”; confirmed/rejected → read-only judged summary. A stale proposed row therefore has
   no CTA when today's pair is not LIVE. The 8+1 weekend case says „Még nincs elég hétvégi adat.”,
   names the imbalance, and shows `groupOneDays / requiredPerGroup` progress without an effect claim.
2. **„Az összevetés alapja”** — binary A metrics get two Design 2.0 wash cards derived from the
   actual `days`: count, middle value (median only from 3 observations), range, and `+N nap kell`
   on the thin group. The fixture reads 8 days / 19:38 versus 1 day / 14:35 without turning that
   one point into a weekend habit.
3. **Historical strength, only when valid** — `PatternStrengthChart` remains for live/frozen pairs
   with at least two snapshots, retitled „Hogyan változott a kapcsolat?”. Collecting pairs show no
   strength chart; its caption still comes from the first/last snapshot `n`.
4. **„Az eddigi napok” (`PatternEvidenceChart`)** — `metricAValueKind`, never a metric-key
   allowlist, chooses the renderer. `binary` draws two softly coloured columns, jittered daily
   points, real clock/number ticks, conditional median bars and a gold latest-point ring, with no
   regression line. `number`/`clock_hour` uses an observed-range scatter and draws its dashed fit
   only when `verdict === 'live'`. `Napok listája →` is a semantic `<details>` table over the same
   data. Under 2 days the chart returns `null` and the page states that more data is needed.
5. **„Mit vigyél magaddal?”** — coral/sage story tiles explain what the evidence does and does not
   mean and name the next data step. Copy comes from verdict + group summary, never generation.
6. **Progressively disclosed background** — „A minta története” keeps only significant events:
   first computable snapshot, decisions, fact promotion and reinforcement. Strength-band chatter
   is gone; `imbalanced_groups` appends a „Most — Még gyűlik: X/Y” row. `PatternImpactCard` renders
   only for a persisted pattern or actual impact. „Hogyan számoltuk?” first exposes window, paired
   days, group ratio, last calculation and sources; raw `r/n/p` sit in a nested „Technikai számok”
   disclosure. Non-live current pairs never present stale stats as today's result; frozen rows show
   the decision-time numbers and freeze note.

### 2.2 Weekly — **RETIRED** (`mezo-t16y.1`/D′ → retired `mezo-p2tr`)
`pages/WeeklyPage.tsx`, `data/insights/weeklyHooks.ts`'s `useWeekly()`, `components/GrowthWeekCard.tsx` and `data/insights/growthWeekApi.ts` are **all deleted**. The score hero, the bordered `weekly.items` list (label · value · trend arrow), the "Mezo · heti tervjavaslat" card (including its `FeedbackChips` row, W4.1 `mezo-b3pp.15`) and the growth-week card all moved **verbatim** to **`/me/week`** — score composition is **no longer client-composed** but reads the backend-computed `GET /api/me/week/{start}` (owned by the `me` feature, not Insights) instead of `useWeekly`'s client-side fan-out over Fuel/Train/biometrics reads (§3's old "Exception" pipeline is gone with it). That destination was itself later split by `mezo-d20.6.10` into a `Heti` hub + sibling view-pages — see [`me.md`](me.md) §2 for the current shape and which page reads which hook. The weekly tervjavaslat prose keeps its **same** proactive-owned source (`GET /api/proactive/weekly-suggestion`, [`proactive.md`](proactive.md)), read directly by the hub rather than through the retired `useWeekly`. **`/mezo/weekly` is an honest `<Navigate to="/me/week" replace />`** (`router.tsx`), and `/insights/weekly` reaches it through `LegacyPathRedirect` first. The review is now the **`Heti` tile on the Mezo hub** (§2.0) *and* on the Én hub — one page, two doors, no duplicated content.

### 2.3 Memoár (`pages/MemoirPage.tsx`) — **REAL dual-mode since proactive W2 (`mezo-h4wp.4`); Mozaik re-face `mezo-d20.5.5`**
At `/mezo/memoir`, the hub's third tile. The page now opens with a shared **`PageHero`** (clay `i-memoar` + „a közös történetünk, hétről hétre") over the Fraunces-titled chapter card with its lavender glow, the „Horgonyok" anchor chips and the feedback chips; the dead „Memoir archive · 17 darab" row was **retired** in the re-face (audit §3: decorative, and promoting it would have been promoting an affordance that goes nowhere). `useMemoir` + `useFeedback` are consumed verbatim and the honest W2 null-state is untouched. The companion's literary weekly narrative. Reads `useMemoir()` (`data/insights/memoirHooks.ts`, exported via the `hooks.ts` barrel) → `{ memoir: Memoir | null; anniversaryNote: string | null; mode }`. The `PhaseTeaserCard` guard is **gone** — the page now renders on real data.
- **The memoir card** (both modes when a memoir exists): `memoir-card` with radial glow, bookmark eyebrow + `Heti memoár · {memoir.week}`, display title, long `body` prose, and an **Anchors** row rendering `RefTag` per `memoir.anchors` (`[kind] label`). Real mode's `memoir.week` is a **client-derived label** `Hét N · …` (from the server `weekStart` via `isoWeekNumber`/`deriveWeekTitle`); the anchors are the code-collected, model-selected `Memory`/`Pattern` refs off `GET /api/proactive/memoir` (owned by the proactive layer — [`proactive.md` §2/§5.6](proactive.md)).
- **Honest null-state (real mode):** on the **404** (no narrative memory in the last completed week) or while loading, `memoir` is **null** → the page renders an honest placeholder card (eyebrow `Heti memoár` + *"Az első memoár a hét zárásakor készül el."*), never demo fiction. Mock always has the seed, so a null memoir only ever occurs in live mode.
- **Feedback chips (W4.1, `mezo-b3pp.15`) — this RETIRED the mock reaction row and closes `mezo-kr9v`.** The four Phase-1 reaction toggles (👍 Like / Love / Save / Dismiss, a local `Record<ReactionKey, boolean>` that wrote nowhere and, being wrapped in `mode === 'mock'`, never rendered in live mode at all) are **gone for good**, replaced by a real `FeedbackChips` row under the memoir card — **in both modes**, because the memoir is an AI artifact wherever it comes from. That mock-only/live-nothing asymmetry WAS the `mezo-kr9v` bug: a demo affordance standing in for a promise the live app never kept. `MemoirPage` calls `useFeedback('memoir', memoir.id ? [memoir.id] : [])` and passes `get`/`vote` down; no memoir (the honest 404 placeholder) ⇒ no artifact ⇒ no chips. The memoir's `id` is new on the wire this slice ([`proactive.md` §4](proactive.md)); the mock seed carries a stable demo uuid so the chips are votable in mock mode too.
- **Mock-only demo extras:** the "Évforduló · 1 hónap" card (`anniversaryNote`) still wraps in `mode === 'mock' ? (…) : null` — **hidden in live mode**. The anniversary stays deferred ([`proactive.md` §9 decision o](proactive.md)) — **but the archive half of that decision shipped in F7.5 (`mezo-d20.8.5.1`)**: the page now ends with a real **„Archívum — a korábbi fejezetek"** CTA card (both modes) navigating to `/mezo/memoir/archivum` (§2.3b) — the footer retired at `mezo-d20.5.5` as a dead affordance, un-retired now that a real shelf lives behind it.

### 2.3b Memoár-archívum + fejezet-oldal (`pages/MemoirArchivePage.tsx` + `pages/MemoirChapterPage.tsx`) — **F7.5 (`mezo-d20.8.5.1`)**
Two new lav Mozaik pages over one shared read, **`useMemoirArchive()`** (`memoirHooks.ts`, `useDualQuery` over `GET /api/proactive/memoir/archive` → `MemoirEntry[]` = `Memoir & { weekStart }`, newest week first; the switch-off 404 resolves to the honest empty shelf; mock seed `memoirArchive` in `insights.ts` — 6 chapters over 3 months whose newest entry IS the week-20 `memoir` seed, paragraph-broken).
- **`/mezo/memoir/archivum`** — the Day One–pattern timeline: `PageHead` (`‹ Memoár`), hero (clay `i-memoar` + chapter count + „fejezet · N hónap közös történet"), then `groupByMonth` (`logic/memoirArchive.ts` — hu-HU month heads, year appended only when the shelf spans years) over full-card chapter buttons (`.mz-march-card`: week chip + `deriveWeekTitle` range + anchor count + Fraunces title + 2-line first-paragraph excerpt). **The whole card is one tap target** (Apple Journal's ambiguous-zone lesson) and it **navigates** to the chapter page — no modal (Daniel's call on the prototype). Empty shelf → honest „Még nincs fejezet…" card.
- **`/mezo/memoir/:weekStart`** — one chapter in the `mezo-uajy` language: `PageHead` (`‹ Archívum`), hero (`Hét N` + date range), the `.mz-memoir` card with the **drop-cap paragraph rhythm** (`.mz-march-bd` — body split on `\n\n`, prompt v2's paragraph contract; a legacy single-block body renders as one paragraph), the **„Miből íródott"** `RefTag` anchor row (static — anchor target-refs remain `mezo-uajy`'s deferred backend flag), `FeedbackChips` (`useFeedback('memoir', [id])` — every chapter is votable, same artifact kind as the latest read), and the **előző/következő pager** walking the shelf order (ends render a ghost tile). Unknown `weekStart` → honest „Ez a fejezet nincs meg az archívumban." (loading shows „A fejezet töltődik…"). Routes registered above the `:weekStart` param so `archivum` never shadows.

### 2.4 Tudástár (`pages/KnowledgeListPage.tsx`) — **real dual-mode since companion V1.2, érthetőség-redesign `mezo-9ryh` + review fix wave; Mozaik re-face `mezo-d20.5.5`; egyesített Tudástár+Tudásgráf `mezo-ms9a`, 2026-09-01**
At `/mezo/knowledge`, the hub's fourth tile. **`mezo-ms9a` egyesítette az addig két oldalon (Tudástár + az Én-tab Tudásgráfja, `/me/knowledge`) élő felületet EGY oldallá** — a Tudásgráf oldal (`KnowledgePage.tsx`) törölve, a kind-lánca (`KindTileGrid`/`KindNodeList`/`NodeDetailSheet`/`CategoryHeader`) és a profil-kártya (`ProfileNodeCard`) az `insights` feature-be költözött, `/me/knowledge` pedig bare redirect a `/mezo/knowledge`-re (`MeKnowledgeRedirect`, `router.tsx` — egy `?kind=` paramétert `?view=kategoriak&kind=`-re fordít). A döntést a design doksi ([`2026-09-01-tudastar-egyben-design.md`](../superpowers/specs/2026-09-01-tudastar-egyben-design.md)) rögzíti; a rövid összefoglaló: a `mezo-0ap9` szerep-tisztázás (fact-lista = Tudástár, gráf = Tudásgráf) a duplikációt megszüntette, de a két-oldal FORMA maradt a súrlódás forrása (láthatatlan határ, a Tudásgráfnak nincs önálló léte a hub-tile-reorg óta, az elfogadás eredménye a másik oldalon landolt) — `mezo-ms9a` ezt oldotta fel egyetlen oldallá, a `mezo-o486` „pages don't move, only tiles do" szabályát tudatosan felülírva. **A `mezo-0ap9` mag-elve túlélte az összevonást: tény-lista pontosan egy van** — a `?view=kategoriak` (volt Tudásgráf) nézet SOHA nem listáz tényeket, csak node-okat/éleket; a fact-owner a `?view=tenyek` nézet marad, a kategória-nézetek innen csak linkelnek.

Minden alábbi viselkedési szerződés (a fact-rész) változatlan a `mezo-9ryh` redesign óta. A companion fact-memóriájának L2 confirm felülete ([`companion.md`](companion.md) §4). Betöltési sorrend, mielőtt bármi más renderelne: `isPending` → `GhostState` („A tudástár betöltése…", `useKnowledge()`-ből forwardolt real-mode-only cold-load guard, a `PatternsPage.tsx` mintáját követve — mock mode `isPending`-je mindig `false`); `isError` (genuinely failed fetch, pl. 500) → `GhostState` retry CTA-val (`refetch`), hogy egy valós hiba sose olvasson az őszinte-de-hazug „0 megy a chatbe" `realEmpty` állapotként; majd a meglévő `degraded` (companion switch-off 404) ág. **A `degraded` EGYEDÜL a tény-felületet fedi le** — a gráf-hookok (`useLifeEventCandidates`/`useKnowledgeGraphNodes`/`useGraphEdgeCount`) 404-szemantikája FÜGGETLEN a társ-kapcsolótól, a két 404-jelentés nem egyesíthető: az alapnézeten a degraded kártya csak a candidate-inbox blokkot és a Tények csempét helyettesíti (a LIFE_EVENT/SEASON csoportok és a Kategóriák/Így beszélj velem csempék a saját, gráf-hook adatukkal rendereinek tovább), a `?view=tenyek` nézeten pedig egyedül ő látszik; egy üres gráf-lista ilyenkor becsületes üres-állapot a Kategóriák csempén, nem hiba.

**A `TudasFrame` közös oldalkeret** (`KnowledgeListPage.tsx`) minden nézetet `MozaikPage`+`PageHead`+`PageHero`+`PageBody`-ba csomagol, nézetenként váltó tone-nal/hero-névvel/vissza-chippel (`VIEW_TONE`/`VIEW_HERO_NAME`); a betöltés/hiba ágak a `view` felbontása ELŐTT térnek vissza, ezért mindig base tone-nal, „‹ Mezo" chippel renderelnek. A nézet-térkép, `?view=` szerint (`useSearchParams`-derivált, lokális nézet-state nélkül — a `KnowledgePage` mai idiómája, minden vissza-chip `replace:true`-val törli a paramot, a `mezo-ni86` egy-vissza-affordancia elv):

- **Alapnézet** (`?view=` hiányzik/érvénytelen, tone `sage`) — a jóváhagyás-inbox az egyetlen azonnal látható tartalomblokk, alatta a szekció-mozaik. `PageHead`-en egy `?` help-chip nyitja a Hogyan-nézetet.
- **`?view=tenyek`** (tone sage, `FactsView`) — a régi Tudástár tény-fele, változatlan szerződésekkel (lásd lentebb). Vissza-chip „‹ Tudástár".
- **`?view=kategoriak`** (tone lav, `KategoriakView`) — a volt Tudásgráf kind-lánca, kód-mozgatva az `insights` feature-be (lásd külön bekezdés lentebb). Vissza-chip „‹ Tudástár", kind-drillben „‹ Kategóriák".
- **`?view=profil`** (tone rose, `ProfileView`) — a volt „Profil" szekció, „Így beszélj velem" néven (lásd lentebb). Egy profil-node NÉLKÜLI `?view=profil` az alapnézetre esik vissza (`ProfileView`-nak nincs „nincs profil" állapota).
- **`?view=hogyan`** (tone gold, `HowItWorksView`) — a törölt `KnowledgeExplainer` öt Q&A-blokkja + egy hatodik („Mik a kategóriák?"), külön nézetként, nem összecsukható panelként. Nem perzisztál állapotot.

**Hero** — `N tény` + `M megy a chatbe · K kapcsolat`, ahol M a ténylegesen injektált tények száma a TELJES (szűretlen) listán, **nem** az összes bekapcsolté: a `bucketFacts()` a backend két injektálási csatornáját tükrözi — a rangsoros top-N blokkot (`reinforced DESC, createdAt DESC`, `PROMPT_TOP_N = 10`, a `mezo.companion.facts.top-n` kézzel szinkronban tartott tükre) ÉS a `renderNewPatternFactsBlock()` friss-minta kivételt (minden bekapcsolt, `source: 'pattern'` tény, ami `PATTERN_ACK_DAYS = 3` napon belül jött létre, a rangsortól függetlenül bekerül — a `mezo.companion.facts.pattern-ack-days` tükre, mindkét konstans `data/insights/knowledge.ts`-ben). A **`· K kapcsolat` szegmens** a `mezo-ms9a` backend-kiegészítéséből jön (`useGraphEdgeCount()` → `GET /api/companion/graph/edge/count`, active-endpoint-filtered él-összesítő); a hook 404/hiba/pending esetén `count: null`-t ad, SOHA nem 0-t — a hero ilyenkor egyszerűen ELHAGYJA a szegmenst, nem hazudik nulla kapcsolatról. A hero szám degraded alatt sincs fabrikálva („0 tény"): nagy szám/alcím nélkül marad.

**Jóváhagyás-inbox** — `Jóváhagyásra vár · N` eyebrow alatt `FactCandidateCard` (`components/`): **Elfogad** / **Pontosít** (inline input → Mentés) / **Elvet** → `useKnowledgeActions().decide(...)`, alatta a három gomb hatását kiíró sor. Confirm sosem néma (IDENT-6). **Konfliktus-jelzés (Task 12, `mezo-ms9a` — spec §4.3, FE+mock-seed ebben a slice-ban, ld. lentebb a bd follow-up-ot):** ha a jelölthöz a base view egy ütköző, meglévő tényt talál (a candidate `conflictsWithFactId`-jét a `facts` listában feloldva), a kártya egy figyelmeztető sort renderel („⚠ Ellentmond ennek: »…«") + egy bejelölt (default: be) „A régit kikapcsolom" checkboxot. Bármelyik ELFOGADÓ útvonalon (Elfogad VAGY Pontosít+Mentés — mindkettő ténnyé promótál) a decide UTÁN, ha a checkbox be van jelölve, az ütköző tény ki is kapcsol (a shell `useKnowledgeActions().toggle`-jét adja át `onToggleConflict`-ként). Elvetésnél a toggle sosem fut; konfliktus hiányában semmi nem látszik, a mező hiánya visszafelé kompatibilis.

- **A gráf-jelölt inbox (W2.3 `mezo-b3pp.8` + W5.3 `mezo-b3pp.20`)** — a fact-jelölt blokk UTÁN, a szekció-mozaik ELŐTT; `useLifeEventCandidates()` + `LifeEventCandidateCard` (`components/`). **Két jelölt-fajtát hordoz**, `LIFE_EVENT` (éjszakai életesemény-kivonat) és `SEASON` (negyedéves szezon-olvasat), FAJTÁNKÉNT csoportosítva, saját eyebrow-val és saját proveniencia-mondattal — `(['LIFE_EVENT','SEASON'] as const).map(...)` renderel egy-egy `„<fajta eyebrow> · N"` blokkot csak azokra a fajtákra, amelyeknek van jelöltje, a `CANDIDATE_COPY` (`data/insights/graph.ts`) fajtánkénti `{eyebrow, provenance}` szótárából. Mindkét blokk FÜGGETLEN a Tudástár többi részétől — akkor is megjelenik, ha a Tudástár egyébként üres. Kártyánként: egy fajtafüggő dátumsor (`formatCandidateDate` — egy `LIFE_EVENT` `occurredOn`-ja a nap, nyers ISO alakban; egy `SEASON` `occurredOn`-ja a negyedév ELSŐ napja, ezért magyar negyedév-alakban jelenik meg, pl. „2026. III. negyedév"), cím, összefoglaló, a `CANDIDATE_COPY[kind].provenance` fajtánkénti magyarázó mondata, **Elfogad**/**Pontosít**/**Elvet** → `useLifeEventActions().decide(id, decision, refined?)`, és egy lábjegyzet-sor, ami kimondja a `proposedEdgeCount`-ot: `N` esetén „Elfogad → bekerül a gráfba N kapcsolattal · Pontosít → átírod cím/összefoglaló · Elvet → eldobom.", `0` esetén (minden `SEASON`, amely sosem javasol élt) a rövidebb alak él-kapcsolat nélkül. **Szerkeszt-aztán-elfogad (Task 11, `mezo-ms9a` — spec §4.2):** a „Pontosít" a `FactCandidateCard` inline refine idiómáját követi, de kind-agnosztikus és MINDKÉT mezőt (cím + összefoglaló) szerkeszthetővé teszi — `startRefine()` a jelölt eredeti szövegével tölti elő az inline editort, „Elfogad így" a szerkesztett `{title, summary}`-t küldi a `decide('accept', refined)`-nek. Backend: a kind-agnosztikus döntés-végpont opcionális `refinedTitle`/`refinedSummary` mezőt kap (a fact-jelölt `refinedText` mintája, [`companion.md`](companion.md) §4); a mock ág ugyanígy viselkedik. Nincs új backend endpoint a jelölt-listához/döntéshez — mindkét fajta ugyanazt a `GET /api/companion/graph/node/candidate` listát és ugyanazt a kind-agnosztikus döntés-végpontot használja ([`companion.md`](companion.md) §4 W5.3 alszakasz). Mock módban a seed egy-egy példányt hordoz mindkét fajtából. **Elfogadás után a kártya helyén megerősítés marad** (`LifeEventAcceptedCard`, `mezo-0ap9`): sage csík, „Bekerült a gráfba · N kapcsolattal" (`proposedEdgeCount === 0` esetén a rövidebb „Bekerült a gráfba"), a jelölt (esetleg pontosított) címe. **A `mezo-0ap9`-es „Megnézed? → Tudásgráf" link törölve** (`mezo-ms9a`) — nincs hova mutatnia, az eredmény ugyanezen az oldalon, a Kategóriák csempe mögött landol; a kártya többi viselkedése (page-szintű `acceptedEvents` state az oldal elhagyásáig, fajtánként szűrve, `pendingLifeEvents` derivált a real-módú refetch-ablak elfedésére, a csoport eyebrow-jának `settled` címkére váltása üres jelölt-lista esetén) változatlan. Elvetésnél nincs változás: a jelölt némán eltűnik.
- **Szekció-mozaik** (alapnézet, három `Tile`) — **Tények** (sage, `i-polc`): badge = tényszám, sor = `X a chatben · Y vár · Z kikapcsolva`, `?view=tenyek`-re navigál; **Kategóriák** (lav, `i-retegek`): badge = kind-szám, sor = a legutóbbi (legfrissebben frissült — a `useKnowledgeGraphNodes()` `updatedAt` szerint DESC rendezve) kategorizált node címe + él-száma, `?view=kategoriak`-ra navigál; **Így beszélj velem** (rose, `i-checkin`, széles csempe): sor = a profil-próza első 40 karaktere + „… · heti frissítés", `?view=profil`-ra navigál — **csak akkor renderel, ha van profil-node** (`profileNode`, a `PROFILE_SOURCE_KIND` szerinti szűrés). Degraded alatt a Tények csempe nem renderel (a fact-felület fed le), a Kategóriák/Így beszélj velem csempék igen.
- **Genuinely üres tudásbázis** (`facts.length === 0`, nem pending/error/degraded, a `?view=tenyek` nézeten) — a kereső/kategória-chip sor és a szakaszok helyett egy őszinte sor: „Még egy tényt sem tanultam rólad — ahogy beszélgettek, itt fognak megjelenni."

**`?view=tenyek` (`FactsView`)** — **Kereső + kategória-chipek** — `.searchfield` + `chip tapchip` sor (`Mind` + `FACT_CATEGORIES`); a szűrés csak a megjelenítést szűkíti, a vödrözés mindig a TELJES listán fut (különben egy aktív szűrő átírná a prompt-státuszokat). A keresés (`matchesQuery`) a humanizált szövegre, a kategória-címkére ÉS az eredet-mondatba fűzött minta-címre (`patternTitle`) illeszkedik. A **„Mind" chip csak a kategóriát törli** — a keresőmezőt érintetlenül hagyja. Nulla találat → „Nincs találat a keresésre." + egy „Szűrők törlése" gomb, ami mindkettőt (keresés + kategória) törli. **Három prompt-státusz szakasz** — „Most ezeket kapja meg a társ · N" (a SZŰRT darabszám, a globális fejléccel ellentétben; a lábjegyzet mondja ki a `PROMPT_TOP_N` + friss-minta kivétel szabályt), majd két `LifecycleSection` (újrahasznosítva a Minták dashboardról): „Bekapcsolva, de most kimarad" **nyitva indul** (`defaultOpen`), „Kikapcsolva" csukva — egy frissen elfogadott tény-jelölt `reinforced: 0`-val a várakozó vödörbe sorolódik, és eltűnne a DOM-ból abban a pillanatban, amikor a felhasználó elfogadja, ha a szakasz csukva indulna. Mindkét `LifecycleSection` megkapja a `forceOpen`-t, amíg aktív szűrő fut, VAGY amíg a `?fact=` deep-link célja épp abban a vödörben ül (lásd lentebb). **`KnowledgeFactRow`** (`components/`) — önmagyarázó kártya: kategória + eredet-chip, humanizált cím, eredet-mondat, visszaigazolás-mondat, és a `Toggle` mellett kimondott státusz-címke.

**`?fact=<id>` deep link (Task 10, `mezo-ms9a` — spec §4.1)** — a `WeekDiscoveries` már régóta gyárt ilyen linket, de eddig senki nem fogyasztotta (a `feedMock.ts`-beli halott `/insights/knowledge` deeplinkjeit is `/mezo/knowledge`-ra javította ez a slice). Az oldal most fogyasztja: `?fact=` jelenlétekor a `?view=` paramot felülírva mindig a Tények nézet nyílik — a `highlightFactId` a mountkor `useState`-be rögzített id, hogy a kiemelés a param eltűnése UTÁN is éljen — a tény-sor a megfelelő (akár csukva induló) vödörben `forceOpen`-nel válik láthatóvá és vizuálisan kiemelődik (`KnowledgeFactRow`'s `highlight` prop). A `?fact` paramot egy mountkor egyszer futó `useEffect` törli az URL-ből `replace:true`-val, más paraméterek (pl. egy jövőbeli `?view=`) érintetlenül maradnak. Ismeretlen id → sima Tények nézet, kiemelés nélkül, összeomlás nélkül.

**`?view=kategoriak` (`KategoriakView`, tone lav — a gráf-örökség tónusa, szándékos váltás az alapnézet sage-jéhez képest)** — a volt `KnowledgePage` overview-first kind-lánca, egy szinttel beljebb tolva, kód-mozgatással (`me` → `insights`): `kind === null` → **`KindTileGrid`** (egy `Tile` kind-enként, `GRAPH_KIND_GROUPS` szerint, üres kind halványan bent marad); `?kind=<GraphNodeKind>` (érvényes érték, `KIND_LABELS`-szel validálva — érvénytelen `kind` a rács-nézetre esik vissza) → **`KindNodeList`** (`CategoryHeader` + kompakt sorok); sor-koppintás → **`NodeDetailSheet`** (lokális `selectedId` state a shellben, a régi archiválás-viselkedéssel: `useKnowledgeGraphActions().archive`, a node eltűnése a listából magától zárja a sheet-et). A vissza-affordancia a `TudasFrame` page-head chipje (`mezo-ni86`): a rács-nézeten „‹ Tudástár", a kind-drillben „‹ Kategóriák" (törli csak a `kind` paramot, `replace:true`).

**`?view=profil` (`ProfileView`) — „Így beszélj velem" (Task 7, `mezo-ms9a` — spec §3.4)** — a volt „Profil" szekció új kerete: cím **„Így beszélj velem"** (a „Profil" szó a felületről ELTŰNT — az `Eyebrow` és a `PageHero` egyaránt az új nevet mondja), a `ProfileNodeCard` (`Rólad tanultam` + proveniencia-sor + Archivál, változatlan a `mezo-b3pp.17` óta) alatt egy rövid magyarázó kártya („Ez a bekezdés minden beszélgetés elé odakerül… Az Archiválás a felejtsd-el kar…"). A shell csak akkor navigál ide (`?view=profil`), ha van profil-node — a komponens nem ismer „nincs profil" állapotot.

**`?view=hogyan` (`HowItWorksView`) — Hogyan-nézet (Task 7, `mezo-ms9a` — spec §3.5)** — a törölt `KnowledgeExplainer` (összecsukható „Hogyan működik a tudástár?" panel, `localStorage`-kulcs `mezo.knowledge.explainer.collapsed`) öt Q&A-bekezdése VERBATIM ide másolva, plusz egy hatodik („Mik a kategóriák?"), Q&A-kártyaként; a `PageHead` `?`-chipje nyitja bármely nézetről. Nem perzisztál összecsukott állapotot — külön nézet, nem áll az útban a mindig-nyitott alapnézetnek.

**Minden felhasználói mondat a `logic/factCopy.ts` tiszta moduljából jön** (unit-tesztelt): `humanizeFactText()` az „A ↔ B" alakú minta-tényekből mondatot képez (a promóció a minta CÍMÉT másolja a tény szövegébe — `PatternService.promote()`), `originSentence()`/`originChipLabel()` a `source`-ot fordítja, `reinforcementSentence()` a `×N reinforced`-et. **A régi önismétlő `minta: {title}` chip megszűnt** — a minta-cím már csak akkor jelenik meg (evidenciaként, az eredet-mondat végén), ha eltér a tény szövegétől. A humanizálás egy szó akkor tekinti rövidítésnek (és hagyja változatlanul, névelőt is a betűnév kiejtése — nem az írott alak — szerint választva, pl. **„az RPE"**, **„a HRV"**), ha a szó ELSŐ KÉT karaktere nagybetű (a toldalékolt „HRV-alapú" is helyesen felismerve); a záró mondatvégi írásjelet mindkét oldalról levágja, hogy ne dupláződjon a sablon lezáró pontjával.

Real mode a companion switch-off 404-en változatlanul az őszinte degraded bannert adja (*"A társ jelenleg nincs bekapcsolva…"*), a fact-felületre korlátozva (lásd fent).

### 2.5 Chat (`pages/ChatPage.tsx`) — ✅ REAL since companion V0.4 (chips real since V0.5)
At `/mezo/chat`. **Not a tile — the hub's composer-shaped opener is its door** (§2.0), which is the point: the chat is the companion, so it sits above the directory rather than in it. The page renders its own „Mezo · társ" header (a `ClaySpot` orb since Design 2.0); since `mezo-oq8z` this is the route's **only** header — `AppLayout` suppresses the generic shell `AppHeader` here, and `.mzc-chathead` sticks directly at `top: 0`, eliminating the former double-header stack without removing any conversation controls. The companion conversation is **dual-mode** over `useChat(selection)` + `useChatActions(selection, onCreated)` + `useConversations()` (from `@/data/hooks`; backend + hook details in [`companion.md`](companion.md) §3/§5.1). Header: "Mezo · társ" + an **honest mode subtitle** (`demo beszélgetés` / `Gemini · élő` / `új beszélgetés` / `a társ most nem elérhető`) — the Phase-1 fake "`23 facts active`" string and "L4 aktív" chip are gone — plus two chip actions: **Beszélgetések** (opens `sheets/ConversationPickerSheet.tsx`) and **Új beszélgetés**. **Real mode:** bootstraps the selected conversation + history, `send()` renders the optimistic user bubble + thinking-dots, then the answer **streams in** (SSE deltas into a draft bubble) and the persisted pair lands in the `['chat', <selection>]` cache; stream failure → inline error bubble + history refetch; companion switch off (404) → degraded banner (`A társ jelenleg nincs bekapcsolva…`) + disabled composer, no dead-end (IDENT-3). **Mock mode:** the Phase-1 demo — `initialChat` seed + the 1.2s `cannedReply` (branches on `"fáradt"`, fabricated `tools`/`refs`). Only the seeded `mock-conversation` carries that transcript: a conversation started during the session opens EMPTY and gets its own auto-title from the first message, exactly as it would against the backend (`mockThread()` in `chatHooks.ts` — returning the seed for every id made new mock threads inherit the demo's messages).

**Conversation actions + the error bubble's hands (F7.5, `mezo-d20.8.5.1`).** The header grew a third disc — **⋯ „A beszélgetés műveletei"** (disabled on a draft thread / degraded) — and every picker row a **kebab** (`onActions` prop): both open `sheets/ConversationActionsSheet.tsx` for that conversation. **Átnevezés** = inline input (prefilled, Enter/Mentés, NO confirm — reversible) → `useConversationActions().rename` (`PATCH /api/companion/conversation/{id}`; mock leg rewrites `CONVERSATIONS_KEY` in place). **Törlés** = two-step warm confirm („…a belőlük tanult emlékeket ez nem érinti." — ADR 0010, a decision not a mistake) → `remove` (`DELETE`, soft server-side; invalidates the list + BOTH `['chat','newest']` and the id-keyed thread cache), and deleting the on-screen conversation moves `?c=` off the dead id. The **error bubble** (amber `.mzc-bub-err`, a hiccup not a scolding) now keeps the failed turn: `useChatActions` retains `failedText` past the `finally`, and the bubble renders **Újra** (`retry()` — re-sends the same text, *replace don't append*: no duplicated user bubble) + **Szerkesztés** (`editFailed()` → the text lands back in the composer). The AI-SDK regenerate state model, adopted per the F7.5 recon.

**Which conversation is on screen (`mezo-at8x.3`)** lives in the URL: `?c=<uuid>` a persisted thread, `?c=new` an unsent draft one, no param the newest. A draft thread shows a one-line invitation instead of a blank page and only becomes a server row **on the first send** (lazy create → `onConversationCreated` moves `?c=` onto the new id), so opening "Új beszélgetés" and walking away leaves nothing behind. The picker sheet lists the persisted conversations newest-first with their server-side auto-title (first user message, truncated) and a `ma/tegnap/<hó nap>` stamp.

**Scrolling + composer (`mezo-at8x.2`).** The chat rides `.screen-content`, the single app scroller, so `logic/useStickToBottom.ts` drives *that* element **inside a rAF** — `ScreenContent` resets it on every route change and a parent's effect runs *after* its children's, so a scroll issued straight from ChatPage's effect gets undone on the way in. Every scroll uses **`behavior: 'instant'`**: `.screen-content` carries `scroll-behavior: smooth`, which a bare `scrollTop =` (and `behavior: 'auto'`, which per spec defers to the CSS value) inherit — and a smooth scroll in this container is cancelled by the next scroll operation, so it lands nowhere. `ScreenContent` itself was switched to an instant `scrollTo` for the same reason (its animated reset was eating the chat's scroll-to-newest). A `ResizeObserver` re-anchors while the user is parked at the bottom, which covers both late layout (fonts/cards) and a streaming answer; a 500 ms settle window keeps a programmatic scroll's own events from reading as "the user scrolled up". Opening a thread parks on the newest turn, and a streaming answer only pulls the view down while the user is within 96 px of the bottom. The composer is `.chat-composer` — `position: sticky; bottom: var(--screen-bottom-pad)` — pinned right above the tab bar; `.chat-page`/`.chat-thread` turn the page into a column so a two-message thread keeps it at the bottom instead of mid-screen.

**Entry points + mid-workout switching (`mezo-78sd`).** The chat is one tap from anywhere: the shell-level `FloatingReturnLayer` ([_platform-design-system.md](_platform-design-system.md) §5 integration table) renders a lavender chat bubble on every route (including the full-bleed `/train/session`, which has no tab bar), on top of the older two-tap path (center FAB → QuickInputSheet chat row). While a gym workout is open, the same layer swaps its bubbles on THIS page for a coral `.float-return` "Vissza az edzéshez" bar floating above the composer (workout title + done-set count → `/train/session`) — the chat-during-workout loop is two one-tap jumps. The bar is shell chrome (positioned off `--screen-bottom-pad`), not part of ChatPage; nothing in this page's code knows about it.

**Composer:** mic button (**live since `mezo-at8x.4`** — `logic/useVoiceInput.ts`: `getUserMedia` + `MediaRecorder` → 16 kHz mono WAV (`shared/lib/audio.ts`) → `useTranscribe()` → the transcript is **appended to the input, not sent**, so the user checks it first; recording state = coral chip + `voice-wave` icon + `Hallgatlak…` placeholder, then `Leiratozom…`; unsupported/denied mic → disabled button or an honest one-liner), controlled **auto-grow `<textarea>`** (`mezo-a837`): `rows=1`, and a layout effect re-measures it on every keystroke (height → `auto` → `scrollHeight`, capped at `COMPOSER_MAX_HEIGHT` = 104 px ≈ 5 sor, then the field's own `overflow-y: auto` takes over) — a long message **wraps and stays fully visible** instead of scrolling sideways out of view, which the old single-line `<input>` did. **Enter sends** (unchanged), **Shift+Enter breaks a line**, and an IME composition swallows neither; the composer row is `align-items: flex-end` so the mic/send chips stay pinned to the bottom edge while the field grows. Send button. **`ChatMessage`** (`components/ChatMessage.tsx`): user bubbles right-aligned (`white-space: pre-line`); assistant bubbles left, the answer rendered through **`<Markdown>`** (`shared/lib/markdown.tsx`, `mezo-at8x.1`) as real blocks — paragraphs, `-`/`1.` lists, `##` headings, inline bold/italic/code — instead of the old single `<p>` that printed the model's `**` marks literally and collapsed its line breaks; preceded by a `ToolChipRow` and followed by a "Hivatkozott · L3" footer of `RefTag`s when `refs` present — **real data since companion V0.5**: tool-using turns arrive with `tools[]` (`{type:'read', name:'get_recovery(scope=sleep, days=3)'}` — args baked into the name) and tool-contributed `refs[]` (kinds: `Workout`/`Sport`/`Run`/`WeightTrend`/`Sleep`/`FuelDay`/`Protocol`/`Goal`/`Medication`, plus more since V2.3/mezo-xixu — full kind catalog in [`companion.md`](companion.md) §4); **since mezo-280 chips also render live on the in-flight draft bubble** — each `tool` SSE event appends onto `ChatTurn.tools` and renders through the same `ToolChipRow` as the tool executes, instead of appearing all at once after the answer; the draft (chips included) is still discarded wholesale when the terminal `done` row is appended, so that row's `tools[]` remains the persisted truth. Since
**companion V1.3** an assistant bubble whose answer failed the backend advisor self-check even
after the corrective retry (`MessageResponse.degraded`) carries a subtle `nem ellenőrzött`
eyebrow next to the timestamp (tooltip; [`companion.md`](companion.md) §2) — mock mode never
shows it.

**Feedback chips (W4.1, `mezo-b3pp.15`).** A `FeedbackChips` row sits under **assistant bubbles that
carry a persisted row id**, and nowhere else: never on a user bubble (not an AI artifact) and never
on the in-flight streaming draft, which has no id yet — there is literally nothing to vote on until
the terminal `done` row lands, and the chips appear at that moment. `ChatPage` calls
`useFeedback('chat_message', assistantIds)` **once for the whole thread** (a per-bubble hook would
fire one request per answer — 20+ on a real conversation) and hands each `ChatMessage` a
`{value, onVote}` slice; `ChatMessage` renders the row only when that prop is present. Both bubbles
and chips are keyed by the persisted id (`key={m.id ?? \`idx-${i}\`}`) so that reusing one bubble's
`FeedbackChips` instance for a different answer cannot carry that instance's session-local reason-row
state across (advisory since the row derives from the verdict, §5.7 — but free, and the bubbles need
the key anyway). `ChatMessage.id` is new (`types.ts`, optional) and the mock seed
+ the mock `cannedReply` path now mint ids too, so the demo surface shows the same affordance the
live one does.

### 2.6 Előrejelzések (`pages/PredictionsPage.tsx`) — **REAL dual-mode since proactive P1 (`mezo-h4wp.7`); Mozaik re-face `mezo-d20.5.6`**
At `/mezo/predictions`, the hub's fifth tile. Cards became **status-washed `.predtile` tiles** — `◐ Folyamatban` = lavender + an animated confidence bar, `✓ Bevált` = sage + a „✓ Bejött:" actual line — and the re-face **localized the status chips**, which had shipped in English off the wire (`✓ Validated` / `✗ Missed` / `◐ Pending`), along with the accuracy header. That is a designed fix, not a data change: the wire is unchanged. Every honesty contract below is preserved verbatim. The surface **un-ghosted at P1**: `usePredictions()` (`data/insights/predictionsHooks.ts`) reads `GET /api/proactive/prediction` (a list; `[]` on loading/error — never a 404) and returns `{predictions, mode}`. Each `Prediction` card renders a status chip (`✓ Validated` / `✗ Missed` / `◐ Pending`), the derived window-label date, the display title, the confidence `bar-fill glow` + `NN%` **only when confidence is present** — otherwise the honest **„tanulom"** chip (a statistical pattern carries no confidence, so most v1 rows read „tanulom", never a fabricated %) — the optional `basis` paragraph, and (once the validation job closed the window) the code-formatted `actual` outcome line. The header's right side is the **accuracy derived from CLOSED rows** (`validated / (validated+missed)`), shown only when at least one has closed. An empty live list renders the honest **still-learning null-state** *"Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul."*. **Mock mode** keeps the Phase-1 seed + the literal `2 validated · 60-day acc 68%` header (byte-parity). Behavior detail in [proactive.md §2](proactive.md).
- **Feedback chips (W4.1, `mezo-b3pp.15`):** one `FeedbackChips` row per prediction card, **both modes** — `useFeedback('prediction', predictionIds)` is called ONCE for the whole list (never per card) and sits **above** the empty-state early return, which is safe because an empty id set skips the network entirely. Predictions already carried an `id` on the wire, so this tab needed no contract change. Each row is keyed by the prediction id (the reason row is per-card, §5.7).

### 2.7 Kísérletek (`pages/ExperimentsPage.tsx`) — **REAL dual-mode since proactive P2 (`mezo-h4wp.8`); Mozaik re-face `mezo-d20.5.6`**
At `/mezo/experiments`, the hub's sixth tile. Status-washed tiles as above — `◇ Javaslat` = a gold-ringed proposal card carrying the Elfogadom/Elvetem row (live-only; accepting invalidates and the refetched row re-faces as `◐ Aktív 0/7`), `◐ Aktív` = amber + a day-dot row + a gold progress bar, `✓ Megerősítve` = sage + a „✓ …" outcome line — and the re-face gave the **dismissed branch its missing label** (audit §6 gap). The **last** tab un-ghosts, and it's the first Insights surface with a WRITE. `useExperiments()`
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
per-pattern **pattern-pair detail page** (§2.1b, `/mezo/patterns/{pairKey}`, `mezo-tk88.5`) for
the per-pair drill-down (source chips, raw `r/n/p`, the strength timeline).
`router.tsx` maps **`/mezo/motor` to `<Navigate to="/mezo/patterns" replace />`** (`/insights/motor`
reaches it through `LegacyPathRedirect` first) so old links/bookmarks still resolve. Every LIVE-recomputation guarantee Motor made (§2.1: no persistence, no historical
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
nested „Hogyan számoltuk? → Technikai számok” disclosure (§2.1b); the dashboard's decision cards and
lifecycle rows never render raw `r`/`p`/`n`, only the human
`findingSentence`/`confidenceMeta`/`verdictSentence` translations that already existed
(`logic/findings.ts`/`logic/verdicts.ts`, unchanged, still exercised by the dashboard).

### 2.9 Memória (`pages/MemoryPage.tsx`) — read-only memory-layer observatory since `mezo-al1i`
At `/mezo/memoria`. **Not a tile either — the hub's full-width L0→L3 memory band is its door** (§2.0), which mirrors on the hub exactly the four-layer stack this page unfolds. Its four page-local segments and every panel below are unchanged by Design 2.0; only the cross-links moved onto `/mezo`.
The companion's own memory pipeline made legible: not another results tab, but a transparency page
onto the **L0→L3 memory stack itself** (raw daily metrics → the L1 episodic journal + vectors → the
L2 judgement inbox → L3 durable knowledge) — the spine [`companion.md`](companion.md) documents by
version slice, rendered live. Four **local segments** behind `useStickyTab('insights.memoria.view')`
(`Áttekintés` / `Napló` / `Kereső` / `Audit`, a segmented-control bar identical to the
Growth/FuelSlots idiom, `MemoryPage.tsx:37-45`) — this is a **page-local** sub-nav, not a router
route; all four read off two page-level hooks (`useMemoryOverview()`, `useMemorySummaries()`, both
`@/data/hooks`), so switching segments never refetches. A single **degraded card** (companion off →
404 on the overview call) replaces the whole page with a link to `/mezo/motor` (which redirects to
`/mezo/patterns`, §2.8 — the link survives the Motor retirement as an extra hop, repointed onto
`/mezo` by `mezo-d20.5.1` but still not shortened past the redirect); the
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
  "last" stamp = `jobs.lastDetectedAt` — tappable, routes to **`/mezo`**, the hub), **L3**
  (`--success` wash: confirmed-fact counts by `source` + total `reinforcement_count` +
  `factsInPrompt` — tappable, routes to **`/mezo/knowledge`**). Between cards, a pulsing dashed
  **`FlowConnector`** in the NEXT layer's own accent colour, labelled with the raw cron string for
  the job that fills that layer (`summaryCron`/`patternCron`/`hypothesisCron` — the FE never parses
  cron, same discipline as the Patterns dashboard's hero, §2.1) — the pulse is CSS (`.memory-flow-line`,
  `prototype.css`) and is disabled under `prefers-reduced-motion: reduce`. A footer link — "Miért
  nem lát még mintát a motor? →" — completes the mutual cross-link with `/mezo/motor` (§2.8
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
cross-link, so today the link is **one-way** (Memória → `/mezo/motor`, redirecting to
`/mezo/patterns`); a reverse link back to Memória from the dashboard's „Adat-egészség" section is a
small filed follow-up, not yet done. (Design 2.0 repointed both ends onto `/mezo` without
changing the asymmetry.)

---

## 3. Architecture & data flow

> **Design 2.0 touched nothing in this section.** Same hooks, same query keys, same dual-mode branches, same mappers. The one structural note: `MezoHubPage` calls **twelve** of them at once (`useToday`, `useTodayScenario`, `useCompanionFeed`, `useConversations`, `useMemoryOverview`, `usePatterns`, `usePatternMonitor`, `useMeWeek`, `useMemoir`, `useKnowledge`, `usePredictions`, `useExperiments`) plus `usePatternActions` and `useNotificationFeed` — one per tile line, plus the orb and the decision card. They share the TanStack cache with the pages they link to, so the hub costs no request the pages would not have made; but a new tile line is a new hook call on the hub, which is the one place a careless addition makes the tab's cold load heavier than any single page's.

The Insights data flow is a **degenerate (truncated) version** of mezo's standard `view → hook → mock/real → api → backend → db` pipeline — it stops at the hook:

```
View (PatternsPage, MemoirPage, …)
  → hook (useInsights / useKnowledge / useChat — frontend/src/data/hooks.ts:11-18)
    → static module import (data/insights/insights.ts, data/insights/knowledge.ts, data/insights/chat.ts)
      → [PHASE-3 GAP: no api client, no apiFetch, no backend, no db]
```

Contrast with a real-mode feature (e.g. `useWeight` in `weightHooks.ts` / `useSleep` in `hooks.ts:79`) which switches on `isMockMode()` between static `initialData` and a real `*Api` call over `apiFetch`. The Insights hooks have **none of that machinery** — no TanStack Query, no `initialData`, no mutation, no mode switch:

- `useInsights()` (`data/insights/insightsHooks.ts`) → `{ patterns, recentlyConfirmed, memoir, anniversaryNote, predictions, experiments }` — direct static re-exports. **Every page has now split out to its own dual-mode hook** (Memoir at W2, Predictions at P1, **Experiments at P2** → `useExperiments()`/`useExperimentActions()`; the former Weekly split, D′, is **retired entirely** — `mezo-p2tr`, §2.2). **`useInsights` has NO live consumers left** — `PatternsPage` uses `usePatterns` (V3.1). The `memoir`/`anniversaryNote`/`predictions`/`experiments` fields survive only because the dedicated hooks re-import the seed straight from `insights.ts` for their mock branch; `useInsights` itself is now effectively dead and can be removed in a cleanup pass.
- `useKnowledge()` (`data/insights/knowledgeHooks.ts` since V1.2) → dual-mode `{ facts, candidates, edges, activeCount, degraded, mode, isPending, isError, refetch }` (`['knowledge']` `useDualQuery`; real fetches `GET /api/companion/fact` + `.../fact/candidate`, `edges` real-mode `[]`; mock = seed). `isPending`/`isError`/`refetch` forwarded straight from `useDualQuery` (`mezo-9ryh` review fix) — `KnowledgeListPage` gates on them before rendering any prompt-status number (§2.4). Actions: `useKnowledgeActions()` → `{ toggle, decide, pending }`.
- `useLifeEventCandidates()` (`data/insights/graphHooks.ts`, W2.3 `mezo-b3pp.8`) → `{ candidates, isPending, isError, refetch }` (`['graph','candidates']` `useDualQuery`; real fetches `GET /api/companion/graph/node/candidate`, a **404 is an honest `[]`, not `degraded`** — the graph switch is independent of the companion switch; mock = `data/insights/graph.ts` seed). Actions: `useLifeEventActions()` → `{ decide, pending }` (`POST .../node/{id}/decision`, mock módban a jelölt lekerül a listáról).
- `useKnowledgeGraphNodes()` (`data/insights/graphHooks.ts`, W2.6 `mezo-b3pp.11`) → `{ nodes, isPending, isError, refetch }`, nodes DESC `updatedAt` rendezve (`GET /api/companion/graph/node`, 404 → honest `[]`, same independent-switch idiom). Actions: `useKnowledgeGraphActions()` → `{ archive }`. **`useGraphEdgeCount()` (`mezo-ms9a`)** → `{ count: number | null }` (`GET /api/companion/graph/edge/count`, active-edge count; 404/hiba/pending → `null`, SOHA nem `0` — a Tudástár hero `· K kapcsolat` szegmensét adja, §2.4).

**Exception — Chat swapped at companion V0.4:** `useChat()` + `useChatActions()` moved to
`data/insights/chatHooks.ts` (re-exported from the `hooks.ts` barrel) and are **real dual-mode**
— `useChat` is a `useDualQuery` bootstrap (`{conversationId, messages, degraded, mode}`; mock =
`initialChat` seed, real = newest conversation + history via `chatApi`, 404 → degraded ghost),
`useChatActions` is the send/stream state machine over the SSE client (`chatApi.streamMessage`,
`apiSse` in `data/_client/api.ts`). Details: [`companion.md`](companion.md) §5.1.

**Weekly's former client-side composition (D′, `mezo-t16y.1`) is RETIRED (`mezo-p2tr`).** `useWeekly()` used to fan the pipeline OUT over Fuel/Train/biometrics reads plus the W1 suggestion and the E3 growth-week aggregate, composing a deterministic score by hand (`deriveWeekMetrics`/`deriveItems`/`deriveScore`). That entire fan-out is gone — the equivalent review now comes from a **single backend read**, `useMeWeek(start)` off `GET /api/me/week/{start}` (owned by the `me` feature — the score is server-computed, not FE-derived any more). `weeklyHooks.ts` keeps only `isoWeekNumber` (still shared by `memoirApi.ts`'s real-mode title). See [`me.md`](me.md) for the current pipeline; §2.2 above for the retirement.

**Exception — Memoir is REAL by a PROACTIVE BACKEND READ (W2, `mezo-h4wp.4`):** `useMemoir()` (`data/insights/memoirHooks.ts`, re-exported from the barrel) is a dual-mode `['memoir']` `useQuery` (`retry: false`): mock returns the `insights.ts` seed + `anniversaryNote` synchronously (`initialData`, `staleTime: Infinity`, no fetch), real fetches `GET /api/proactive/memoir` via `memoirApi.latest` (`memoirApi.ts`, `toMemoir` wire→FE `Memoir` with the client-derived `Hét N …` label), 404→null. Returns `{ memoir: Memoir | null; anniversaryNote: string | null; mode }` — the note is always null in live mode. Unlike Weekly (composed client-side) the memoir is a single proactive-owned backend read; the endpoint + generator live in [`proactive.md`](proactive.md).

The one remaining mock "interactivity" is pattern Confirm/Monitor/Reject, which lives in **component-local `useState`** and evaporates on unmount; the knowledge Toggle + candidate decisions are REAL since V1.2. **The memoir's Like/Love/Save/Dismiss reactions — the other item this sentence used to list — are DELETED (W4.1, `mezo-b3pp.15`)**, replaced by the persisting `FeedbackChips` row over `/api/companion/feedback`; a fifth real dual-mode data path (`data/feedback/feedbackHooks.ts`) joins the list below, and it is the first one Insights shares with another feature's screen (§5.7). The single FE↔data boundary (`hooks.ts`) is intact — chat (V0.4), knowledge (V1.2), patterns (V3.1), **memoir (W2)**, **predictions (P1)** and **experiments (P2, incl. the L2 write mutations)** all proved the swap; **no remaining Insights tab is mock-only** (Weekly, the sixth proof point, was retired outright rather than staying real — `mezo-p2tr`, §2.2).

---

## 4. Data model & API

> **No Insights-owned backend, contract, or DB.** Everything below is the **mock data shape** (the contract the views and tests pin). All types live in `frontend/src/data/types.ts:349-418` ("--- Tudás (knowledge) ---" + "--- Insights (AI-memory surface) ---"). Instances in `data/insights/insights.ts` / `data/insights/knowledge.ts` / `data/insights/chat.ts`. **Weekly (D′/`mezo-t16y.1`) is RETIRED (`mezo-p2tr`)** — it used to be the one Insights-composed exception (client-side over Fuel/Train/biometrics contracts, plus the new Train `listWorkouts` op from `train.md` §4); its replacement, `/me/week`'s server-computed review, is documented in [`me.md`](me.md) instead.

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
- `PatternMetricValueKind = 'number' | 'clock_hour' | 'binary'`; every monitor pair carries both
  value kinds. `PatternGateVerdict` includes `imbalanced_groups`; binary pairs expose nullable
  `groupZeroDays`/`groupOneDays`/`requiredPerGroup`. `patternPairMapper.ts` is the single wire→FE
  normalization path shared by monitor and detail, preventing DTO drift.

**Pattern-pair detail** (`types.ts:768-795`, `mezo-tk88.5`) — the §2.1b detail page's payload:
`PatternEventKind = 'snapshot'|'confirmed'|'monitoring'|'rejected'|'reinforced'|'promoted'` (mirrors
the backend `pattern_event` CHECK constraint 1:1), `PatternEvent { kind; occurredAt; r?; n?; p?;
reinforcementCount?; factId? }`, `AlignedDay { date; a; b }` (a live-computed evidence point, never
stored; rendered according to the pair's value kinds), `PatternImpactRef { id; title; status }`, `PatternImpact { fact; predictions; experiments;
challenges }`, `PatternPairDetail { pair: PatternMonitorPair; pattern: Pattern | null; events;
days; impact }`. Real mode maps **`GET /api/companion/pattern/pair/{pairKey}`**
(`data/insights/patternDetailApi.ts`, reuses `patternsApi.ts`'s `toPattern`) via
`usePatternPairDetail(pairKey)` (`patternDetailHooks.ts`, `['pattern-pair-detail', pairKey]`
dual-read; any 404 → one honest `notFound`, unlike the monitor's `degraded` — no distinct
"companion off" signal on this endpoint). Mock seeds in `insights.ts`: one hand-authored confirmed
„showcase" pair (`sleep-quality~next-day-training-rpe`) with a full 9-event history + 24 aligned
days + a promoted fact/2 predictions/1 experiment/1 challenge, and a minimal synthesized detail
(`pattern: null`, empty history/impact, `pair` straight off `patternMonitor.pairs`) for every other
catalog pair — a still-gathering pair with no persisted row yet. The explicit weekend fixture is
8 weekdays + 1 weekend and therefore `imbalanced_groups`; the confirmed showcase detail uses a
coherent frozen 32-day decision snapshot rather than the dashboard monitor's live 21-day row.

**Memoir** (`types.ts:375-381`): `MemoirAnchor { kind; label }`, `Memoir { id; week; title; body; anchors }` — single `memoir` + `anniversaryNote` string. **Real mode (W2)** maps the same `Memoir` shape from the proactive `GET /api/proactive/memoir` (`MemoirResponse {id, weekStart, title, body, anchors[], generatedAt}` → `toMemoir`, the `week` label derived client-side); `anniversaryNote` stays a mock-only seed. **`id` is new at W4.1** (`mezo-b3pp.15`) on both the wire and the FE type — the `memoir` feedback artifactId (§2.3); the mock seed carries a stable demo uuid. Owned by the proactive layer, not Insights ([`proactive.md` §4](proactive.md); `api/feature/proactive/proactive.yml`).

**Weekly / WeeklyGrowth — RETIRED (`mezo-p2tr`).** `WeeklyTrend`/`WeeklyItem`/`WeeklyReview`/`WeeklyGrowth` are deleted from `types.ts`, along with the client-side deterministic score formula (`deriveWeekMetrics`/`deriveItems`/`deriveScore`, its `SLEEP_TARGET_H`/`KCAL_BAND`/`WEIGHT_RATE_EPSILON` constants) and the `growthWeekApi.ts` client. The equivalent data now lives in `MeWeekAggregates` (backend-computed by `GET /api/me/week/{start}`) — see [`me.md`](me.md) §4 for its shape and scoring.

**Predictions** (`types.ts`): `PredictionStatus = 'pending'|'validated'|'missed'`, `Prediction { id; title; confidence: number | null; status; date; basis?; actual? }` — **`confidence` went nullable + the `missed` status at P1** (honest-state additions); real data comes from `GET /api/proactive/prediction` (`predictionsApi`/`predictionsHooks`), the mock seed stays in `insights.ts`.

**Experiments** (`types.ts`): `ExperimentStatus = 'proposed'|'active'|'completed'|'dismissed'`, `Experiment { id; title; status; day; total; hypothesis; outcome?; outcomeGood? }` — **`proposed`/`dismissed` added at P2**; real data comes from `GET /api/proactive/experiment` (`experimentsApi`/`experimentsHooks`), the mock seed stays in `insights.ts`. The `day` counter derives client-side from the wire `startDate`/`totalDays`.

**Chat** (`types.ts:410-418`): `ChatRole = 'user'|'assistant'`, `ChatRef { kind; id }`, `ChatMessage { id?; role; ts; text; tools?: Tool[]; refs?: ChatRef[] }`. `Tool` is imported from `@/shared/ui/ToolChip` (`{ type: ToolType; name; args? }`, `ToolType = 'read'|'compute'|'write'`). `initialChat` = 3 messages (assistant → user → assistant). **`id` is new at W4.1** (`mezo-b3pp.15`) — the persisted `ai_message` row id, i.e. the `chat_message` feedback artifactId; it is **optional on purpose**: absent while a turn is still streaming (nothing to vote on yet) and on the optimistic user bubble (never votable). The two mock assistant seeds carry stable demo uuids and `useChatActions`' mock reply mints one via `crypto.randomUUID()`, so mock mode is votable exactly like live.

**Feedback** (W4.1, `data/feedback/feedbackTypes.ts` — its own module, NOT `types.ts`, because it is companion-owned and crosses features in both directions: its seven artifact kinds come from two BACKEND features (companion's `ai_message`/`day_review`, proactive's other five) and its chips render on two FRONTEND ones (Insights + Today)): `FeedbackArtifactKind = 'chat_message'|'feed_message'|'weekly_suggestion'|'weekly_review'|'memoir'|'prediction'|'day_review'`, `FeedbackVerdict = 'up'|'down'`, `FeedbackReason = 'inaccurate'|'too_much'|'bad_timing'|'not_about_me'` (down-verdicts only — the backend 400s a reason sent with `up`), `ArtifactFeedback { artifactKind; artifactId; verdict; reason: FeedbackReason|null; updatedAt }`, and the handle `FeedbackHandle { get(id); vote(id, verdict, reason?); pending }`. All three enums arrive as plain `string` from `openapi-typescript` — the REQUEST side constrains them with a `pattern` and the RESPONSE side only documents them in a `description` ([`companion.md` §4](companion.md)), and the generator narrows neither — so `data/feedback/feedbackApi.ts`'s `toArtifactFeedback` casts them onto these unions once, at the boundary. **Endpoints are companion-owned**, not Insights: `GET/PUT/DELETE /api/companion/feedback` (`api/feature/companion-feedback/companion-feedback.yml`, tag `CompanionFeedback`) — full table/endpoint/semantics writeup in [`companion.md` §4](companion.md). The mock seed (`feedbackMock.ts`) is **deliberately empty**: feedback is something the USER produces, and pre-seeding thumbs would fake a history the demo never had; mock-mode votes accumulate in the TanStack cache for the session.

**Memory** (`types.ts`, `mezo-al1i`) — like Weekly/Memoir, real data comes from ANOTHER feature's backend (here: companion), not an Insights-owned one: `MemoryOverview { l0: {daysWithAnyData; windowDays}; l1: {summaryCount; firstDate; lastDate; embeddings: MemoryEmbeddingKindCount[]}; l2: {patterns: MemoryPatternCount[]; pendingFactCandidates}; l3: {facts: MemoryFactSourceCount[]; totalReinforcements; factsInPrompt}; jobs: {summaryCron; patternCron; hypothesisCron; lastSummaryDate; lastDetectedAt} }` with `MemoryEmbeddingKindCount { kind; count }`, `MemorySummaryItem { date; narrative; embedded }`, `SimilarDay { date; excerpt; similarity; finalScore }`, `MemoryLlmUsage { enabled; perDay: LlmUsageDay[]; totals }` with `LlmUsageDay { date; calls; inputTokens; outputTokens; costUsd: number|null }`. **`l1.embeddings` is a BREAKING shape change since `mezo-b3pp.22`**: it was the fixed `{dailySummary; chatTurn}` pair, replaced by a per-kind list matching the array shape `l2.patterns`/`l3.facts` already use in the same response — see [`companion.md`](companion.md) §4 for why (the `ck_memory_embedding_kind` CHECK outgrew a fixed field set) and for the `group by kind` query behind it. `MemoryLayersPanel` renders one stat per array entry via an `EMBEDDING_KIND_LABEL` map, falling back to the raw `kind` string for one it has no Hungarian label for yet — so a new writer's vectors show up in the panel the day it ships, not the day the FE catches up. These four shapes are **companion-owned** (`api/feature/companion/companion.yml`), not an Insights contract — mirrors the Weekly/Memoir precedent of a real-mode field fed by another feature's backend, except here ALL of a tab's data is companion-served. Mock seeds in `data/insights/memory.ts` (`memoryOverview`, `memorySummaries`, `similarDaysSeed`, `memoryLlmUsage`); wire mapping + the 4 REST calls in `data/insights/memoryApi.ts`; full endpoint + backend detail in [`companion.md`](companion.md) (new Memory-observatory block, near the pattern-monitor block).

**Endpoints / contract:** the **chat is contract-backed since companion V0.2/V0.4, tool-chips real since V0.5, knowledge facts + candidates since V1.1/V1.2, the 4 memory-observatory reads since `mezo-al1i`** — `api/feature/companion/companion.yml` (conversations, messages, sync + SSE stream turn, fact CRUD, candidate inbox + decision, `memory/{overview,summary,similar-days,llm-usage}`; see [`companion.md`](companion.md) §4). The FE `FactCategory` is the backend enum (`train|fuel|health|life`) since V1.2. Patterns still have **no dedicated Insights contract** (served by the companion `pattern` endpoints) — **except the pair-detail read**, which has carried its own contract-backed schema (`PatternPairDetailResponse`) since backend S1 close (`mezo-tk88.3`); see [`companion.md`](companion.md) §4 for the endpoint row + schema, and above for the FE mapping. **Weekly's retired client-side review** used to compose over Train's `GET /api/train/workouts?from&to` (added for it, D′) plus the proactive `weekly-suggestion` GET and the Progression `growth-week` GET — that composition is gone (`mezo-p2tr`), but `GET /api/train/workouts?from&to` itself **survives** as a normal Train op (now consumed by `useWeekWorkouts`, `workoutDetailHooks.ts` — [`train.md`](train.md) §4); the weekly-suggestion GET survives too, now read directly by `/me/week`'s `Heti` hub ([`proactive.md` §4](proactive.md)); the Progression `growth-week` GET has **no FE consumer left** (`growthWeekApi.ts` deleted) — see [`growth.md`](growth.md). Real turns now carry the read-tool calls (15 scope-enumerated hub-tools since mezo-xixu: `get_training_log`, `get_training_plan`, `get_weight_trend`, `get_fuel_log`, `get_recovery`, `get_protocol`, `get_goal`, `get_medication`, plus `get_exercise_records`/`get_recipes`/`get_pantry`/`get_growth`/`get_daily_practice`/`get_insights`/`find_similar_past_days` — [`companion.md`](companion.md) §4 catalog); only the MOCK seed's fancier names (`predictAppetiteCurve()`, `recallSharedMemory(theme=…)`) remain demo theater. **Where the rest of the backend plugs in:** rewrite `useInsights`/`useKnowledge` in `data/insights/insightsHooks.ts` (re-exported by the `hooks.ts` barrel) to dual-mode on `isMockMode()` — the chat swap (`chatHooks.ts`) is the worked example — see §7.

---

## 5. Integrations

Insights is the **hub the other tabs point *toward*** and is itself **fed conceptually by a cross-system "pattern engine."** Today these are **mock-level cross-references** (shared copy / shared data module), not live data flows — but they define the contracts Phase 3 must honor.

### 5.1 `useKnowledge` — **ONE view since `mezo-ms9a`** (2026-09-01; it used to be shared across two, before that three)
`useKnowledge()` used to back two views on two tabs — the Mezo-tab `KnowledgeListPage` (facts) and the Én-tab `KnowledgePage` (graph); before that, three (`ProfilePage`, deleted `mezo-d20.6.1`). **`mezo-ms9a` merged the two-page split into `KnowledgeListPage` alone** — `KnowledgePage.tsx` is deleted, `/me/knowledge` redirects into `/mezo/knowledge`. `useKnowledge()` now has a single consumer; the graph-side reads (`useKnowledgeGraphNodes`, `useLifeEventCandidates`, `useGraphEdgeCount`) are called by the SAME page, not a second one.

**The ownership boundary the two-page era fought for is the hard-won part, and it is unchanged by the merge** (`mezo-0ap9`, restated + folded into a single page by `mezo-ms9a`): *„mit kap most a társ"* (facts, the candidate inbox, the on/off toggles, the prompt buckets) and *„hogyan függ össze, amit rólam tud"* (nodes, edges, archiving) are still two separate answers — they just live behind two `?view=` tiles on the same page (`?view=tenyek` / `?view=kategoriak`) instead of two routes on two hubs. **Tény-lista pontosan egy van** — the `?view=kategoriak` (ex-Tudásgráf) chain never re-lists facts, exactly as `KnowledgePage`'s deleted `Kategóriánként` section never should have (§2.4).

**Crossing type:** `KnowledgeFact[]` + `KnowledgeGraphNode[]` + an edge count. Since V1.2 the fact half is real; since W2.6 (`mezo-b3pp.11`) the graph-node half is real; since `mezo-ms9a`'s backend leg the hero's `· K kapcsolat` edge count is real too (`GET /api/companion/graph/edge/count`, §2.4) — the last honest-`[]`/mock-only gap (`edges`) is gone.

### 5.2 Nap → Mezo (a tab, not a link)
**This seam dissolved into the IA.** The path from the day surface into the brain surface was, in order: an `InsightsTeaser.tsx` card on Today (removed by the Napív S3 re-composition, `mezo-8141` — its orphaned `useInsightsTeaser` hook went in S8, `mezo-mifi`), then a bare `<Link to="/insights" aria-label="Insights">` ✨ icon in `BrandRow`, then the same ✨ as an `AppHero` utility (`mezo-k7rn`). **Design 2.0 promoted it to a first-class tab** ([ADR 0032](../decisions/0032-five-tab-ia-dissolved-section-shells.md)): `AppHero` and `TodayPage` are deleted, the ✨ entry with them, and `Mezo` is one tap from anywhere in the bottom `TabBar`. The Nap hub carries its own Mezo-message surface (`/nap/uzenetek`) for the companion's daily prose — a sibling, not a door into this tab ([today.md](today.md)).

### 5.3 `TrendInsight` — the parallel, lighter "insight" type (renderer already gone)
`TrendInsight { type: 'milestone'|'pattern'|'warning'; text }` is a second, lighter insight shape embedded in the **Goals** and **Sleep** aggregates rather than owned here. Its Me-side renderer, `features/me/components/InsightCard.tsx`, was **deleted with the placeholder strip** (`mezo-lfw`) — it was static narrative nothing computed — so the type is currently carried by mock shapes with no view. **The reconciliation is still open, and cheaper than it was:** rich `Pattern` (this tab) vs lightweight `TrendInsight` (embedded) — decide whether to unify or keep two tiers before anything renders the lighter one again.

### 5.4 The cross-system "pattern engine" — the conceptual feeder (most important seam)
Multiple features narrate an off-screen **"pattern engine"** that Insights surfaces, and **reference the same pattern IDs (`P2`/`P3`) by hand in mock copy**:
- **Train** (`data/train/train.ts`): `volumeRecompute.trigger = 'Heti pattern engine batch'` (`train.ts:57`), framing the MEV/MAV/MRV auto-recompute as driven by the same weekly batch that produces Insights patterns. Volume `source.adjustments` carry `{ kind: 'pattern', label, delta }` entries (pattern-derived volume nudges). The Train tab map even has an `Insights` entry (`label: 'Patterns'`, icon `insights`).
- **Sleep** (`data/me/sleep.ts:25-33`): insight rows cite `"P2 pattern"` (`evidence: '8/10 nap megerősítve · P2 pattern'`) and `"Pattern P3 megerősítve"` — the **same IDs** as `insights.ts` patterns `p2`/`p3` (Mg-stack→quality, caffeine→onset).
- **Fuel/Week** (`data/fuel/fuelWeek.ts:55,151,156`): `"Pattern P2 megerősítve"`, `"Pattern P2 megfigyelve"`, and a reasoning tool `get_pattern_correlation(P2)`.
- **Goals** (`data/me/goals.ts:50`): a warning insight cites `"Pattern P2 alapján …"`.
- **In-app notification feed** ([`_platform-notifications.md`](_platform-notifications.md), bd `mezo-gzhp`) — **real, not mock:** the backend `PatternDetectionService` now emits pattern lifecycle events into the platform's in-app notification feed — a new strong pattern crossing the decision-inbox strength gate, a band crossing (|r| moving between the "promising"/"strong" bands) on a still-undecided pattern, and a reinforcement of an already-confirmed pattern — as bell/panel notifications, deep-linking back into `/mezo/patterns/{pairKey}` (the emitted deeplinks predate the rename and ride the `LegacyPathRedirect` where they still say `/insights`), **és F3 óta push-ként is** (`mezo-gzhp.3`) — `AnchorResolver.feedAnchors` picks the same `app_notification` rows up as wake-deferred, id-deduped push anchors under the `pattern` category; see [`_platform-notifications.md` §3b](_platform-notifications.md).

**Takeaway:** Insights/Patterns is the *read surface* of a **cross-domain inference layer** that today exists only as coordinated mock copy referencing shared `P2`/`P3` identifiers. Phase 3 makes the engine real; the patterns/IDs must then be **stable, shared identifiers** across Train/Sleep/Fuel/Goals/Insights — build the pattern engine as a shared service, not an Insights-local feature.

### 5.5 Chat ↔ everything (the tool/ref graph)
`ChatMessage.refs` point at cross-domain entities by `kind` (`Workout`, `PR`, `Pattern`, `SleepLog`, `CheckIn`); the fabricated tool calls read across Train/Sleep/biometrics. This sketches the **Phase-3 RAG retrieval surface** (the companion pulls from every domain). `RefTag` (`frontend/src/shared/ui/RefTag.tsx`) is the **shared rendering** of these cross-feature references; `ToolChipRow`/`ToolChip` render the tool-transparency row.

### 5.6 Shared design primitives
`Icon`, `Eyebrow`, `Toggle`, `RefTag`, `ToolChipRow`/`ToolChip` (UI primitives). **Since Design 2.0 every page here also composes the Mozaik + clay primitives** — `Tile`/`Mosaic`/`PageHero` from `@/shared/ui/mozaik`, `EntranceGroup`/`useCountUp` from `@/shared/ui/mozaik/motion`, and `ClayIcon`/`ClaySpot` from `@/shared/ui/clay` (the breathing orb is `ClaySpot name="s-orb"`, the decision acknowledgement `s-orb-unnepel`) — over the `--mz-*` tokens; **clay SVG replaced emoji as the icon vocabulary**, though the *status glyphs* in this feature's own copy (`🔔`/`✓`/`👁`/`⏳`/`○`/`✕`/`◐`/`◇`/`📈`) are text, not icons, and deliberately stayed. See [ADR 0033](../decisions/0033-mozaik-2-tile-language.md). **Category palette tokens** `--cat-physiology/-preference/-trigger/-response/-tendency/-goal-state` — **since S8 (`mezo-mifi`) these are `var()` aliases re-pointed 1:1 onto the Napív domain accents** (`prototype.css:42–47`: physiology→sky, preference→lav-deep, trigger→amber-deep, response→sage-deep, tendency→rose, goal-state→coral-deep), so `PatternCard`'s `patternCategoryColor(cat)` now renders in-family Napív hues. There is **no separate `--cat-*` dark block any more** — each alias inherits its Napív accent's own light/dark value (see the §3 token cascade in [_platform-design-system.md](_platform-design-system.md)). Insights is the only place all six are exercised. Since the **Napív vocabulary retirement** (`mezo-x3x0`, 2026-07-16) the inline `--ff-mono` numeric readouts across `ChatMessage`/`ChatPage`/`KnowledgeListPage` (the retired `WeeklyPage` carried the same treatment) inherit Jakarta with `font-variant-numeric: tabular-nums` instead — mono now survives only on the `.toolchip` debug/tool chips (which is what `RefTag`/`ToolChip` render).

### 5.7 Feedback chips — an Insights-hosted component that Today also mounts (✅ W4.1, `mezo-b3pp.15`)
`components/FeedbackChips.tsx` lives under `features/insights/` because four of its five surfaces do
— but **Today mounts it too** (`MezoMessagesSheet`, [`today.md` §1](today.md)), which makes it the
**FIRST** Insights component with a cross-feature consumer — there is no prior one. The only
other import that crosses out of `features/insights/` is a HOOK, `logic/useVoiceInput.ts`, taken by
`features/me/sheets/JournalSheet.tsx`; the shared primitives Insights leans on (`RefTag`,
`ToolChipRow`, `Icon`) live in `shared/ui/`, not here, and the Insights-owned `LifecycleSection` is
imported only by Insights pages (`PatternsPage`, `PatternDetailPage`, `KnowledgeListPage`).
`FeedbackChips` is therefore a genuinely new shape for this feature: a component another feature's
screen mounts. If a third consumer ever appears, that is the signal to promote it to `shared/ui/`
rather than deepen the dependency.
It is **purely presentational and controlled**: `{ value, onVote, label }`, no hook of its own.
- **The hook is page-level, never per-card.** `useFeedback(kind, ids)`
  (`data/feedback/feedbackHooks.ts`, exported through the `@/data/hooks` barrel) is called ONCE per
  page with every artifact id that page renders, and hands back `{get, vote, pending}` so the cards
  stay dumb. A hook inside each chip would issue one HTTP request per card — 20+ on ChatPage.
- **Toggle semantics live in the hook, not the UI.** `vote(id, verdict)` on the verdict already
  stored is a **retraction** (DELETE); anything else is an upsert (PUT). A tap that carries a reason
  is always an upsert, which is how the user changes their mind about WHY. `FeedbackChips` only
  decides *when* to call `onVote` and with what: 👍 always votes `up`; 👎 opens the four-chip reason
  row instead of voting when not already down, and retracts when it is.
- **The reason row is DERIVED from the verdict, never seeded on mount** (fixed in the W4.1 final
  review). It renders when the value is `down` — OR when this session's 👎 opened it on a card with
  no verdict yet. Seeding `useState(value?.verdict === 'down')` was a real bug: real mode serves
  `useDualQuery`'s `realEmpty` until the batch GET resolves, so `value` is `undefined` at mount on
  every cold load, and with the instance keyed by artifact id nothing ever remounts it — a stored
  `down` could never show its reason row, and the 👎 re-tap retracted instead of offering the
  reasons. Deriving it also makes the render independent of query-cache warmth (the seeded version
  drew two different UIs for the same artifact). It follows that picking a reason does NOT close
  the row (the card is now `down`, so the row belongs on screen with that reason selected), and
  that the retraction closes it by clearing the verdict. 👍 clears the session flag as well as
  voting — otherwise an `up` card that a 👎 opened earlier in the session would keep the four
  NEGATIVE reason chips on screen under a positive verdict.
- **Copy:** 👍 `Segített` / 👎 `Nem talált`, reasons `pontatlan` · `túl sok` · `rossz időzítés` ·
  `nem rólam szól`; the group's accessible name is `Visszajelzés {label}` (`a válaszról`,
  `a heti memoárról`, `a heti tervjavaslatról`, `az előrejelzésről`, `az üzenetről`).
- **Crossing contract:** `(FeedbackArtifactKind, artifactId)` over the companion-owned
  `/api/companion/feedback` — see [`companion.md` §4/§5.7](companion.md). Insights owns no table or
  endpoint here, exactly as with Weekly/Memoir/Predictions/Memory.
- **`useDualQuery` gained one optional flag for this** — `keepPreviousRealData`, real-mode-only,
  default OFF, so a page that grows by one card does not blank the chips already on screen.
  `useFeedback` is its only consumer. **Full contract, rationale and the `isPending` caveat live in
  [`_platform-data-layer.md` §4](_platform-data-layer.md)** — that doc owns `useDualQuery`; don't
  restate it here.

---

## 6. How to use it (consume)

Import the three hooks from the boundary — **never** from `@/data/insights/insights` directly (except the stateless helpers below):

```ts
import { useInsights, useKnowledge, useChat, useMemoir } from '@/data/hooks'

const { patterns, recentlyConfirmed, predictions, experiments } = useInsights()  // memoir/anniversaryNote fields dead since W2
const { facts, edges, activeCount } = useKnowledge()
const { initialChat } = useChat()

// The weekly review moved to /me/week — see me.md §6 (`useMeWeek`); there is no
// Insights-side `useWeekly` any more (retired `mezo-p2tr`).

// Memoir (W2) — dual-mode; memoir is null in real mode on 404 (render the honest „készül" state),
// anniversaryNote is mock-only (always null in live mode).
const { memoir, anniversaryNote, mode } = useMemoir()
```

Two pure helpers may be imported straight from the data module (stateless constants/utils, not data): `MIN_PATTERN_CONFIDENCE` and `patternCategoryColor` from `@/data/insights/insights`; `factCategoryColor` and `FACT_CATEGORIES` from `@/data/insights/knowledge`.

Today these return **synchronous static data** (safe to read in render with no loading/null guard). **When Phase 3 lands they may become async** — write new consumers defensively now (ghost-guard for null), matching the real-mode convention used by biometrics/Train. To add a surface, register a **flat `/mezo/*` route** in `router.tsx` and give the page its own head — there is no sub-tab array and no outlet to mount under any more (§2's seam box).

---

## 7. How to extend it

### 7.1 Add a sub-tab or field while still mock-only (cheap)
1. Add/extend the type in `frontend/src/data/types.ts` (Insights/Knowledge region).
2. Add mock instances in `data/insights/insights.ts` (or `knowledge.ts`/`chat.ts`).
3. Surface via the relevant hook in `hooks.ts` — **keep the returned object's shape stable** so the Phase-3 swap stays mechanical.
4. New surface: a **flat `/mezo/<path>` route** in `router.tsx` + a view in `pages/` that brings its own head/padding (§2's seam box) + a `Tile` on `MezoHubPage`'s mosaic whose bottom line reads that page's own hook and is **absent** while unresolved. There is no `INSIGHTS_TABS` to extend — `tabs.ts` is deleted.
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
- **Views:** `pages/{PatternsPage,MemoirPage,KnowledgeListPage,ChatPage,PredictionsPage,ExperimentsPage}.test.tsx`, plus `components/PatternDecisionCard.test.tsx` (the decision-inbox card, `mezo-tk88.4`). `MemoirPage.test.tsx` gained a **`(real mode)` describe** (since **W2**): with an MSW memoir fixture it renders the real title/body/anchors and does NOT render anniversary/archive; on the default 404 it renders the honest „készül" placeholder, not the demo fiction. **Since W4.1** the same file asserts the Phase-1 reaction row is gone in BOTH modes and the feedback chips are present in both (including real mode — that asymmetry was the `mezo-kr9v` bug), and that the 404 placeholder carries no chips (no artifact ⇒ nothing to vote on). **`WeeklyPage.test.tsx` was deleted with the tab (`mezo-p2tr`)** — its coverage (score hero, „tanulom" null-state, live suggestion prose w/o the inert buttons) moved to the `Heti` hub's own test files under `features/me/pages/` ([`me.md`](me.md) §2/§9 has the current per-page test map); `frontend/src/app/router.weeklyRedirect.test.tsx` (mock mode) pins the weekly path landing on `/me/week`'s `Heti` hub instead of a 404 or the retired tab — since `mezo-d20.1.1` that is a **two-hop** resolution for the legacy URL (`/insights/weekly` → `/mezo/weekly` → `/me/week`), which is exactly what makes the test worth keeping.
- **Weekly hook — RETIRED (`mezo-p2tr`):** `data/insights/weeklyHooks.test.tsx` is now a single `isoWeekNumber` unit test; its former real-mode composition/null-state cases moved with the review to `me.md`'s test surface. `components/GrowthWeekCard.test.tsx` is **deleted** along with the component.
- **Feedback (W4.1, `mezo-b3pp.15`) — both modes:** `data/feedback/feedbackHooks.test.tsx` pins the
  semantics the UI leans on — mock's honest-empty seed, vote/re-tap-retract/other-verdict-overwrite,
  **a different reason updates while re-picking the SAME reason keeps the vote** (only a bare re-tap
  retracts), mock votes surviving a change of the rendered id set, mock making no network call at
  all; and real mode's comma-joined batch read, the optimistic write shown before the response
  resolves, DELETE on re-tap, **a growing id set never blanking the chips already on screen**
  (the `keepPreviousRealData` case, §5.7), rollback on a failed vote, the `FEEDBACK_MAX_IDS`
  (1000, `mezo-b3pp.23`) cap keeping the NEWEST ids (`still bounds the request at FEEDBACK_MAX_IDS,
  keeping the NEWEST (last) ids`), no request at all on an empty id set, and a failing read
  degrading to "no verdicts"
  instead of throwing (IDENT-3). `components/FeedbackChips.test.tsx` (11) covers the component's own
  branches: 👎 reveals the reason row without voting, picking a reason votes and leaves the row up
  with that reason selected, 👎 while already down retracts (and the row goes when the verdict
  does), the stored reason renders selected, **a `down` verdict ARRIVING after mount opens the row**
  — the production path, `value={undefined}` first, then a rerender, since the seeded version made
  a stored `down` unreachable — **and a different reason picked on it upserts rather than
  retracting**, **👍 after a 👎+reason clearing the row** (no negative reason chips under an `up`
  verdict — the session flag has to be cleared by 👍, not only by the verdict leaving `down`),
  plus `aria-pressed` and the group's accessible name. Per-surface cases: `ChatPage.test.tsx` (chips on the two assistant answers only;
  **the in-flight draft carries none until `done` lands** — a gated-stream test; a 👎+reason writes
  only that answer, and the reason row is per-card), `MemoirPage.test.tsx` (the retired Like/Love/
  Save/Dismiss row is asserted GONE and the chips render in **real** mode too — the `mezo-kr9v`
  regression anchor; `WeeklyPage.test.tsx` carried the same coverage before it was retired,
  `mezo-p2tr` — moved with the `Heti` hub to `features/me/pages/` ([`me.md`](me.md))), `PredictionsPage.test.tsx` (one row per card; a
  👎+reason writes only that prediction). MSW gained default handlers for all three feedback ops.
- **Memoir hook (dual-mode, W2):** `data/insights/memoirHooks.test.tsx` (3) — real mode maps the server memoir with a derived `Hét N …` week label (anniversaryNote null, mode live); returns null memoir on the default 404; mock returns the seed + anniversaryNote without fetching (MSW `/api/proactive/memoir` defaults to 404).
- **`ChatPage.test` gotchas** (documented in-file): `userEvent.type` deadlocks under `vi.useFakeTimers()`, so the test uses `fireEvent.change` + `fireEvent.keyDown` and `vi.advanceTimersByTime(1300)` to exercise the 1200 ms canned-reply timer; and since `mezo-at8x.3` the page reads `?c=` so `renderPage()` wraps it in a `MemoryRouter` (which also lets a test open a thread directly: `renderPage('/insights/chat?c=new')`). The `mezo-at8x` cases: markdown renders as blocks with no `**` left in the text, "Új beszélgetés" empties the thread, a draft thread POSTs `/conversation` on the first send, the picker lists the persisted titles, and — since jsdom implements neither — `Element.prototype.scrollIntoView` is stubbed to assert the page parks on the newest message.
- **Chat plumbing (`mezo-at8x`):** `shared/lib/markdown.test.tsx` (11 — inline set, snake_case left alone, no HTML injection, each block kind), `features/insights/logic/useVoiceInput.test.tsx` (3 — record→transcribe→callback, denied mic, unsupported browser; a `FakeMediaRecorder` + stubbed `navigator.mediaDevices` stand in for what jsdom lacks), and the multipart case in `data/insights/chatApi.test.ts` (the request must go out as `multipart/form-data`, not JSON).
- **Nav/shell (rewritten `mezo-d20.5.1`):** `insights.nav.test.tsx` now mounts the **real `routes` array** in a `MemoryRouter` and drives the new IA end-to-end — the hub's tiles reach `Minták`/`Memoár`/`Előrejelzések`/`Kísérletek` as full pages (real mode, landing on their honest null-states), mock mode reaches the Memoár demo, and **the legacy `/insights/*` paths redirect into `/mezo/*` with the subpath preserved**. `InsightsSubNav.test.tsx` and `shared/ui/SubNavDropdown.test.tsx` are deleted with their components. `app/TabBar.test.tsx` now asserts the **five** tabs (`Nap`/`Edzés`/`Fuel`/`Mezo`/`Én`) — the exact inverse of the old assertion that there was no Insights tab — plus the floating quick-log FAB; `app/hubHeaders.test.tsx` now pins the ONE shared `.nap-head` the shell's `AppHeader` renders on every tab-root and sub-page (rewritten again for `mezo-atry`, having previously pinned the five hubs' near-identical own-copies of the recipe); `app/navigation.test.tsx` no longer looks for a ✨ entry link, and the `appHeroMount` test is gone with `AppHero`.
- **No ghost pages remain (since P2):** every page test now has a `(mock mode)` + `(real mode)` describe asserting real data / the honest null-state — no test asserts a `hamarosan` teaser any more. `ExperimentsPage.test.tsx` real-mode: an MSW proposed row renders `◇ Javaslat` + Elfogadom/Elvetem and clicking Elfogadom POSTs the decision; the default empty array shows the still-learning null-state. `experimentsHooks.test.tsx` mirrors the P1 `predictionsHooks.test.tsx` idiom (maps a wire row, `[]` default, mock no-fetch). Mode is set per-describe with `vi.stubEnv('VITE_USE_MOCK', …)`.
- **`MotorPage.test.tsx` is DELETED with the page (`mezo-tk88.4`)** — its scenarios live on now as
  `PatternsPage.test.tsx` cases instead: `(mock mode)` — the hero sentence/tiles/lifecycle-section
  buttons render off the seeds, only the selected bucket is visible, decide cards show the pair-backed question (falling back to
  the pattern's own title when unmatched), confirming a decide card moves it into „Megerősítve" (an
  end-to-end `usePatternActions().decide()` exercise), „Adat-egészség" expands to the coverage rings
  **thinnest-first** (proving the page's own `metrics.sort`, not an already-sorted fixture — the
  Motor-era assertion, ported), the filter sheet applies one icon-based domain without changing
  motor counts, the gathering bucket paginates five-at-a-time and resets to page one on filter/state
  changes, pairless persisted rows still link to detail, and the `?pair=` param **redirects** to
  `/mezo/patterns/:pairKey` (stubbed locally in this test file — the real page now lives at
  §2.1b, `PatternDetailPage.tsx`) instead of highlighting a row in
  place; `(real mode)` — MSW stubs BOTH `/api/companion/pattern` and `/api/companion/pattern/monitor`
  to compose the dashboard from two live reads, raw `r=…` is asserted absent from the decision card,
  a 404 on **both** endpoints renders the degraded card **with no Motor link**, a legitimately empty
  (non-404) pair on both endpoints keeps the honest „Még nincs felismert minta…" copy (link removed
  too), and a non-404 monitor failure still renders the honest retry card the old `MotorPage.test.tsx`
  proved (`isError`/`refetch`, review fix wave `mezo-viqs`, unchanged). **`domains.test.ts`** still
  covers `groupPairsByDomain` pure (the module survives the retirement, §2.8).
- **The Mezo hub (`mezo-d20.5.1`):** `pages/MezoHubPage.test.tsx` — the orb hero's name/companion sentence/honest status line, the composer-shaped opener navigating to `/mezo/chat`, the decision card carrying the strongest decide-bucket question **in human words only** (raw `r`/`p` asserted absent), deciding flipping it to the sage acknowledgement **through the same mutation `PatternsPage` uses**, the six tile lines coming from the pages' own hooks, every tile navigating to its full-page sibling (with `Heti` crossing out to `/me/week`), **plus the wide `Karakter` tile** (hub-tile-reorg, `mezo-o486` — the `isDossierEmpty`-gated maturity line, navigation to `/me/karakter`), the memory band's real L0→L3 counts opening `/mezo/memoria`, and a real-mode describe over MSW fixtures asserting the live status line and **no fabricated zeros during the unresolved window** — the `mezo-yew`/`mezo-0xl` bug class, now guarded on the hub as well as the pages.
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
  reach the DOM); pair 404 + persisted hypothesis renders the honest artifact fallback without
  charts/diagnostics, while a key missing from both reads renders not-found. Both header assertions target the `DetailFrame`
  back row (`link name="Vissza"` + `heading "Minta részletei"`). `logic/metricFormat.test.ts` —
  pure: clock folding (incl. the bedtime `+24` shift and the `:60` minute carry), binary mapping,
  decimal trimming, axis-end labels, and the `formatR`/`formatP` precision rules.
  `PatternDecisionCard.test.tsx` is unchanged by the new optional
  `titleSize` prop (default `17`, unused by its existing assertions).

**Commands** (run from `frontend/`):
```bash
pnpm test                         # vitest run (REAL mode default)
VITE_USE_MOCK=true pnpm test      # mock mode — both must be green
pnpm build                        # tsc -b && vite build
```
When Phase 3 makes the hooks real, add backend ITs (`AbstractIntegrationTest`/`ApiIntegrationTest` + Postgres + populators) and MSW handlers for the real-mode FE path, then keep **both** FE modes green.

---

## 9. Decisions, gotchas & deferred

- **Mock-only, intentionally** — Insights is the Phase-3 brain surface; the FE↔data boundary (`hooks.ts`) is pre-built for a mechanical real-mode swap, matching biometrics/Train.
- **Two roadmap stages, do not conflate:** (a) Phase-2 Insights work is now **D′** (deterministic Weekly + honest surface, `mezo-t16y.1` — the old seed-only Slice D was dropped as superseded on 2026-07-04); (b) Phase-3 = the actual AI (Spring AI/pgvector/RAG) — ✅ shipped (`mezo-fnnq`, see `companion.md`).
- **The last unpersisted "feedback" affordance is gone (W4.1, `mezo-b3pp.15` — closes `mezo-kr9v`).** Knowledge Toggle + candidate decisions + pattern decisions went real at V1.2/V3.1; the memoir's Like/Love/Save/Dismiss row was the survivor — mock-only, unpersisted, and (after W2 hid it in live mode) an affordance the real app never offered at all. It is **deleted**, replaced by the real `FeedbackChips` row that renders in BOTH modes and writes to `message_feedback` (§2.3/§5.7). Every validation/feedback loop this doc used to list as "to wire to the backend" is now wired.
- **Feedback chips: page-level hook, controlled component, retract-on-re-tap (W4.1).** The three decisions worth not re-litigating: (a) `useFeedback` is called ONCE PER PAGE with all of that page's ids — a per-card hook means one HTTP request per card; (b) `FeedbackChips` is presentational (`value`/`onVote`), so the toggle semantics have exactly one home; (c) re-tapping the stored verdict RETRACTS it, but a tap carrying a reason always upserts — otherwise confirming the reason already shown would silently delete the vote. Full rationale + the backend semantics: [`companion.md` §9](companion.md).
- **Chips only where there is a persisted artifact.** No chips on the in-flight chat draft (no id until `done`), on user bubbles, or on the honest null-state cards (no memoir / no suggestion / empty prediction list). Today's demo-briefing card and needs-nudges are the same rule on the other side of the seam ([`today.md` §9](today.md)). A chip on a non-artifact would be the exact false affordance `mezo-kr9v` was filed about — do not "helpfully" add one.
- **Chat is fully faked:** `setTimeout` + keyword branch on `"fáradt"`; `"Gemini 3.1 Pro"`, `"23 facts active"`, `"L4 aktív"`, `"60-day acc 68%"` are **hard-coded strings**, not derived. The named tool calls are illustrative, not real endpoints.
- **Two overlapping "insight" types:** rich `Pattern` (Insights tab) vs lightweight `TrendInsight` (`InsightCard`, embedded in Goals/Sleep, `types.ts:157-158`). And **two category enums** that overlap but differ: `PatternCategory` (`physiology|trigger|response`) vs `FactCategory` (`physiology|preference|trigger|tendency|goal_state`). Phase 3 must decide whether to unify.
- **`MIN_PATTERN_CONFIDENCE = 0.65`** is a hard-coded FE constant — should become backend config (`configuration_conventions.md`) when the engine is real.
- **Weekly's Insights tab is RETIRED (`mezo-p2tr`), superseding its earlier "real by client-side composition" design (D′ `mezo-t16y.1` + W1 `mezo-h4wp.3`).** The old `useWeekly` composed the review (score + items) from existing fuel/train/biometrics reads with a **documented deterministic score formula** (`SLEEP_TARGET_H`/`KCAL_BAND`/`WEIGHT_RATE_EPSILON` constants — never promoted to backend config, per the deferred note this entry used to carry). That whole design is gone: `/me/week` now reads a **backend-computed** score off `GET /api/me/week/{start}` instead ([`me.md`](me.md) for the current hub + view-pages), and `/insights/weekly` is an honest redirect. The weekly tervjavaslat prose (proactive-owned, `GET /api/proactive/weekly-suggestion`) is unaffected — the `Heti` hub reads it directly rather than through the retired hook.
- **`useKnowledge` is shared across Insights + Me tabs** (§5.1) — co-design any knowledge backend for both.
- **Cross-domain pattern IDs** (`P2`/`P3`) are referenced as mock copy in Sleep/Fuel/Train/Goals — making them real requires a shared pattern-engine service with stable IDs (§5.4).
- **Inert affordances:** the Weekly "Elfogad/Hangoljuk" pair and the **"Memoir archive →" footer + anniversary card** (still handler-less/unpersisted — but since **W1/W2** they are **hidden in live mode** `mode !== 'mock'`, shown only over the mock seed; false-affordance rule). The "+ Új kísérlet javasol Mezo" button really proposes since P2, the mic button is live since `mezo-at8x.4`, and the **memoir reactions were deleted at W4.1** (the bullet above) — this list is down to two.
- **Honest surface (mezo-t16y.1 · W2 · P1 · P2 — now COMPLETE):** the Phase-3+ demo tabs were hidden from the sub-nav (`visibleInsightsTabs()` filtering `PHASE3_TAB_IDS`) until each got real data — Memoir at W2, Predictions at P1, **Experiments at P2**. `PHASE3_TAB_IDS` is now **empty**: no tab is hidden, no `PhaseTeaserCard` ghost is reachable, every tab renders real data or an honest null-state. The un-ghost recipe (drop the `PHASE3_TAB_IDS` entry, remove the page guard, render real + honest null-state, keep unpersisted extras mock-only) is preserved in the git history of the four un-ghost commits should a future Phase-gated tab need it.

### Design 2.0 / Mozaik 2.0 (`mezo-d20`, 2026-08-29)

- **The section became a tab, and the tab got the section's data model unchanged — [ADR 0032](../decisions/0032-five-tab-ia-dissolved-section-shells.md).** `Insights` → **`Mezo`**, `/insights/*` → `/mezo/*`, the ✨ icon in another tab's header → a first-class `TabBar` entry, `InsightsSection` + `tabs.ts` + `AppHero` + `SubNavDropdown` → deleted, sub-tabs → full-page siblings. Every hook, endpoint, bucketing rule and honesty gate came through untouched. **Do not read the rename as a re-architecture** — the feature directory is still `features/insights/`, the data directory still `data/insights/`, and this doc is still the one that owns them; only the user-facing name and the URL prefix moved.
- **The header seam rule inverted.** Stated in full in §2's boxed note, and repeated here because it is the single most likely thing for a future session to get backwards: a page under `/mezo/*` **must bring its own head**. The old rule — leaf views render no header, the shell's dropdown chip says where you are — is dead with the shell.
- **The visual language is the tile mosaic — [ADR 0033](../decisions/0033-mozaik-2-tile-language.md), superseding ADR 0026.** Clay SVG replaced emoji as the icon vocabulary; the lifecycle states, prediction statuses and experiment statuses became **washed tiles** whose colour carries the state. On the Minták catalogue the lifecycle controls and headings use `Icon`/`ClayIcon` consistently; emoji no longer carries domain or status meaning there.
- **Two localizations rode in with the re-face and are DESIGNED fixes, not data changes.** `PredictionsPage`'s status chips shipped English off the wire (`✓ Validated` / `✗ Missed` / `◐ Pending`) and its accuracy header with them — the view now localizes both. `ExperimentsPage`'s dismissed branch gained the label it was missing (audit §6). The wire is unchanged in both cases; if a future slice makes the backend emit Hungarian, delete the view-side mapping rather than doubling it.
- **The hub shows ONE decision, not the inbox.** `MezoHubPage` renders `decide[0]` only, over the shared `usePatternActions().decide` mutation, and states the bucket size in its eyebrow (`Döntésre vár · N`). The full inbox stays on `/mezo/patterns`. A hub that carried the whole inbox would have made the Minták tile a duplicate of the page above it.
- **The orb hero carries no number, deliberately.** One companion sentence and a quiet status line — and the sentence prefers a feed row with a real `artifactId`, falling back to the labelled demo briefing **only in mock mode**. A live user never sees demo prose presented as the companion's live voice; that rule is inherited verbatim from `MezoChip` and is the reason the hero looks emptier in live mode than in the prototype.
- **Tile lines are absent, not zero, while unresolved** — and where a page owns an honest word for "not yet", the tile borrows it (`Heti`/`Előrejelzések`/`Kísérletek` read **„tanulom"**) rather than inventing one. The memory band drops its four counts entirely with no `overview`.

**Deferred / known gaps after Design 2.0** (recorded honestly, not fixed):

- **No page under `/mezo/*` has a back affordance except `PatternDetailPage`.** None mounts `PageHead`, so the `‹ vissza` chip the Nap/Én/Fuel siblings carry is missing across the whole tab; the tab bar and browser back are the only way up from Minták, Memoár, Tudástár, Chat, Előrejelzések, Kísérletek and Memória. On a hub-and-siblings IA this is the most visible unfinished edge in the tab.
- **`components/MotorStateHero.tsx` is orphaned** — `PatternsPage` inlined its own hero + lifecycle grid in the `mezo-d20.5.3` re-face and no longer imports it, and nothing else does. `components/MetricCoverageRing.tsx` is half-orphaned in the same way: only its exported `lastSeenLabel` helper is still imported, the ring markup having moved into the page. Both files survive with their behaviour documented above; deleting them means moving `lastSeenLabel` somewhere and dropping their tests, which was left for a deliberate pass. ([me.md §9](me.md) records four Me-side components in the same state.)
- **The Memória ↔ Minták cross-link is still one-way and still goes through a redirect.** `MemoryPage`/`MemoryLayersPanel` link to `/mezo/motor`, which `<Navigate>`s to `/mezo/patterns`; Design 2.0 repointed the prefix but did not shorten the hop or add the reverse link the retired `MotorPage` used to carry (the pre-existing note above §3 covers the reverse-link half).
- **RESOLVED — `Heti`'s designed destination has landed.** This bullet used to track the tile as IN FLIGHT: shipping to a working `/me/week` page (`mezo-p2tr`) while the Design 2.0-specified **Heti hub + four view-pages + a day page**, plus its two backend legs (weekly knowledge candidates, a persisted weekly score + trend endpoint), were still being built on a separate machine under [`docs/design_2.0/2026-08-28-heti-implementation-handoff.md`](../design_2.0/2026-08-28-heti-implementation-handoff.md). That work is done: `mezo-d20.6.10` split `/me/week` into `WeekHubPage`/`WeekAnalysisPage`/`WeekDaysPage`/`WeekLessonsPage`/`WeekDiscoveriesPage` + the pre-existing `WeekDayPage`, and the trend endpoint + `weekly_score` cache landed as `mezo-d20.7.5`–`.7.8` ([`me.md`](me.md) §2 has the per-page breakdown). One loose end: `WeekHubPage`'s 8-week score-trend spark is still wired to a hardcoded empty array in the FE even though the backend trend endpoint it would read is live — the spark never renders in this build.
- **`useInsights` is still dead code** — no live consumer since `PatternsPage` moved to `usePatterns`; the re-face did not remove it (§3).


---

## 10. Key files

**Feature (`frontend/src/features/insights/`):** — the directory keeps its `insights` name; the tab is called `Mezo` (§2)
- `pages/MezoHubPage.tsx` — **`mezo-d20.5.1`, the `/mezo` index and the tab's face:** the shell's `AppHeader` (own header since `mezo-atry`) → the numberless breathing orb hero (`ClaySpot s-orb` + one companion sentence + the honest status line) → the composer-shaped chat opener → the motor's **single** gold-ringed decision card over the shared `usePatternActions().decide` → the 6-tile `Mosaic` with per-page live lines → **the wide `Karakter` tile** (hub-tile-reorg, `mezo-o486` — moved from `EnHubPage.tsx`, `useCharacterOverview()` + line derivation moved with it) → the full-width L0→L3 memory band. Reads the pages' own hooks; owns no data (§2.0)
- **`InsightsSection.tsx` and `pages/tabs.ts` are DELETED (`mezo-d20.5.1`)** — the shell, `INSIGHTS_TABS`, `visibleInsightsTabs()` and the (already-empty) `PHASE3_TAB_IDS` are gone, along with the app-wide `features/progression/components/AppHero.tsx` and `shared/ui/SubNavDropdown.tsx` they depended on. `InsightsSubNav.tsx` had already been superseded by the dropdown in `mezo-ugqb`; `components/PhaseTeaserCard.tsx` by the empty gate set in `mezo-mifi`
- `frontend/src/shared/ui/mozaik/{index.tsx,motion.tsx}` + `frontend/src/shared/ui/clay/index.tsx` — the primitives the re-faced pages compose (`Tile`/`Mosaic`/`PageHero`; `EntranceGroup`/`useCountUp`; `ClayIcon`/`ClaySpot`). **Not Insights-owned** — [`_platform-design-system.md`](_platform-design-system.md)
- `pages/PatternsPage.tsx` — lifecycle catalogue (§2.1): hero + clickable 3×2 status selector + one active bucket + `PatternFilterSheet` + five-item pager + „Adat-egészség" coverage strip; owns selection/filter/sort/page state, while `patternCatalog.ts` owns pure derivations
- `pages/PatternDetailPage.tsx` — dual-source detail leaf (§2.1b, `/mezo/patterns/:pairKey`): rich pair-backed evidence/history flow when `usePatternPairDetail` succeeds; `PatternArtifactDetail` when only `usePatterns` resolves the key; honest retry/not-found states otherwise
- `components/PatternArtifactDetail.tsx` — pairless persisted-pattern fallback: proposed rows reuse `PatternDecisionCard`; judged rows show a read-only status hero, saved mechanism/evidence and no fabricated graph/statistics
- `components/PatternFilterSheet.tsx` + `PatternDomainMark.tsx` — house `Sheet` filter/sort controls and the shared Clay domain mark; no emoji domain controls
- `logic/patternCatalog.ts` — initial bucket, pairless `other` domain, filter/sort and five-item clamped pagination; pure and unit-tested
- `pages/MemoirPage.tsx · KnowledgeListPage.tsx · ChatPage.tsx · PredictionsPage.tsx · ExperimentsPage.tsx` — the other 5 content sub-tabs, **all real dual-mode** (Memoir W2, Predictions P1, Experiments P2 — each with an honest null-state; ExperimentsPage adds the L2 accept/dismiss + propose write actions)
- **`KnowledgeListPage.tsx`'s `mezo-ms9a` view components (`components/{FactsView,KnowledgeBaseView,KategoriakView,ProfileView,HowItWorksView}.tsx`, §2.4):** `KnowledgeBaseView` = the base-view approval inbox + 3-tile section mosaic; `FactsView` = the `?view=tenyek` search/chip/bucket body (the old page's fact half, unchanged); `KategoriakView` = the `?view=kategoriak` grid⇄drill switch, thin over the moved `KindTileGrid`/`KindNodeList` below; `ProfileView` = the `?view=profil` "Így beszélj velem" card + explainer, thin over the moved `ProfileNodeCard`; `HowItWorksView` = the `?view=hogyan` six Q&A cards (the deleted `KnowledgeExplainer`'s content, copied verbatim + one new block)
- **Moved from `features/me/` (`mezo-ms9a`, was the `KnowledgePage.tsx` overview-first Tudásgráf chain, `mezo-2243` originally — full behavioral history in the pre-merge [`me.md`](me.md) git blame):** `components/{KindTileGrid,KindNodeList,CategoryHeader,ProfileNodeCard}.tsx` + `sheets/NodeDetailSheet.tsx`. Unchanged by the move except their consumer: `KnowledgeListPage`'s `selectedId` state now owns the sheet (was `KnowledgePage`'s), and `KategoriakView`/`ProfileView` above call them instead of the deleted page rendering them directly.
- **`pages/MotorPage.tsx` is DELETED (`mezo-tk88.4`)** — the 8th sub-tab (`mezo-viqs`, redesigned `mezo-18bx`) is retired; its diagnostics folded into `PatternsPage.tsx` above (§2.8 carries the full retirement note + what did/didn't carry over)
- **`pages/WeeklyPage.tsx` is DELETED (`mezo-p2tr`)** — the 2nd sub-tab (D′ `mezo-t16y.1`) is retired; its content (score hero, growth card, tervjavaslat) moved verbatim to `/me/week` (§2.2), later split by `mezo-d20.6.10` into the `Heti` hub + view-pages ([`me.md`](me.md))
- `pages/MemoryPage.tsx` — **`mezo-al1i`**, the 9th sub-tab (now the 8th): read-only memory-pipeline observatory (§2.9), 4 page-local segments (`useStickyTab('insights.memoria.view')`) over `useMemoryOverview`/`useMemorySummaries`, one page-level degraded card (companion 404) + per-panel `GhostState`/degraded lines in Kereső/Audit, shown in both modes
- `components/Memory{LayerCard,LayersPanel,JournalPanel,SearchPanel,AuditPanel}.tsx` — **`mezo-al1i`**: the L0→L3 wash-tinted layer cards + cron-labelled pulsing `FlowConnector`s (Áttekintés), the memoir-styled journal cards with month separators + embed dot + `focusDate` scroll (Napló), the lazy-submit search form (Kereső), and the two-block cost-hero/provenance panel (Audit) — §2.9 has the full per-panel breakdown
- `components/SimilarDayCard.tsx` — **`mezo-al1i`** the Kereső result card: similarity ring + bar + the `egyezés × frissesség = végső` three-chip score row (freshness recovered client-side as `finalScore/similarity`); `onPick(date)` jumps the page to Napló focused on that day
- `components/TokenColumns.tsx` — **`mezo-al1i`** the Audit panel's small stacked SVG bar chart (`--dv-lav` input / `--dv-sage` output tokens per day)
- `data/insights/experimentsApi.ts` + `experimentsHooks.ts` — **P2** the Experiments consumer (`useExperiments()` → `GET /api/proactive/experiment`; `useExperimentActions()` → the decision/propose mutations)
- `data/insights/predictionsApi.ts` + `predictionsHooks.ts` — **P1** the Predictions consumer (`usePredictions()` → `GET /api/proactive/prediction`, list; `[]`→still-learning null-state)
- **`components/PatternCard.tsx` is DELETED (`mezo-tk88.4`)** — superseded by `PatternDecisionCard.tsx` below (the flat-inbox card had no lifecycle awareness; `highlighted`/`?pair=` scroll-and-ring is gone too, replaced by the `?pair=` → detail-route redirect, §2.1)
- `components/MotorStateHero.tsx` — **`mezo-tk88.4`**, the dashboard hero (§2.1 step 1): question count + confirmed/decide prose, the six `BUCKET_ORDER` tiles, the domain-chip filter row (`onToggleDomain`, the „Mind" chip's same-batch multi-toggle) — pure props, `bucketize()`'s counts computed by the caller
- `components/PatternDecisionCard.tsx` — **`mezo-tk88.4`**, the dashboard decision-inbox card (§2.1 step 2): category/confidence chips, the deterministic `findingSentence` block (never raw `r/p/n`), optional decision explainer, Confirm/Monitor/Reject and the detail link. Since `mezo-0469` the detail page no longer reuses this inbox-shaped card; its state-table hero is separate below.
- `components/LifecycleSection.tsx` — **`mezo-tk88.4`**, dashboard-only `LifecycleSection` (collapsible title+count card) + `LifecycleMiniRow` (title + one-line sub + detail link) for the five buckets and „Adat-egészség”. The detail page's former mismatched diagnostics reuse ended in `mezo-0469`.
- `components/PatternDetailHero.tsx` (+ test) — **`mezo-0469`**, the detail state table and deterministic question/conclusion split; it is the sole owner of group-progress rendering and detail-page CTA eligibility.
- `components/PatternEvidenceChart.tsx` (+ test) — **`mezo-0469`**, value-kind-adaptive binary/numeric SVG evidence chart with real ticks, conditional medians/trend and accessible latest-point ring; replaces the deleted `PatternScatter`.
- `components/PatternStrengthChart.tsx` — **`mezo-tk88.5`** (Task 12), the strength-over-time hand-drawn SVG (§2.1b step 2): |r| per snapshot off `strengthSeries`, dashed „érezhető"/„határozott" guide lines, the confirm point picked out in accent; `null` under 2 points (the page renders the text fallback instead)
- **`components/PatternScatter.tsx` is DELETED (`mezo-0469`)** — its key-agnostic chart made binary groups visually misleading; `PatternEvidenceChart` is the replacement.
- `logic/metricFormat.ts` — **`mezo-fy97`**, human-readable rendering of the engine's raw wire doubles: `formatMetricValue` (hour-kind → `HH:mm`, binary → `igen`/`nem`, else one decimal; key sets mirror the backend `MetricKey` extractors), `axisEndLabels` (scatter x-ends), `formatR`/`formatP` (diagnostics precision) — pure, unit-tested in `metricFormat.test.ts`
- `components/PatternJournal.tsx` — **`mezo-tk88.5`**, the history timeline (§2.1b step 4): a left rail + one tone-colored dot per `journalEntries()` row, entry text through `SafeMarkdown` (bold-only inline renderer), a `→ a Tudástárban` link on a promoted `confirmed` entry
- `components/PatternImpactCard.tsx` — **`mezo-tk88.5`**, „Mit kezd ezzel az app" (§2.1b step 5): the fact/predictions/experiments/challenges rows (only when `pattern.status === 'confirmed'`, each row omitted if its ref list is empty) or the single future-tense fallback row otherwise
- `components/FeedbackChips.tsx` (+ test) — **W4.1 `mezo-b3pp.15`**, the shared 👍/👎 row: `{value, onVote, label}`, purely presentational (the toggle semantics live in `useFeedback`), the four-chip reason row shown whenever the verdict is `down` — no tap needed — and opened by 👎 on a card with no verdict yet (§5.7), HU copy `Segített`/`Nem talált` + `pontatlan`/`túl sok`/`rossz időzítés`/`nem rólam szól`. Mounted by `ChatMessage`, `MemoirPage`, `PredictionsPage`, Today's `MezoMessagesSheet` ([`today.md` §10](today.md)) — the first Insights *component* with a cross-feature consumer (the only earlier cross-out import is the `useVoiceInput` hook, by `features/me/sheets/JournalSheet.tsx`) — and, since `mezo-p2tr`, by `/me/week`'s `WeekReviewCard`/`WeekNextCard` too (the retired `WeeklyPage` used to mount it directly) — §5.7
- `data/feedback/{feedbackTypes,feedbackApi,feedbackMock,feedbackHooks}.ts` (+ `feedbackHooks.test.tsx`) — **W4.1** the data half: the FE enums + `FeedbackHandle`, the three-call client over the companion-owned `/api/companion/feedback` (contract `api/feature/companion-feedback/companion-feedback.yml`, [`companion.md` §4](companion.md)), the deliberately EMPTY mock seed, and `useFeedback(kind, ids)` — one batch read per page, optimistic write, retract-on-bare-re-tap. Exported through the `@/data/hooks` barrel like every other data hook
- `data/useDualQuery.ts` — gained the optional real-mode-only `keepPreviousRealData` flag for `useFeedback`'s id-set-keyed cache (§5.7); default OFF, no existing caller affected. Documented in full in [`_platform-data-layer.md` §4/§10](_platform-data-layer.md), which owns this helper
- **`components/GrowthWeekCard.tsx` is DELETED (`mezo-p2tr`)** — the Weekly "Growth — heti" card (E3, quests/LIFE XP/activities/savings + honest empty line) had `WeeklyPage` as its only consumer; growth domain docs in [`growth.md`](growth.md)
- **`components/MotorHero.tsx · VerdictFilterChips.tsx · DomainSection.tsx · PairRow.tsx` are DELETED (`mezo-tk88.4`)** — the Motor page's `mezo-18bx` presentational units (hero card, verdict-filter chips, collapsible domain sections, expandable pair rows); superseded by `MotorStateHero`/`LifecycleSection` above. **`components/MetricCoverageRing.tsx` survives unchanged** — its `metric`/`referencingTitles`/`waiting` props are still exactly what the „Adat-egészség" panel needs
- `logic/domains.ts` — **mezo-18bx, KEPT `mezo-tk88.4`**: `DOMAIN_META`/`DOMAIN_ORDER` (token-based domain colors, feeds `MotorStateHero`'s chip row) + `comparePairs` + `groupPairsByDomain` (primary domain = metric-B; `comparePairs`/`groupPairsByDomain` no longer have a live page consumer post-retirement but stay pure-tested, `domains.test.ts`)
- `logic/lifecycle.ts` — **`mezo-tk88.4`**, the dashboard's bucketing spine: `LifecycleBucket`/`BUCKET_ORDER` (the six-bucket taxonomy + section order), `isStrongSignal` (the display-layer `|r|≥0.3 && p≤0.15` gate, `STRONG_SIGNAL` in `insights.ts`), `bucketize(patterns, monitor)` — matches `Pattern.pairKey` to `PatternMonitorPair.key`, a user-judged `status` always wins, an unmatched pair always lands in `gathering`; pure, unit-tested in `lifecycle.test.ts`
- `logic/verdicts.ts` — **`mezo-tk88.4`** (lifted off the retired `PairRow.tsx`, unchanged): `bottleneckLabel` + `verdictSentence` (the honest per-verdict sentence, few_days' 🎯 nudge included) — now backs the „Még gyűlik az adat"/„Elvetve" lifecycle rows
- `logic/findings.ts` — **mezo-fj1g + `mezo-0469`**, human-finding composition: `strengthWord`, authored direction reading + neutral „Eddig ebbe az irányba…” prefix, `{erősség}` substitution and evidence-strength metadata; no LLM, pure/unit-tested.
- `logic/patternEvidence.ts` (+ test) — **`mezo-0469`**, sorted group summaries (count/range/thresholded median/latest) and observed-range axis generation.
- `logic/patternHistory.ts` — detail derivations: strength series/ticks, significant-only `journalEntries` (first computable snapshot, decisions, promotion, reinforcement, current group progress), `fitLine`, snapshot range and chart labels; pure/unit-tested.
- `components/ChatMessage.tsx` — chat bubble + tool/ref rows; the answer body renders via `@/shared/lib/markdown`
- `sheets/ConversationPickerSheet.tsx` — **`mezo-at8x.3`** the conversation list + "Új beszélgetés" row (presentational; ChatPage owns the `?c=` selection)
- `logic/useStickToBottom.ts` — **`mezo-at8x.2`** rAF bottom-anchoring + the stick-while-at-bottom rule for the streamed answer
- `logic/useVoiceInput.ts` — **`mezo-at8x.4`** the record → convert → transcribe state machine (`unsupported | idle | recording | transcribing`)
- **`components/PhaseTeaserCard.tsx` — DELETED in the Napív S8 shell migration (`mezo-mifi`):** with `PHASE3_TAB_IDS` empty no tab is Phase-gated, so the ghost had no reachable consumer; the component is gone and the un-ghost/ghost-guard recipe survives only in git history (§2).
- Tests: `pages/*.test.tsx` (incl. `PatternDetailPage.test.tsx`, `mezo-tk88.5`), `components/PatternDecisionCard.test.tsx`, `logic/{lifecycle,domains,patternHistory}.test.ts`, `insights.nav.test.tsx` (`InsightsSubNav.test.tsx` deleted with the component, `mezo-ugqb`; **`pages/MotorPage.test.tsx` + `components/PatternCard.test.tsx` deleted with their components, `mezo-tk88.4`**)

**Data layer (`frontend/src/data/`):**
- `insights.ts` — patterns (`p1` seeded `status: 'confirmed'` since `mezo-tk88.4` so the dashboard's mock „Megerősítve" bucket isn't empty — the other two stay `proposed`), memoir, predictions, experiments (**the `weekly`/`growthWeek` seeds were REMOVED with the Weekly tab, `mezo-p2tr`**) + `MIN_PATTERN_CONFIDENCE`, `STRONG_SIGNAL` (**`mezo-tk88.4`**, the decision-inbox display gate `|r|≥0.3 && p≤0.15` — `logic/lifecycle.ts`'s `isStrongSignal` reads it), `patternCategoryColor`
- `knowledge.ts` — facts, edges, `FACT_CATEGORIES`, `factCategoryColor`
- `chat.ts` — `initialChat`
- `graph.ts` — `lifeEventCandidateSeed` (mock L2 seed: one `LIFE_EVENT` + one `SEASON`) + `graphNodeSeed` (the Kapcsolatok mock seed, five nodes across five kinds) + `GRAPH_KIND_GROUPS` (ordered kind→Hungarian-label groups for that view) + `PROFILE_SOURCE_KIND` (`mezo-b3pp.17`, the profile singleton's `source_kind`, split out of the kind groups by it) + **`CANDIDATE_COPY`/`formatCandidateDate` (W5.3 `mezo-b3pp.20`)** — the per-kind `{eyebrow, provenance}` copy table and the kind-aware date-row formatter §2.4 consumes
- `weeklyHooks.ts` — **RETIRED down to `isoWeekNumber` (`mezo-p2tr`)**: `useWeekly` (D′ + W1 + E3) and its pure rollup fns (`deriveWeekMetrics`/`deriveItems`/`deriveScore`/`trendOf`) + score constants are all deleted; only `isoWeekNumber` survives, still shared by `memoirApi.ts`'s real-mode title
- `weeklySuggestionApi.ts` — **W1** `weeklySuggestionApi.get(date)` → proactive `GET /api/proactive/weekly-suggestion` (wire → `prose` string, 404→null); its only FE consumer is now `/me/week`'s `Heti` hub ([`me.md`](me.md))
- **`growthWeekApi.ts` is DELETED (`mezo-p2tr`)** — its only consumer, `useWeekly`'s `growthWeek` branch, is gone; the Progression `GET /api/progression/growth-week/{date}` endpoint itself is untouched but has no FE client any more ([`growth.md`](growth.md))
- `memoirHooks.ts` — **`useMemoir` (W2)**: dual-mode `['memoir']` read (mock seed no-fetch / real `GET /api/proactive/memoir`, 404→null); returns `{ memoir, anniversaryNote, mode }`
- `memoirApi.ts` — **W2** `memoirApi.latest()` → proactive `GET /api/proactive/memoir` (wire → FE `Memoir` via `toMemoir`, `Hét N …` week label derived client-side)
- `monitorApi.ts` + `monitorHooks.ts` — `usePatternMonitor()` (`['pattern-monitor']` dual-mode, real → `GET /api/companion/pattern/monitor`, 404→degraded) for dashboard plus detail diagnostics. The seed spans all six surface verdicts, including `imbalanced_groups`, and 13 metric coverage rows.
- `patternPairMapper.ts` (+ test) — **`mezo-0469`**, shared generated-wire mapper for monitor and pair detail, including value kinds and group fields.
- `patternDetailApi.ts` + `patternDetailHooks.ts` — **`mezo-tk88.5`** (Task 11), the §2.1b detail page's read: `usePatternPairDetail(pairKey)` (`['pattern-pair-detail', pairKey]` dual-mode, real → `GET /api/companion/pattern/pair/{pairKey}` via `patternDetailApi.get`, wire→FE mapping reuses `patternsApi.ts`'s `toPattern`; any 404 → one honest `notFound`, no separate `degraded`) — read-only, decisions still go through `usePatternActions()` (above)
- `memory.ts` — **`mezo-al1i`** mock seeds: `memoryOverview`, `memorySummaries` (6 entries spanning 2 months, so the month separator renders), `similarDaysSeed` (3 deterministic hits), `memoryLlmUsage` (7-day series, `totals` = the exact sum of `perDay`)
- `memoryApi.ts` — **`mezo-al1i`** the 4 REST calls + wire→FE mappers (`toOverview` normalizes optional wire fields to `null`) over `api.gen.ts`'s `MemoryOverviewResponse`/`MemorySummaryListResponse`/`SimilarDaysResponse`/`LlmUsageResponse`
- `memoryHooks.ts` — **`mezo-al1i`** `useMemoryOverview`/`useMemorySummaries`/`useLlmUsage` (`useDualQuery`, `['memory', …]` keys, 404→`degraded`) + `useSimilarDays(query)` (a **raw** `useQuery`, not `useDualQuery` — `enabled` gates on a non-empty trimmed query so the lazy-submit search never fires on mount); re-exported from `hooks.ts`
- `insightsHooks.ts` — `useInsights` (no longer returns `weekly`/`weeklySuggestion` since D′ split it out, nor at all since that split retired outright, `mezo-p2tr`; its `memoir`/`anniversaryNote` fields no longer consumed since W2 — only `predictions`/`experiments` are live)
- `hooks.ts` — barrel: re-exports `useKnowledge`, `useInsights`, `useChat`, **`useMemoir`**, **`usePatternMonitor`**, **`usePatternPairDetail`** (`mezo-tk88.5`), **`useLlmUsage`/`useMemoryOverview`/`useMemorySummaries`/`useSimilarDays`** (the boundary / Phase-3 swap point; **the `useWeekly` line was REMOVED, `mezo-p2tr`**). It is a **shared, app-wide barrel** — every domain lands its re-export line here (most recently the ritual/recap hooks, `mezo-ilsj`; before that the account-progression hooks, `mezo-k7rn`), so a change to this file is not by itself evidence of an Insights-relevant change; check which exported names moved.
- `types.ts:599-743` — all Insights/Knowledge/Chat types (`PatternMonitor`/`PatternMonitorPair`/`PatternMetricCoverage` at `types.ts:644-683`; `MemoryOverview`/`MemorySummaryItem`/`SimilarDay`/`MemoryLlmUsage`/`FactSource` added `mezo-al1i`; `PatternEventKind`/`PatternEvent`/`AlignedDay`/`PatternImpactRef`/`PatternImpact`/`PatternPairDetail` at `types.ts:768-795`, added `mezo-tk88.5`)
- Tests: `insightsData.test.tsx`, `chatData.test.tsx`, `memoryHooks.test.tsx` (**`mezo-al1i`**, dual-mode + the lazy-search enabled-gate + the `enabled:false` audit branch), `pages/MemoryPage.test.tsx` (**`mezo-al1i`**, all 4 segments + degraded + the Napló focus-scroll), `patternDetailHooks.test.tsx` (**`mezo-tk88.5`**, dual-mode — see §8 for the full case list)

**Cross-feature seams:**
- `frontend/src/app/router.tsx` — the flat `/mezo` + `/mezo/*` routes (hub, patterns, `patterns/:pairKey`, memoir, knowledge, chat, predictions, experiments, memoria) + the two intra-tab redirects (`mezo/weekly` → `/me/week`, `mezo/motor` → `/mezo/patterns`) + **`LegacyPathRedirect`**, the `insights/*` → `/mezo` rewrite that preserves subpath and query (§2) + **`MeKnowledgeRedirect`** (`mezo-ms9a`) — `me/knowledge` → `/mezo/knowledge?view=kategoriak(&kind=…)`, the cross-tab redirect that replaced the deleted `KnowledgePage.tsx` route
- `frontend/src/app/TabBar.tsx` — the `Mezo` tab (clay `i-mezo`), the entry point that replaced Today's ✨ link (§5.2)
- **`frontend/src/features/me/pages/KnowledgePage.tsx` is DELETED (`mezo-ms9a`)** — was the Én-tab `Tudásgráf`, the other `useKnowledge` consumer (§5.1); its chain is now `KnowledgeListPage`'s own `?view=kategoriak`/`?view=profil` views (§2.4). `ProfilePage.tsx`, the third historical consumer, was already deleted (`mezo-d20.6.1`) — `useKnowledge()` has had a single consumer since `mezo-ms9a`.
- `frontend/src/data/types.ts` — `TrendInsight` (the lightweight insight embedded in Goals/Sleep; its `InsightCard` renderer was deleted in `mezo-lfw`, §5.3)
- `frontend/src/data/train/train.ts:57` · `sleep.ts:25-33` · `fuelWeek.ts:55,151,156` · `goals.ts:50` — "pattern engine" references (shared `P2`/`P3` IDs)
- `frontend/src/shared/ui/RefTag.tsx · ToolChip.tsx` — chat tool/ref rendering
- `frontend/src/styles/prototype.css` — the `--cat-*` tokens (S8 `mezo-mifi`: `var()` aliases onto the Napív accents, no dark block) **and the `--mz-*` Mozaik token family** the re-faced pages paint with ([`_platform-design-system.md`](_platform-design-system.md) owns both)

**Docs (link, don't duplicate):**
- `docs/superpowers/specs/2026-07-05-insights-weekly-honest-design.md` (D′ — deterministic Weekly v0 + honest surface for Memoir/Predictions/Experiments)
- `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (Slice D §126; Phase-3 out-of-scope §6)
- `docs/milestones/roadmap.md:12-13` (Slice D remaining; Phase-3 AI brain)
- House standards: `docs/references/{api_contract_conventions,liquibase_conventions,java_package_structure,spring_patterns,error_handling,configuration_conventions,testing_standards,integration_test_framework}.md`

**Confirmed absent (Phase-3 gap):** no `api/feature/insights|knowledge|chat`, no `backend/**` Java for any Insights domain, no Liquibase changeset. **Weekly (D′) has a real-mode hook path but no Insights backend** — it composes over other features' contracts (Fuel/Train/biometrics) client-side. **Memoir (W2) has a real-mode hook path over a PROACTIVE-owned backend** (`GET /api/proactive/memoir` — not an Insights endpoint; the `memoir` table + generator live in `feature/proactive`, see [`proactive.md`](proactive.md)).
