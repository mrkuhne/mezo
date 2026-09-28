---
title: Insights (the Mezo tab)
type: feature-domain
status: mixed
updated: 2026-09-27
tags: [insights, mezo-tab, frontend, data-layer]
key_files:
  - frontend/src/features/insights
  - frontend/src/data/insights
  - frontend/src/data/character
  - frontend/src/data/feedback
  - frontend/src/shared/lib/markdown.tsx
  - frontend/src/features/insights/logic/coachingCopy.ts
related: [_platform-data-layer, _platform-design-system, today, me, character, companion, proactive]
---

# Insights — the Mezo tab — Feature Documentation

> One-line: the **pattern/companion "AI brain" surface** — where mezo reflects back what it has *learned* about the user (detected patterns, memoir, knowledge base, chat, predictions, experiments). **Status: 🔶 mixed** — **Chat** (companion V0.4), **Patterns** (V3.1), **Knowledge** (V1.2) are ✅ real over the companion backend ([`companion.md`](companion.md)); **Memoir** is ✅ real since **proactive W2 (`mezo-h4wp.4`)** — the tab un-ghosted, rendering the companion's generated weekly memoir (anniversary/archive stay mock-only; the mock-only demo reaction row was RETIRED at Phase 5 W4.1 `mezo-b3pp.15` in favour of real 👍/👎 feedback chips that render in both modes — §2.3, closes `mezo-kr9v`); **Predictions** is ✅ real since **proactive P1 (`mezo-h4wp.7`)** — the tab un-ghosted, rendering pattern-grounded forecasts with deterministic validation („tanulom" on null confidence, honest accuracy header); and **Experiments** is ✅ real since **proactive P2 (`mezo-h4wp.8`)** — the last tab un-ghosted, rendering companion-proposed N=1 experiments with an L2 accept/dismiss write path + deterministic outcomes. **All proactive-epic tabs are now real** (`PHASE3_TAB_IDS` is empty; the proactive epic is complete) — plus the post-epic **Memória** tab (§2.9, `mezo-al1i`, a read-only observatory over the memory pipeline itself), never phase-gated, for **all seven remaining Insights tabs real** today. **Phase-2 exit audit passed (mezo-t16y.4, 2026-07-05):** the sub-nav hiding + per-page `PhaseTeaserCard` guards re-verified; no fabricated Insights number reaches a live user. **Reached as the `Mezo` tab** — the fourth of the five first-class tabs, promoted out of a hidden ✨-icon link in Today's header by Design 2.0 ([ADR 0032](../decisions/0032-five-tab-ia-dissolved-section-shells.md)). **The name changed with the promotion: the section is called `Mezo`, its routes are `/mezo/*`, and `/insights/*` is a redirect** (§2). **The post-epic Motor tab (was §2.8, `mezo-viqs`/`mezo-18bx`) is RETIRED (`mezo-tk88.4`)** — its pattern-gate diagnostics were folded into the Patterns tab's own dashboard (new §2.1: hero + decision inbox + lifecycle sections + a collapsed „Adat-egészség" coverage panel) and the per-pattern **pattern-pair detail page** (§2.1b, `mezo-tk88.5` — `PatternDetailPage.tsx`); `/mezo/motor` now redirects to `/mezo/patterns` (`router.tsx`). **The Weekly tab (was §2.2, `mezo-t16y.1`/D′) is also RETIRED (`mezo-p2tr`)** — the weekly score review, its growth card and the weekly tervjavaslat prose all moved to **`/me/week`** (the `Heti` hub + view-pages, backed by the backend-computed `GET /api/me/week` — [`me.md`](me.md)); `/mezo/weekly` now redirects to `/me/week` (`router.tsx`).

> **Csapat-üzenőfal (Act I, `mezo-a9bo7`, 2026-09-24):** the root is the five-character social wall (`TeamFeedPage`) in the dark glass canon; the dock is **Üzenőfal · A csapat · Rólad · Emlékek**; the old 12-tile menu is the Gépterem's „Összes funkció” dev-menu. Every post is a view of an existing record ([ADR 0049](../decisions/0049-boop-shared-social-ai-world.md)); content still opens on full pages.

---

## 1. Summary

Insights is the user-facing window onto mezo's N=1 self-model: it presents the behavioral patterns the (future) AI has inferred, a weekly score review, a literary "memoir," an editable knowledge base of facts, a chat companion, predictions, and self-experiments. Every surface today renders **hand-authored Hungarian mock copy** that *simulates* what the Phase-3 AI will eventually generate.

**Status per layer:**

| Layer | Status | Notes |
|---|---|---|
| FE mock | ✅ done | the hub + 7 sibling pages, all views + tests present |
| FE real-mode | ✅ all 7 tabs (Chat + Patterns + Knowledge + Memoir + Predictions + Experiments + **Memória**) | **Chat** real since companion V0.4 (`chatHooks.ts` + `chatApi.ts`, SSE — [`companion.md`](companion.md) §5.1); **Patterns** (V3.1) + **Knowledge** (V1.2) real over the companion backend — Patterns' dashboard also reads `GET /api/companion/pattern/monitor` directly since **`mezo-tk88.4`** (the retired Motor tab's diagnostics, §2.1); **Memoir** real since **proactive W2 (`mezo-h4wp.4`)** — `data/insights/memoirHooks.ts` reads `GET /api/proactive/memoir` (404→null→honest „készül" state), anniversary/archive mock-only, the demo reaction row retired at W4.1 for real feedback chips (§2.3); **Predictions** real since **proactive P1 (`mezo-h4wp.7`)** — `data/insights/predictionsHooks.ts` reads `GET /api/proactive/prediction` (list; `[]`→honest still-learning state, „tanulom" on null confidence); **Experiments** real since **proactive P2 (`mezo-h4wp.8`)** — `data/insights/experimentsHooks.ts` reads `GET /api/proactive/experiment` + `useExperimentActions` writes L2 decisions/propose; **Memória** real (both modes) since **`mezo-al1i`** (post-epic) — `data/insights/memoryHooks.ts` reads the 4 `GET /api/companion/memory/*` endpoints off `MemoryObservatoryService`, §2.9. **No mock-only Insights tab remains** — all 7 are real (§2). **Proaktív coaching** (3 routes under `/mezo/coaching`, not a tab, since **`mezo-6269.3`**) is real (both modes) over the companion flag-trace read — `useCoachingTrace`/`useCoachingCard`, §2.10, §5.8. **Motor (was the 8th tab) is RETIRED (`mezo-tk88.4`)** — `/mezo/motor` redirects to `/mezo/patterns`. **Weekly (was the 2nd tab) is RETIRED (`mezo-p2tr`)** — `/mezo/weekly` redirects to `/me/week` ([`me.md`](me.md)). **All seven surfaces survived the Design 2.0 rename unchanged in data terms** — they are now full pages under `/mezo/*` instead of sub-tabs under `/insights/*` (§2). |
| Backend (Java) | ✅ `feature/companion` (+ `feature/people`/`feature/companion/graph`/`feature/companion/reflection`) | Chat (`ai_conversation`/`ai_message`), knowledge facts (`knowledge_fact`/`learned_fact`), patterns (`pattern`/`pattern_event`), the knowledge graph (`graph_node`/`graph_edge`), named effects (`effect_link`/`effect_mute`) and the S6 forget/mute spine (`memory_forget_veto`) are all real — see [`companion.md`](companion.md). Stale note superseded: this row used to say "no `pattern`/`knowledge_fact` backend yet", true only at the Phase-2 seed-only stage (§ below). |

This is **intentional**. Insights is the Phase-3 "AI brain" surface; the single FE↔data boundary (`frontend/src/data/hooks.ts`) is pre-built so the real-mode swap is mechanical, exactly as already proven for biometrics/Train (the barrel is app-wide shared — unrelated domains' re-export additions, e.g. the `mezo-53su` `useFuelSettings` export, move this key_file without touching Insights' own data path). There are **two distinct roadmap stages** the doc keeps separate:
- **Phase-2 Slice D — "Insights seed-only"**: **DROPPED as superseded (2026-07-04 re-map)** — Phase 3 built the real `pattern`/`knowledge_fact`/`ai_conversation` stack, so seeding was never needed. What remains is **D′** (`mezo-t16y.1`): deterministic Weekly review + honest surface for Memoir/Predictions/Experiments — `docs/superpowers/plans/2026-07-04-phase2-completion-roadmap.md` §D′.
- **Phase 3 — the actual AI**: Spring AI + pgvector + RAG + pattern/companion pipeline (`docs/milestones/roadmap.md:13`).

Driving specs: `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (Slice D §126; Phase-3 out of scope §6) · `docs/milestones/roadmap.md:12-13`.

---

## 2. User-facing behavior

> **2026-09-26 — U10 (`mezo-me75u.10`).** Every Boop on the wall is alive now (the story strip no longer animates only the „new” ones — the new state is carried by the ring), and the wall's reply / evidence / revision dialogs ride the shared glass `GlassBox` in lavender.

The communication profile now belongs to `/settings/mezo/communication`, alongside explicit user instructions and the learned-profile inclusion switch. The Tudástár no longer has a communication tile; `?view=profil` redirects to the canonical editor. `/settings/mezo/context` shows the exact backend-assembled personal blocks, source links and inclusion status. See [central settings](settings.md) and [companion](companion.md).

**Route: `/mezo`** renders `TeamFeedPage`, the csapat-üzenőfal (§3). The persistent Mezo dock is **Üzenőfal / A csapat / Rólad / Emlékek** (`navModel.ts`, spec §2.5, `mezo-a9bo7.10`). Ownership keeps the highlight from jumping: a post's deep pages (patterns, predictions, experiments, coaching, chat, karakter-feed) light **Üzenőfal**; the rooms and the machinery behind them (`/mezo/csapat/*`, konzílium, Gépterem incl. „Összes funkció”, memória) and **Kérdezd a csapatot** (`/mezo/diagnozis[/:id]`, since `mezo-u3712`, §2.11) light **A csapat**. Each content page retains its original route and name. There is **no chip strip** on any page any more: the old `BoopNavigation` („Összes funkció” + Minták · Előrejelzések · Diagnózis · Kísérletek · Heti chips above every `/mezo/*` and `/me/week` page) was removed in `mezo-twizx` — the new dock and the approved üzenőfal prototype have none. Those five destinations are reached through the Gépterem's „Összes funkció” grid (`/mezo/karakter/gepterem/osszes`, `BOOP_DESTINATIONS`), and each list page's own `‹ Összes funkció` back chip returns there; the weekly review stays canonical at `/me/week`.

| Surface | Route | Component |
|---|---|---|
| Üzenőfal | `/mezo` | `TeamFeedPage` |
| A csapat / szoba | `/mezo/csapat`, `/mezo/csapat/:id` | `TeamPage`, `CharacterRoomPage` |
| Összes funkció (dev-menü) | `/mezo/karakter/gepterem/osszes` (`/mezo/menu` redirects here) | `BoopMenuPage` |
| Rólad | `/mezo/rolad` | `BoopAboutPage` |
| Emlékek / napi részlet | `/mezo/emlekek`, `/mezo/emlekek/:date` | `BoopMemoriesPage`, `MemoryDayPage` |
| Minták / részlet | `/mezo/patterns`, `/mezo/patterns/:key` | `PatternsPage`, existing detail pages |
| Előrejelzések / részlet | `/mezo/predictions`, `/mezo/predictions/:id` | `PredictionsPage`, `PredictionDetailPage` |
| Kísérletek / részlet | `/mezo/experiments`, `/mezo/experiments/:id` | `ExperimentsPage`, `ExperimentDetailPage` |
| Tudástár / kapcsolat | `/mezo/knowledge`, `/mezo/knowledge/node/:id` | `KnowledgeListPage`, `KnowledgeNodePage` |

The menu catalog is `logic/boopNavigation.ts` (`BOOP_DESTINATIONS` + `ALL_FEATURES_ROUTE`); since `mezo-a9bo7.10` it is the Gépterem's „Összes funkció” grid (spec §2.4: a dev-menu opened from the Gépterem tile and the chips' „Összes funkció” link, not a tab), and the list pages' back chip returns to it. It also exposes Diagnózis, Heti, Karakter, Konzílium, Coaching, Beszélgetés and Gépterem. Menu tiles use actual Clay icons, wash tokens and reduced-motion-aware entrance/hover animation. They do not invent live counts or rewards.

**The rename is a redirect, not a break (`mezo-d20.1.1`).** `router.tsx` mounts `{ path: 'insights/*', element: <LegacyPathRedirect prefix="/insights" to="/mezo" /> }` — a component that rewrites `location.pathname` and re-navigates with `replace`, **preserving the subpath and the query string**. So `/insights` → `/mezo`, `/insights/knowledge` → `/mezo/knowledge`, `/insights/patterns/late_meal__sleep_quality?x=1` → the same under `/mezo`. PWA bookmarks and any in-app `navigate()` not yet migrated keep working; `PatternsPage`'s own row links still emit `/insights/patterns/{key}` and arrive correctly through this hop. The two older intra-section redirects survive underneath, now on `/mezo`: **`/mezo/weekly` → `/me/week`** (the Heti retirement, `mezo-p2tr`) and **`/mezo/motor` → `/mezo/patterns`** (the Motor retirement, `mezo-tk88.4`).

> **Üveg U8 (`mezo-me75u.8`, 2026-09-25).** Chat, the three coaching pages, diagnózis (list + report), the experiment list, Emlékek + napi emlék, memoár (+ archívum, fejezet) and Memória wear the dark glass material ([prototype](../design_2.0/prototypes/uveg-mezo.html), bible appendix U8). Visual only — no route, hook or contract changed. Each page moved off the shared `mzp-*` / `mem-*` / `mz-memoir*` / `mz-march-*` / `mz-qcard` classes onto its own prefix: chat `.mzc-u8`, coaching `.coach-*`, diagnózis `.dgx-*`, kísérletek `.exl-*`, Emlékek + the similar-day search panel `.eml-*` (`MemorySearchPanel` is styled by its own `.eml-search` root, so it reads the same on Memória's Kereső tab), memoár `.mmo-*`, Memória `.mmr-*`. The class names cited in the older sections below (e.g. `.mz-march-card`, `.mem-laycard`, `.mzo-rule`) describe the pre-üveg markup; the dead rules are tracked in `mezo-wqzx8`. Status glyphs became 3D icons (bible rule 45); a refuted experiment stays neutral (§2.7).

> **Üveg U9 (`mezo-me75u.9`, 2026-09-25).** Rólad (`BoopAboutPage`, `.kr9-rolad`), the Tudástár (`KnowledgeListPage` all views + `KnowledgeNodePage`, `.tud9`), Minták (`PatternsPage`, `.m9m-root`; `PatternDecisionCard glass` is the opt-in for the dashboard only) and Előrejelzések (`PredictionsPage`, `.m9e-root`, `FeedbackChips glyph3d`) and the Összes funkció grid (`BoopMenuPage`, `.gtm-menu-page`) wear the csapatfal material (`tf-*` kit) per [`uveg-mezo-teljes.html`](../design_2.0/prototypes/uveg-mezo-teljes.html). Visual only — routes, hooks, params and states unchanged. `PatternDomainMark` draws 3D domain art (`PATTERN_DOMAIN_MARK_ART`). The old `mnt-*`, `mzp-*`, `mz-candc`, `tud-*`, `boop-world-tile` rules await the dead-CSS sweep.

### 2.0 Social entry and navigation

The old `BoopWorldPage` (the embedded `KarakterHubPage` council feed + „Amit közben figyelünk” discovery links) is **deleted** (`mezo-a9bo7.10`): the wall renders the same records as character posts (§3). Cross-engine topic conversations require the separate backend extension in ADR 0049 (Act II).

**Hidegindítás (`mezo-a9bo7.10`, spec §2.6).** When `buildTeamFeed` yields no day AND the dossier is untouched (`isDossierEmpty(overview)`, the Karakter hub's own predicate), the wall shows `components/feed/IntroPosts.tsx`: Mezo's glass „Szia! Mi leszünk a te kis csapatod.” poster + the four flat intros, copy **verbatim** from the prototype's `elsonap` day 1. They are static UI copy, not records — no „Miből látszik?”, no trio, no maturity band — followed by „Kezdjük el a dossziét”, wired to the SAME `useCharacterBootstrap()` mutation as `KarakterHubPage` (created/conflict → „Elindult…”, empty → „Még nincs elég történet…”). A started dossier with no records gets the plain „Még csend van a falon” note instead. The `/mezo` kalauz bubble series is **retired** (`tutorial/registry/mezo.ts` is now empty; the orphaned `minta` fogalom went with it) — the intros replace it.

#### 2.0a Hangkönyv-vázlat (spec §7/6 — the Act II generator prompts start here)

Common rules for every character sentence: 2–4 sentences, tegeződő spoken Hungarian, zero jargon („intake”, „7-day MA”, „±0.3 kg” are banned), concrete numbers with **bold** emphasis, uncertainty said as uncertainty („lehet”, „kezd úgy tűnni”, „még csak sejtem”), every claim with „Miből látszik?”. Emoji only inside character sentences, from the character's own set — never as UI glyphs. Act I writes NO record text; this governs only the static intros and every future generator.

**This section IS the generator prompt's core (csapatfal H3, `mezo-a9bo7.14`).** The backend's `TeamCharacter` enum (`feature/character/service/edition`) carries the same four things per character — display name, area, emoji set, and these rules condensed into one voice sentence — and `EditionVoiceWriter` renders them into the evening edition's single LLM call. The rules above are not advisory there: `EditionVoiceGuard` enforces the number rule (only figures that appear in the source record), the 2–4 sentences, the own-emoji set and the jargon ban on every generated post, and a post that fails falls back to the record's own text with `voiced=false`. Editing this section means editing `TeamCharacter.voice()` with it — see `docs/features/character.md` §Esti kiadás.

- **Szunya · alvás** — calm, a little secretive night-watcher; never scolds about bedtime, notices timing rather than totals. Emoji: 🌙. *„Még semmit sem tudok rólad — pár naplózott alvás után jelentkezem az első észrevétellel.”* · *„Ez még csak egy szál, de már húzom.”*
- **Mocor · mozgás** — energetic but not a drill sergeant; watches load, variety and logging discipline. Banned: pushing, guilt. Emoji: ⚡💪. *„Nem hajtalak, de észreveszem, és szólok, ha három nap ugyanaz megy.”* · *„a tested a **változatosságból** épül, nem a megszokásból.”*
- **Falat · étkezés** — curious foodie, never scores a plate; hunts for what worked so it can be repeated. Emoji: 🍽️🥦 (🍳 in the prototype intro). *„nem pontozni fogok, hanem észrevenni.”* · *„minden tányér, amit felírsz, egy mondattal okosabbá tesz.”*
- **Derű · közérzet** — warm, asks for the user's own words (check-ins), promises to notice mood drivers early; the most data-hungry voice (Act II „adat-éhség”). Emoji: 🌤️. *„Ehhez a te szavad kell: egy-egy rövid esti bejelentkezés.”* · *„Az energiád történetét szerintem együtt fogjuk megfejteni.”*
- **Mezo · a csapat** — the gold host: convenes the weekly konzílium, explains how the team learns, owns memoir/diagnosis/knowledge. Emoji: 📔✅ (👋🔍 in the intro). *„**csak az kerül a rólad szóló képbe, amiben egyetértünk**”* · *„Nincs kioktatás, nincs tananyag — **a fal magyarázza önmagát**.”*
- **A Szkeptikus** — never posts, has no ring or room; speaks only inside conversations, dry, no emoji, always offers the alternative explanation. *„Szép együttfutás, de a hétvége önmagában is magyarázhatja…”*

`BoopAboutPage` no longer embeds `DimensionsPage` directly — since **U9b (`mezo-zpxv7`, 2026-09-26, §2.0b below)** the dimension list moved behind a door and Rólad became the one page where the team's picture of the user lives AND where the user decides about it: the decision inbox moved here from the Tudástár. `BoopMemoriesPage` combines the existing weekly memoir/archive and daily summaries/search without depending on the memory overview. Daily summaries open full pages with previous/next navigation; search `?q=` survives detail/back. Prediction/experiment details retain feedback and decisions, and expose honest loading/error/missing states. Patterns preserve bucket/domain/sort/page through their detail links; prediction/experiment lists preserve their URL filters.

Knowledge graph nodes open `KnowledgeNodePage` instead of a nested sheet; category/week query context is preserved. **The weekly lessons page, the week's discovery links and `weekHighlight` all link to the one decision inbox at `/mezo/rolad?start=` (U9b — repointed off the Tudástár, §2.0b)**, and Memory Audit links to the one fact list. The candidate DTO has no week date: the inbox explicitly shows all open proposals, rather than claiming a week filter. Memory layers/cost diagnostics remain at `/mezo/memoria`, linked from the common Gépterem.

Every routed page owns its heading, padding and parent link; global crosslinks and the persistent dock provide lateral navigation. Sheets remain for short actions and evidence, not a chain of content pages. The old `MezoHubPage` implementation is unmounted; its source remains for historical test coverage.

### 2.0b Rólad (`pages/BoopAboutPage.tsx`) — **the short distributor, S6c `mezo-2dfy2`, 2026-09-27 (U9b base `mezo-zpxv7`)**

At **`/mezo/rolad`**, the dock's third stop. U9b made it the ONE place the team's picture of the user lives and where the user decides about it (inbox moved here from the Tudástár §2.4); **S6c (spec S6c addendum, prototype `uveg-mezo-teljes-s6.js` `rolad6()`) then cut it down to a short distributor** — "itt döntesz, és innen nyílik minden": the freshest-facts block left the page (the hub's Rólad section owns facts), the life-event timeline moved behind its own door, and the "A te kezedben" note shrank to a footnote. Top to bottom, each section independently honest:

1. **Idézet** (`components/rolad/RoladQuote.tsx`) — the highest-confidence non-sensitive character claim across `useCharacterOverview()`'s dimensions (`pickQuoteClaim`, `logic/roladCopy.ts`; a `sensitive` claim is never quoted — ADR 0049, no invented sentence). **Talál** → `useClaimFeedback().submit(id, 'TALAL')` (toast on failure, an inline confirmed state on success); **Pontosítom** toggles the existing `CharacterReplyThread` (`source: 'CLAIM'`). `overview == null` (character switch off) → the whole section is omitted; an on switch with no claim yet renders the honest `ROLAD_COPY.quoteEmpty` note instead of a fake sentence.
2. **Döntésre vár** (`components/rolad/RoladInbox.tsx` over `hooks/useRoladInbox.ts`) — fact candidates (`useKnowledge()`) and LIFE_EVENT/SEASON candidates (`useLifeEventCandidates()`) in one list, oldest-seen-first, each a glass `FactCandidateCard`/`LifeEventCandidateCard` with the **four decisions**: **Igen, jegyezd meg** (accept) · **Pontosítom** (inline refine, unchanged semantics) · **Most ne** (`snooze` — new, §4.1: candidate leaves the inbox for 14 days, then is re-offered; stays non-terminal, re-snoozable) · **Nem igaz** (`reject`, terminal, a quiet text button). `useRoladInbox()` keeps a page-level `settled` list (`Settled[]`) so a decided card turns into its afterlife line **in place** instead of jumping or disappearing during the real-mode refetch window — kept: sage `SettledRow` (fact) or `LifeEventAcceptedCard` (graph); snoozed/rejected: a quiet dashed line (`ROLAD_COPY.snooze`/`.reject`). The fact-candidate conflict checkbox (`conflictsWithFactId` → „A régit kikapcsolom") moves here unchanged — it never fires on snooze or reject, only on an accepting path. `degraded` (companion off) hides only the fact half; graph candidates keep rendering. `?start=YYYY-MM-DD` (moved off the Tudástár) shows the week banner back to `/me/week?start=`, without filtering the inbox. **S6c fold:** collapsed by default to the first **2 open** cards (settled-this-mount lines always stay visible in place); a gold `Még N javaslat` row (`data-inbox-fold`, `ROLAD_COPY.foldMore/foldLess`) expands to everything and back. The `N JELÖLT` hint always counts every open candidate.
3. **Kirakat — „Amit a csapat megjegyzett” (`data-rolad-kirakat`)** — the hub's four section tiles reused verbatim (`components/hub/HubTiles` + `logic/hubCounts`, wrapped in a `.tud9` scope div for the grid CSS; `.kr9-kirakat.tud9` neutralizes the hub page's bottom padding). Same honest per-tile loading/error/off dashes as the hub (never an invented zero); the first tile reads **„Tények rólad”** (`factsTitle` override — a tile called „Rólad” on the Rólad page would point at itself). A tile doors into `/mezo/knowledge?view=<key>`. The facts Loadable reuses `useRoladInbox`'s knowledge state; people/observations/effects come from the same hooks the hub uses.
4. **Doors** — „A csapat képe rólad, dimenziónként →” (`/mezo/karakter/dimenziok`), **„Életesemények” (`/mezo/rolad/eletesemenyek`, S6c)**, „Így beszélj velem” (`/settings/mezo/communication`), „Kapcsolatok” (`/mezo/knowledge?view=kategoriak`).
5. **Footnote** — `ROLAD_COPY.note` as a quiet line (`kr9-quiet`), no longer a glass box.

**`/mezo/rolad/eletesemenyek` (`pages/RoladLifeEventsPage.tsx`, S6c)** — the life-event timeline's own subpage: tf-dhead (‹ Rólad), a lede, then `components/rolad/RoladTimeline.tsx` (accepted `LIFE_EVENT`/`SEASON` graph nodes, excluding the profile node, one amber glass card, newest `occurredOn` first; SEASON dates as a Hungarian quarter). On this page an empty list renders `ROLAD_COPY.lifeEventsEmpty` (`showEmpty`) — never a blank page; embedded elsewhere the empty section stays absent. `RoladFacts` and `topRoladFacts` were deleted with S6c.

The user-facing sentences and picks are pure, unit-tested helpers in `logic/roladCopy.ts` (`pickQuoteClaim`, `factOwnerTag`, `candidateByline`, the fold/kirakat/life-event strings) — no copy is composed inline in the components.

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

**The engine's own two statuses (Reflexió S2 `mezo-eq85.2` buckets, S6 `mezo-eq85.6` copy).**
`refuted` and `dormant` are verdicts the *reflection engine* reached, not the user: `refuted` ⇒
the **`noRelationship`** bucket (a real "we looked, it did not hold" answer), `dormant` ⇒
**`gathering`** (not a failure — it is parked for lack of data). Both win outright over a live,
strong pair, exactly like a user verdict. Because the bucket headline is the *statistical* reading
("nincs kapcsolat" / "még gyűlik"), the **row** says who spoke: `engineStatusCopy(status)`
(`logic/lifecycle.ts`) returns `Megnéztük — nem igazolódott` for `refuted` and
`Pihen — várom az adatot` for `dormant`, and `PatternsPage` prefers it over the finding/gate
sentence on those two tiles. Every other status returns `null` — there the finding line is the
honest one.

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
`mezo-d20.5.1` every page in the tab is like it. Every branch (loaded, pending, error, not-found)
renders inside `PatternFrame` → the shared **`DetailFrame`** (`components/DetailHero.tsx`).

**Üveg (Üvegesítés U8a, `mezo-me75u.13`; parity: `docs/design_2.0/prototypes/uveg-uzenofal.html`
`#minta/*`, `#elore/*`, `#kiserlet-oldal/*`, owner OK 2026-09-24).** The pattern, prediction and
experiment detail pages still share the outer shell from `components/DetailHero.tsx`: `DetailFrame`
(the kit's glass back pill `PageHead glass` + a quiet right-aligned eyebrow „Minta részletei" /
„Előrejelzés" / „Kísérlet", an `EntranceGroup` body with 64px end padding so the last card clears
the glass bar and FAB), `SectionHead`, and `DetailState` (dashed empty / error / loading). **Since
the `mezo-rstt7` rewrite the pattern page no longer uses `DetailHero`/`StatePill`/`DayRing`/
`DecisionRow`/`DecisionNote`** — those stay `DetailHero.tsx` exports used only by the prediction and
experiment detail pages now; the pattern page's own hero, day meter and decision block are
`PatternAnswerHero`/`PatternLeanMeter`/`PatternDayPips` (below), with the state pill moved out to
`PatternFrame`'s `aside` slot (`StatusPill`, off the raw `PatternRowStatus`, not `DetailTone`'s
generic `StatePill`). Everything below the hero is a flat panel (`.pdt-flat`, `.pdt-fold`); the
evidence log is upright prose (bible U23). CSS: `prototype.css` `── uveg mezo mibol (` (guarded in
`prototypeCssStructure.test.ts`); the old Mozaik-wash `.pdt-*` blocks were deleted with it.
**Back goes where you came from** (owner, 2026-09-24): `useBackTo(fallback, label)`
(`shared/hooks/useBackNav.ts`) pops history when there is an in-app entry behind the page (the wall,
a list, a room — the label then reads the neutral „‹ Vissza", since the origin is not knowable from a
plain link) and, on a direct open (`location.key === 'default'` or the browser router's
`history.state.idx === 0`), navigates to the list with its search params and names it
(„‹ Minták" / „‹ Előrejelzések" / „‹ Kísérletek"). Reached from the dashboard's „Részletek és előzmények →" (decision cards, §2.1 step 2) and
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
warmed the query on the way in). **States:** `isPending` → dotted `DetailState` („A minta
betöltése…", `role=status`); a genuine fetch failure (`isError`) → dashed `DetailState` + „Újra"
(`refetch`, `role=alert`); successful pair detail → the rich story flow below;
pair 404 + a persisted pattern with the same `pairKey` → `PatternArtifactDetail`; only a key absent
from both reads becomes the honest dashed „Nincs ilyen minta." state. The fallback's proposed row is
a glass hero (confidence pill, „Amit eddig látunk" + the saved mechanism, the three-decision
explainer and the decisions — the list's `PatternDecisionCard` is no longer reused here); judged
rows receive a read-only status hero plus only their saved mechanism/evidence and an explicit
explanation that no chart is available. It never invents
paired days, history or statistics.

**Újramesélve — EGY olvasat, EGY elrendezés (`mezo-rstt7`, 2026-09-27; normative visual spec:
`docs/design_2.0/prototypes/uveg-minta-body.html`).** The six-block catalog layout and the separate
laborfüzet branch below are gone. Every row — catalog pair or self-proposed hypothesis, with or
without a `testPlan` — now reads through **one pure function, `logic/patternReading.ts`'s
`readPattern`**, and renders through **one component tree**. `HypothesisStateCard`,
`PatternDetailHero`, `TestPlanTiles`, `PatternEvidenceChart` and `PatternStrengthChart` are
**deleted**; their jobs are folded into `PatternAnswerHero`, `PatternZoneChart` and `PatternRuleCard`
below (or absorbed into `readPattern` itself, which needed no visual counterpart).

**Top to bottom:**

1. **`PatternAnswerHero`** — the page's one frameless hero (no `.glass` card, a halo instead): a
   domain-chip pair row (`A → B`), the question in small type (`pair.questionHu` or
   `patternHeadline`), then the **answer as the heading** — one Hungarian word or short phrase from
   `answerLook` (see the state table below), a matching Clay icon and tone. Under it, `saySentence`
   writes the one sentence of evidence prose (group averages, day count, direction), and — only
   while the state is `kerdes`/`gyulik` — the latest `observation` event's first paragraph, quoted
   as „AMIBŐL MEZO FELVETETTE". Then either **`PatternLeanMeter`** (once a `now` reading exists) or
   **`PatternDayPips`** (day tally vs `minN`, while still `gyulik`) — **neither** while a binary
   pair is short on one day group (`reading.groupsShort`: one 0/1 group under
   `requiredPerGroup ?? 3`, or the gate says `imbalanced_groups`). Then the sentence carries the
   news instead („**8** hétköznapi nap mellett még csak **1** hétvégi nap van. Mindkét fajta napból
   legalább 3 kell…", built from `reading.groups` so it works on frozen rows too) and `minN` is
   never cited anywhere. The meter's lit side comes from the reading state (`leanSide`), not its
   own threshold. Binary sentences use the group's day adjective („A hétvégi napokon az …",
   „Az említéses napokon …"). Last, the decision block —
   buttons, a settled line, or the quiet „Mégsem igaz rám — visszavonom" link — driven entirely by
   `decisionPlan(reading, status)`, never by ad-hoc JSX conditions; it is omitted outright for a
   catalogue pair with no persisted row (`pattern == null`).
2. **„Mit mutat az adat" → `PatternZoneChart`** — the page's one glass card, a two-zone SVG: binary
   A metrics split into two fixed columns (jittered points, no false continuous axis), continuous A
   metrics split at the median into a lo/hi zone; both draw a zone-average label only once
   `reading.dayCount >= reading.minN`, no group is short, and the state is not `gyulik`/`allo`/
   `kerdes` (an average from too few days would overclaim; the note under the chart says when it
   will appear). Dot labels, tooltip and table use the human date and a decimal comma.
   Every dot is a `role="button"`, tappable (or Enter/Space) to open a small tooltip with that day's
   two values. **Selection is the chart's OWN `useState`**, not page or router state: a tap never
   re-runs the page's entrance animation and never moves scroll (see the style-bible lesson below).
   Under 2 aligned days the page shows the honest „Még egy közös nap sincs" empty state instead.
3. **„A szabály" → `PatternRuleCard`** — a flat (non-glass) card stating the **pre-registered**
   rule (`ruleSentence`, built from `testPlan` when present, else the catalogue pair — never from
   today's numbers, so a look at the result can't retroactively reshape the hypothesis), plus a
   chip row: day progress (`n / minN`, or `n nap · elég` once past it), the lag word (`lagWord`,
   „aznap" / „másnap" / „N nappal később") and the window (`windowDays` nap).
4. **„Ami eddig történt" (`HistoryFold`)** — a `<details>` fold: a plan-driven (reflection) row
   shows `EvidenceLog`; everything else shows the catalogue's `PatternJournal`; both empty ⇒ one
   honest „Még nincs jelentős esemény" line. Unchanged from before this rewrite.
5. **`PatternImpactCard`** — unchanged: renders only for a persisted pattern or actual impact
   (fact/predictions/experiments/challenges).
6. **„Számok, ha érdekel" (`Diagnostics`)** — unchanged fold: window, paired days, group ratio,
   last calculation, sources, and a nested „Technikai számok" disclosure for raw `r`/`n`/`p`. Its
   window/`lastComputedAt` are still **passed in by the page**, not read off the pair monitor — a
   plan-driven row shows `testPlan.windowDays` / `pattern.lastDetectedAt` (its own nightly run has
   its own window), a catalogue row shows `monitor.lookbackDays` / `monitor.lastRunAt`.

**The reading states (`ReadingState`, `logic/patternReading.ts`).** `readPattern` maps
`{pair, pattern, days, events}` to exactly one state; `answerLook` turns a state (plus the
persisted `status`) into the Hungarian answer word, tone and icon the hero shows:

| State | Meaning | Answer word (`answerLook`) |
| --- | --- | --- |
| `kerdes` | no aligned days yet | „Még csak egy kérdés" |
| `gyulik` | collecting (`few_days`/`imbalanced_groups`/under `minN`) | „Még gyűjtöm" |
| `allo` | the compared metric never moved (`degenerate`) | „Nincs mit összevetni" |
| `nincs` | enough days, `\|support\| < 0.15` | „Nincs összefüggés" |
| `halvany` | weak support in the expected direction | „Halvány jel" |
| `halvanyFordit` | weak support against the expected direction | „Inkább fordítva" |
| `fordit` | the 90% band sits fully against the expected direction | „Épp fordítva" |
| `eros` | the 90% band sits fully in the expected direction | „Erős jel" |
| `elvetve` | `pattern.status === 'rejected'` | „Elvetetted" |
| `elengedve` | `pattern.status === 'refuted'` | „Mezo elengedte" |
| `pihen` | `pattern.status === 'dormant'` | „Pihen" |

On a **`confirmed`** row `answerLook` overrides the plain word with a status-aware one instead
(`eros` → „Tartja magát", `halvany` → „Azóta gyengült" / „Halvány maradt" (see below), `nincs` → „Az adat nem igazolja", `fordit`/`halvanyFordit` → „Most ellentmond",
`gyulik`/`kerdes` → „Még alig mért", or „Kevés az egyik fajta nap" when a binary pair has
enough days but one group is short; `allo` keeps „Nincs mit összevetni" with a „Várjunk" note
and no recommended revoke; „Azóta gyengült" only when today's support is truly below the
decision-time one) — the confirmed word always names how *today's* live data
compares to the belief already in the Tudástár, never repeats the plain discovery word.

**The lean band — the „merre húz" meter's math.** `lean(r, n, dir)` turns a Pearson `r` into a
`Lean {r, n, support, lo, hi}`: `support = r * dir` (the raw sign flips so support always reads
positive when the data agrees with the hypothesis' own expected direction), and, for `n > 3`, a 90%
Fisher-z interval around it — `z = atanh(support)`, `se = 1 / sqrt(n - 3)`, `k = 1.645` (the 90%
critical value, `Z90` in the module) — giving `lo = tanh(z − k·se)`, `hi = tanh(z + k·se)`. `classify`
then reads the band: `lo > 0` → `eros`, `hi < 0` → `fordit`, `|support| < 0.15` (`FLAT`) → `nincs`,
else `halvany`/`halvanyFordit` by the sign of `support`. `PatternLeanMeter` draws `support` as a dot
and `[lo, hi]` as the shaded band on a fixed −1..+1 track (labelled „Épp fordítva" / „Nincs hatás" /
„Igaz rád"); a `then` reading (see below), when present, draws as a lavender ghost dot alongside it.

**Revoke ≠ delete.** The confirmed hero's only action is the quiet „Mégsem igaz rám —
visszavonom" link. It calls the exact same `usePatternActions().decide(pattern.id, 'reject')` any
other reject button calls — there is no separate revoke endpoint or FE code path. This retracts the
pattern's node from the knowledge graph (the row's `status` becomes `rejected`, so it drops out of
"beépült" everywhere), but it does **not** delete a Tudástár fact that decision already promoted —
a fact, once written, is not retroactively un-written by revoking the pattern that produced it.
(Re-confirming later would need a fresh `confirm` decision; nothing here resurrects the retracted
node automatically.)
Revoking is **two-tap** (owner, 2026-09-27): every revoke control on a confirmed row (the quiet link,
the "Visszavonom" decision button, and the saved-insight page's link) is `RevokeConfirm`
(`components/PatternAnswerHero.tsx`): the first tap only opens "Biztosan visszavonod?" with the
honest consequence line (the Tudástár sentence stays, delete it there) and "Igen, visszavonom" /
"Mégse"; only the second tap calls `decide(…, 'reject')`.

**Where „most" and „amikor megerősítetted" come from.** `reading.now` is always computed **live in
the FE** from the `days` the detail read returns — even for an already-`frozen`/`confirmed` pair,
the meter's dot moves as new days come in, because `pearson(days)` and `lean(...)` re-run on
whatever `days` the page currently holds; the backend's own frozen `pair.r`/`pair.n` are used only
as a fallback when `days` is empty (`readPattern`'s `frozen` branch calls `pearson(days)` itself).
`reading.then` — the ghost dot / „amikor megerősítetted" — is the **frozen** snapshot from the
moment of confirmation: for a statistical (non-plan) row that's `pair.r`/`pair.n` as frozen by the
backend at decide-time (`pair.verdict === 'frozen'`); for a **reflection/plan row** (no such freeze)
it is instead the last event with both `r` and `n` set that occurred at or before the `confirmed`
event (`thenLean` walks `events` for the latest `r != null && n != null` row not later than the
confirmation stamp) — i.e. the last numbered data point Mezo actually saw before you confirmed.

**A `people:`/`topic:` presence series is binary everywhere it is read.** `metricFormat`'s
`isPresenceSeries` is the single predicate: `formatMetricValue` renders it `igen`/`nem` (never a raw
`0`/`1` in the „Napok listája" table), `axisEndLabels` gives `nincs említve` / `említve`, and
`binaryGroupLabels` the group copy.

Mock seed: `ref-anna-sleep` (`data/insights/insights.ts` — the row, its test plan and a synthetic
pair detail with eight events — three live evidence nights plus two silent ones that collapse to a
single log row — and 16 aligned days), served in real mode by the shared MSW default for
`GET /api/companion/pattern/pair/:pairKey` so both modes read the same hypothesis.

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

### 2.4 Tudástár (`pages/KnowledgeListPage.tsx`) — **the four-section hub, S6 `mezo-d6ivw.6`; real dual-mode since companion V1.2; egyesített Tudástár+Tudásgráf `mezo-ms9a`, 2026-09-01; approval inbox moved to Rólad U9b `mezo-zpxv7`, 2026-09-26**

At `/mezo/knowledge`, reached from the Tudástár/Kapcsolatok door. **S6 (`mezo-d6ivw.6`, 2026-09-27)
replaced the old fact-only page with a four-section hub**: **Rólad** (facts), **Emberek** (per-person
facts), **Észrevételek** (confirmed observations + the fact each one taught) and **Hatások** (named
person/event effects) are now four equal doors off one hero, instead of "the Tudástár is a fact list
plus a Kategóriák door". The **`FactsView`/`KnowledgeFactRow`** components the pre-S6 fact-only
surface used are **RETIRED** — their fact-list behavior lives on as the **`TenyekSection`** hub
section (below), and their card is now `HubRow`, shared by all four sections.

**`KnowledgeListPage` loads all four hub sources up front** (`useKnowledge`, `usePeople`,
`useKnowledgeObservations`, `useEffectSubjects`) — there is no page-wide loading/error/degraded
early return any more; each section owns its own pending/error/degraded state and renders it inside
its own tile/body. `useForgetUndo()` (§ "The undo window" below) lives once per page, so a forget
started in one section keeps its countdown running when the user navigates back to the hub or into
a different section. Kategóriák/Hogyan (the graph kind-chain and the explainer) are unchanged from
before S6 and keep their own paragraphs below.

**`?view=` map** (`useSearchParams`-derived, no local view state, every back-chip `replace: true` —
the `mezo-ni86` one-back-affordance idiom):

- **absent/invalid → base** (the hub: hero + four section tiles + quiet links to Kategóriák/Hogyan
  and, when a candidate is pending, the Rólad decision pointer — `KnowledgeBaseView`).
- **`tenyek`** — the Rólad section, `TenyekSection`.
- **`emberek`** (+ **`&person=<id>`**, S6) — the Emberek section, `EmberekSection`; an id the loaded
  person list does not know reads as the plain list, not an error.
- **`eszrevetelek`** (+ **`&obs=<patternId>`**, S6 — the Rólad "észrevételből" tag's target) — the
  Észrevételek section, `EszrevetelekSection`; the target pattern's topic opens, its row is
  highlighted, and the status filter starts at **Mind**. Read on every render (an in-app link does
  not remount the page) and keyed on the value so a new target re-runs the section's opening state.
- **`hatasok`** — the Hatások section, `HatasokSection`.
- **`kategoriak`** (+ `?kind=`) — unchanged from pre-S6 (see below).
- **`profil`** — unchanged redirect to `/settings/mezo/communication`.
- **`hogyan`** — unchanged (see below).
- **`?fact=<id>`** (T10 deep link, unchanged) — still overrides the view to `tenyek` and opens/
  highlights that row; the one-shot mount capture and URL self-clean are unchanged from before S6.

**The hero** (`KnowledgeBaseView`) shows one number: everything Mezo knows, an observation and the
fact it taught counted **once** (via the fact — `hubCounts.ts`, `logic/hubCounts.ts`), split into
**bekapcsolva**/**elhallgattatva**, with an honesty note (`heroNote`) that changes when a section is
switched off (companion off ⇒ the number counts only Emberek) or partially unavailable (some
section failed to load ⇒ the note says so). **No section that failed to load, is still loading, or
is switched off contributes to the count — never an invented zero**; if NO section counted, the
hero shows why (`Betöltés…` / `Most egyik szakaszt sem sikerült betölteni.`) instead of a number.
The four **section tiles** (`HubTiles`) mirror the same rule per section: `ok` (a real count + a
one-line sub e.g. "N bekapcsolva · M elhallgattatva"), `loading`, `error` (with its own retry), or
`off` (companion switched off) — a non-`ok` tile is dashed with an em dash, never `0`.

**The verb contract — the SAME four Hungarian verbs across all four sections** (`logic/hubCopy.ts`
`VERB`), rendered by the shared `HubRow`/`HubActs`:

| Verb | Meaning | Reversible? |
|---|---|---|
| **Honnan tudom?** | expands the row's evidence (lazy-fetched — `useFactEvidence`/inline observation evidence) | — |
| **Javítom** | edit the fact's/person-fact's text inline (facts + Emberek only; observations/effects are computed, not editable) | n/a |
| **Elhallgattatom** | mute: kept, excluded from the prompt/every "active knowledge" surface, flagged **Elhallgattatva** with a WHY (`whyText`/`WHY_ICON` — `te hallgattattad el` / `később nem igazolódott` / `felülírta egy újabb észrevétel`) | ✅ **Visszakapcsolom** |
| **Elfelejtem** | permanent forget — gone for good, never re-learned from the same source | ❌ no restore endpoint (see "The undo window" below) |

`stripNote(kind)` renders the small print next to the two destructive verbs, worded per row kind
(`active` — "Elhallgattatva megőrzöm… Elfelejtve törlöm — pár másodpercig visszavonható";
`muted` — the plain "megőrzöm, de semmire nem használom"; `effect` — computed effects have no
"pár másodpercig visszavonható" clause, since a mute/forget there does not delete a row, it flips a
flag). Backend semantics, the veto and every reader that must honour a forget/mute: [`companion.md`](companion.md)
"Elfelejtem/Elhallgattatom".

**The undo window — the ONLY undo, and it is time, not a server round-trip** (`hooks/useForgetUndo.ts`).
"Elfelejtem" on any row starts a **5 s** countdown (`UNDO_MS`, `ForgetUndoBar` — a glass bar fixed
above the tab bar with a draining fill + a live countdown number, a reduced-motion branch that steps
once per second instead of animating continuously) during which the row is hidden
(`isHidden(rowKey)`) but nothing has been sent yet. **Visszavonom** cancels it — the row reappears,
nothing was ever requested. Letting it run out, or starting a NEW forget while one is pending
(`commitNow(false)` fires the outstanding one first), sends the actual `DELETE`/forget request —
**exactly once**, and **only then**. **Unmounting the page while a forget is pending commits it too**
(the hook's cleanup effect calls `send` on whatever is still in `ref.current`) — leaving is not an
undo, it is the same as letting the timer expire; this is a deliberate policy, not an oversight: a
forget-by-delay design that let navigation silently cancel the request would mean a user's
"Elfelejtem" sometimes never happens. A failed commit shows an honest rollback toast
(`TOAST.forgetFailed`/`muteFailed`) rather than the success toast — the four sections' writes are
**optimistic with rollback** (`useKnowledgeHubActions`/`useForgetUndo`'s `send`): the row disappears
immediately, and only comes back if the request actually failed.

**`?view=tenyek` (`TenyekSection`, replaces the retired `FactsView`)** — unchanged fact-list
contracts from the pre-S6 `mezo-9ryh` redesign (search + category chips, `humanizeFactText`/
`originSentence`/`reinforcementSentence` from `logic/factCopy.ts`, facts-always since `mezo-d6ivw.8`
— every active fact goes into every conversation, no per-row "in use" marker), now rendered as
collapsible **topic folds** (`HubFold`, grouped by category, muted facts under their own
**Elhallgattatott** fold) instead of the old two-`LifecycleSection` shape, each row a `HubRow` with
all four verbs (**Javítom** opens an inline textarea, accessible name `EDIT_ARIA` — "A tény
szövege"). The `?fact=` deep-link highlight and the search's group auto-open behave as before.
**"Honnan tudom?"** now reads the fact's structured `provenance` (`KnowledgeFactResponse.provenance`)
through the lazy `GET /api/companion/fact/{factId}/evidence` (`useFactEvidence`, S6) — a manual fact
never fetches (no evidence to show); a pattern-sourced fact's card also carries a **"Ugorj az
észrevételhez"** button (`GO_TO_OBSERVATION`) that navigates to `?view=eszrevetelek&obs=<patternId>`.

**`?view=emberek` (`EmberekSection`, new S6 section)** — one row per active person with at least one
fact (from `usePeople()`, shared with [`me.md`](me.md)'s Emberek hub), the person's facts nested
under it; **`&person=<id>`** opens that person's own sub-view (its own `TudasFrame` back-chip
returns to the Emberek list, not the hub) — the search box carries a matched query into the person
sub-view (the prototype's `data-pq` carry, `onOpenPerson(id, carry)`) so opening a person from a hit
keeps the filter. Facts here use the SAME four verbs — **Javítom** calls `PersonFactService.update`'s
`factText` field (S6, [`me.md`](me.md) §3 has the endpoint), **Elhallgattatom**/**Elfelejtem** the
`includeInPrompt` toggle / `DELETE`. A muted person fact's WHY is always `te hallgattattad el` (a
person fact has no pattern-refutation/drift-supersession path).

**`?view=eszrevetelek` (`EszrevetelekSection`, new S6 section)** — confirmed (and refuted-but-still-
fact-bearing) observations from `GET /api/companion/observation/knowledge` (S6), grouped into six
fixed **topics** (`logic/hubTopics.ts` — Alvás/Edzés/Étkezés/Kapcsolatok/Hangulat/Egyéb; a
person-topic observation is always **Kapcsolatok**, otherwise the majority RAW evidence source
wins, `Egyéb` on a tie/no-evidence — deterministic, ties broken by topic order). **A slice-lesson
trap:** the topic grouper reads `evidenceSources` — the evidence items' raw wire `source` values
CAPTURED BEFORE `mapEvidence` renamed them to their display label (e.g. `check_in` → "Check-in") —
because any FE logic keyed on the catalogue source must run before that rename, not after. Four
status chips (`OBS_FILTERS` — Mind/Még igaz/Felülírva/Elhallgattatva, `logic/hubCounts.ts`'s
`obsState` is the single source of truth both the tile sub and these chips use) filter within a
topic. **Drift pairs** (a quarterly recheck confirming "still true, but differently") render both
halves: the newer with a gold **"KORÁBBAN · MEGERŐSÍTVE …"** eyebrow is absent, the older with
`DRIFT_EYEBROW.older`/`.bothOn` when the user re-enabled it too. **`&obs=<patternId>`** opens that
observation's topic, highlights its row, and resets the filter to Mind. Each row's own evidence
(capped at **`ROW_EVIDENCE_LIMIT` = 5**, [`companion.md`](companion.md) lesson 3) renders through
the shared `EvidenceList` — never re-parsed client-side.

**`?view=hatasok` (`HatasokSection`, new S6 section)** — one card **per SUBJECT** (a person or one
of the six fixed event keys), never per metric row — `groupEffectSubjects`
(`data/insights/knowledgeHubApi.ts`) re-groups the flat wire (one row per subject×metric) before the
section ever sees it, because a mute/forget action targets the whole subject. Grouped into
**Emberek**/**Események**/**Elhallgattatott** (`EFFECT_GROUPS`), each card rendering the SAME
`EffectRows` component and `effectCopy.ts` sentences the person page's "Hatás · együttjárás" card
uses ([`me.md`](me.md) §2/§10 — shared, not duplicated). **Elhallgattatom** here mutes the WHOLE
subject (`PUT .../effects/{kind}/{key}/mute {mode: muted}`) — survives the nightly recompute,
reversible; **Elfelejtem** sends `{mode: forgotten}` — permanent, no unmute. A muted subject is
flagged here (unlike the person page, which simply omits it, [`me.md`](me.md) §2) since this is the
ONE surface with an unmute action.

**`?view=kategoriak` (`KategoriakView`, unchanged since `mezo-ms9a`)** — the former `KnowledgePage`
overview-first kind-chain, one level in: `kind === null` → `KindTileGrid`; `?kind=<GraphNodeKind>`
→ `KindNodeList` + `CategoryHeader`; a row → `NodeDetailSheet`. Tone `lav` (a deliberate switch from
the hub's `sage`), back-chip "‹ Tudástár" / "‹ Kategóriák" in the kind-drill.

**Communication profile:** managed by `MezoPersonalPage` in central settings (`?view=profil`
redirects there); unchanged by S6.

**`?view=hogyan` (`HowItWorksView`, unchanged since `mezo-ms9a`)** — the six Q&A blocks, a `?`-chip
opens it from any view.

Real mode on the companion switch-off 404 still gives the honest degraded banner
(*"A társ jelenleg nincs bekapcsolva…"*), scoped per section exactly as the hero/tiles are (§ above)
— the graph hooks' (`useLifeEventCandidates`/`useKnowledgeGraphNodes`) own 404 semantics stay
independent of the companion switch, unaffected by S6.


### 2.5 Chat (`pages/ChatPage.tsx`) — ✅ REAL since companion V0.4 (chips real since V0.5)
At `/mezo/chat`. **Not a tile — the hub's composer-shaped opener is its door** (§2.0), which is the point: the chat is the companion, so it sits above the directory rather than in it. The page renders its own „Mezo · társ" header (a `ClaySpot` orb since Design 2.0); since `mezo-oq8z` this is the route's **only** header — `AppLayout` suppresses the generic shell `AppHeader` here, and `.mzc-chathead` sticks directly at `top: 0`, eliminating the former double-header stack without removing any conversation controls. The companion conversation is **dual-mode** over `useChat(selection)` + `useChatActions(selection, onCreated)` + `useConversations()` (from `@/data/hooks`; backend + hook details in [`companion.md`](companion.md) §3/§5.1). Header: "Mezo · társ" + an **honest mode subtitle** (`demo beszélgetés` / `Gemini · élő` / `új beszélgetés` / `a társ most nem elérhető`) — the Phase-1 fake "`23 facts active`" string and "L4 aktív" chip are gone — plus two chip actions: **Beszélgetések** (opens `sheets/ConversationPickerSheet.tsx`) and **Új beszélgetés**. **Real mode:** bootstraps the selected conversation + history, `send()` renders the optimistic user bubble + thinking-dots, then the answer **streams in** (SSE deltas into a draft bubble) and the persisted pair lands in the `['chat', <selection>]` cache; stream failure → inline error bubble + history refetch; companion switch off (404) → degraded banner (`A társ jelenleg nincs bekapcsolva…`) + disabled composer, no dead-end (IDENT-3). **Mock mode:** the Phase-1 demo — `initialChat` seed + the 1.2s `cannedReply` (branches on `"fáradt"`, fabricated `tools`/`refs`). Only the seeded `mock-conversation` carries that transcript: a conversation started during the session opens EMPTY and gets its own auto-title from the first message, exactly as it would against the backend (`mockThread()` in `chatHooks.ts` — returning the seed for every id made new mock threads inherit the demo's messages). **„Emlékek · N" — the recalled-memory disclosure row (`components/RecalledMemoriesRow.tsx`, `mezo-6dii.7`).** An answer assembled from the shared memory platform ([`companion.md`](companion.md) §4) carries its retrieved items as a collapsed row under the bubble; opening it lists each item with its kind label and a door to the source. In **NEW serving mode** each card that carries a stable audit id also gets a feedback group (`role="group"`, „Visszajelzés erről az emlékről"): **hasznos / nem releváns**, and — only for candidates that have a canonical `memory_item` — a **two-tap suppression** (the second tap reads „Biztosan ne használd többé?"). Suppression flips the canonical item to `suppressed` so every later retriever skips it; **nothing is deleted** — neither the source record nor its audit history. Fact and graph candidates have no canonical item, so they keep useful/irrelevant and are never offered suppression (the API rejects such a request too). The page batch-loads the feedback state for the newest 100 visible result ids in ONE request (`data/insights/memoryFeedbackHooks.ts`) and writes optimistically with rollback on failure; a pre-rollout card with no retrieval id stays **display-only** rather than rendering a dead control.

**Conversation actions + the error bubble's hands (F7.5, `mezo-d20.8.5.1`).** The header grew a third disc — **⋯ „A beszélgetés műveletei"** (disabled on a draft thread / degraded) — and every picker row a **kebab** (`onActions` prop): both open `sheets/ConversationActionsSheet.tsx` for that conversation. **Átnevezés** = inline input (prefilled, Enter/Mentés, NO confirm — reversible) → `useConversationActions().rename` (`PATCH /api/companion/conversation/{id}`; mock leg rewrites `CONVERSATIONS_KEY` in place). **Törlés** = two-step warm confirm („…a belőlük tanult emlékeket ez nem érinti." — ADR 0010, a decision not a mistake) → `remove` (`DELETE`, soft server-side; invalidates the list + BOTH `['chat','newest']` and the id-keyed thread cache), and deleting the on-screen conversation moves `?c=` off the dead id. The **error bubble** (amber `.mzc-bub-err`, a hiccup not a scolding) now keeps the failed turn: `useChatActions` retains `failedText` past the `finally`, and the bubble renders **Újra** (`retry()` — re-sends the same text, *replace don't append*: no duplicated user bubble) + **Szerkesztés** (`editFailed()` → the text lands back in the composer). The AI-SDK regenerate state model, adopted per the F7.5 recon.

**Which conversation is on screen (`mezo-at8x.3`)** lives in the URL: `?c=<uuid>` a persisted thread, `?c=new` an unsent draft one, no param the newest. A draft thread shows a one-line invitation instead of a blank page and only becomes a server row **on the first send** (lazy create → `onConversationCreated` moves `?c=` onto the new id), so opening "Új beszélgetés" and walking away leaves nothing behind. The picker sheet lists the persisted conversations newest-first with their server-side auto-title (first user message, truncated) and a `ma/tegnap/<hó nap>` stamp.

**Scrolling + composer (`mezo-at8x.2`).** The chat rides `.screen-content`, the single app scroller, so `logic/useStickToBottom.ts` drives *that* element **inside a rAF** — `ScreenContent` resets it on every route change and a parent's effect runs *after* its children's, so a scroll issued straight from ChatPage's effect gets undone on the way in. Every scroll uses **`behavior: 'instant'`**: `.screen-content` carries `scroll-behavior: smooth`, which a bare `scrollTop =` (and `behavior: 'auto'`, which per spec defers to the CSS value) inherit — and a smooth scroll in this container is cancelled by the next scroll operation, so it lands nowhere. `ScreenContent` itself was switched to an instant `scrollTo` for the same reason (its animated reset was eating the chat's scroll-to-newest). A `ResizeObserver` re-anchors while the user is parked at the bottom, which covers both late layout (fonts/cards) and a streaming answer; a 500 ms settle window keeps a programmatic scroll's own events from reading as "the user scrolled up". Opening a thread parks on the newest turn, and a streaming answer only pulls the view down while the user is within 96 px of the bottom. The composer is `.chat-composer` — `position: sticky; bottom: var(--screen-bottom-pad)` — pinned right above the tab bar; `.chat-page`/`.chat-thread` turn the page into a column so a two-message thread keeps it at the bottom instead of mid-screen.

**Entry points + mid-workout switching (`mezo-78sd`).** The chat is one tap from anywhere: the shell-level `FloatingReturnLayer` ([_platform-design-system.md](_platform-design-system.md) §5 integration table) renders a lavender chat bubble on every route (including the full-bleed `/train/session`, which has no tab bar), on top of the older two-tap path (center FAB → QuickInputSheet chat row). While a gym workout is open, the same layer swaps its bubbles on THIS page for a coral `.float-return` "Vissza az edzéshez" bar floating above the composer (workout title + done-set count → `/train/session`) — the chat-during-workout loop is two one-tap jumps. The bar is shell chrome (positioned off `--screen-bottom-pad`), not part of ChatPage; nothing in this page's code knows about it.

**Composer:** mic button (**live since `mezo-at8x.4`** — `logic/useVoiceInput.ts`: `getUserMedia` + `MediaRecorder` → 16 kHz mono WAV (`shared/lib/audio.ts`) → `useTranscribe()` → the transcript is **appended to the input, not sent**, so the user checks it first; recording state = coral chip + `voice-wave` icon + `Hallgatlak…` placeholder, then `Leiratozom…`; unsupported/denied mic → disabled button or an honest one-liner), controlled **auto-grow `<textarea>`** (`mezo-a837`): `rows=1`, and a layout effect re-measures it on every draft change through the shared **`autoGrow`** (`shared/lib/autoGrow.ts`; the old fixed 104 px / ~4-line cap is gone — it trapped a dictated paragraph in a box too small to scroll): the field grows with its text up to **40 % of the viewport**, then its own `overflow-y: auto` takes over. The same helper is installed app-wide in `main.tsx` (`installAutoGrow`: capture-phase `input` + `focusin` listeners, plus a wrapped `HTMLTextAreaElement.prototype.value` setter that queues a next-frame resize — so text written by code, e.g. dictation or a prefilled draft, grows the field without a tap), so **every** textarea (sheets, reply fields, journal…) keeps its designed height as a floor and grows the same way; a field opts out with `data-autogrow="off"`. Covered by `autoGrow.test.ts` + the `tests/layout/textarea-autogrow.spec.ts` real-browser invariant — a long message **wraps and stays fully visible** instead of scrolling sideways out of view, which the old single-line `<input>` did. **Enter sends** (unchanged), **Shift+Enter breaks a line**, and an IME composition swallows neither; the composer row is `align-items: flex-end` so the mic/send chips stay pinned to the bottom edge while the field grows. Send button. **`ChatMessage`** (`components/ChatMessage.tsx`): user bubbles right-aligned (`white-space: pre-line`); assistant bubbles left, the answer rendered through **`<Markdown>`** (`shared/lib/markdown.tsx`, `mezo-at8x.1`) as real blocks — paragraphs, `-`/`1.` lists, `##` headings, inline bold/italic/code — instead of the old single `<p>` that printed the model's `**` marks literally and collapsed its line breaks; preceded by a `ToolWorkStrip` and followed by a "Hivatkozott · L3" footer of `RefTag`s when `refs` present — **real data since companion V0.5**: tool-using turns arrive with `tools[]` (`{type:'read', name:'get_recovery(scope=sleep, days=3)'}` — args baked into the name) and tool-contributed `refs[]` (kinds: `Workout`/`Sport`/`Run`/`WeightTrend`/`Sleep`/`FuelDay`/`Protocol`/`Goal`/`Medication`, plus more since V2.3/mezo-xixu — full kind catalog in [`companion.md`](companion.md) §4); **since mezo-280 chips also render live on the in-flight draft bubble** — each `tool` SSE event appends onto `ChatTurn.tools` as the tool executes, instead of appearing all at once after the answer; the draft (chips included) is still discarded wholesale when the terminal `done` row is appended, so that row's `tools[]` remains the persisted truth. **Since mezo-vdf4 the mounted component is `ToolWorkStrip`, not the earlier `ToolChipRow`**: overlapping domain clay icons collapse into one `Utánanézett · N forrás` strip that expands to a per-source panel, rather than N raw monospace chips. **Since companion S9.7 (`mezo-rj214.7`) each expanded panel row is a provenance card**: the tool's human label, its params, the planner's reason line (`why`, present only on a pipeline turn — see [`companion.md`](companion.md) §3 "Provenance") and the returned text (`outcome`, clamped to 2 lines, tap to expand); a failed step (`failed`) shows a warning mark and still shows its text; a row past the 90-day retention scrub carries no `outcome` but still shows what was asked. **Since companion S9.6 (`mezo-rj214.7`) a `phase` SSE event narrates the pre-answer wait too**: `ChatTurn.phase` (`data/insights/chatHooks.ts`) holds the wire string verbatim (`'planning' | 'retrieving' | 'answering'`), overwritten by each `phase` event as `useChatActions.sendReal`'s `chatApi.streamMessage` callback receives it — a `tool` frame does NOT clear it (chips and the phase label coexist on the draft bubble), only the FIRST `delta` does (`draft: t.draft + delta, phase: undefined`), so the label narrates right up to the moment real answer text starts arriving; a `CHAT`-gear turn never gets a `phase` event at all (companion.md §3), so real mode simply never sets one for it. `ChatPage.tsx`'s `ThinkingDots` renders `turn.phase` via a small `PHASE_COPY` map (`planning` → „átgondolom…", `retrieving` → „megnézem az adataidat…", `answering` → „fogalmazok…") next to the dots; a fallback turn (planner failure) shows only „átgondolom…" before the legacy tool loop answers silently underneath it. **Mock mode's `sendMock`** sets the SAME `phase` sequence itself (optimistic `'planning'` at `send()`, then `retrieving`/`answering` on its own timers, `undefined` once the canned reply lands) for wire parity — so the Hungarian narration renders identically in both modes even though mock mode has no real backend narrating it. **Its canned tools carry `why`/`outcome` too** (`mezo-rj214.7` S9.7 final wave): the mock UI path renders straight off `initialChat`/`sendMock` and never touches MSW, so without that a freshly sent mock answer would expand to label+params only while the seeded answers showed full cards. The seed also keeps ONE deliberately outcome-less read and one `failed` step, so the retention-scrubbed and honest-failure shapes stay visible on the demo surface. Since
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

**Frozen day counts (`mezo-bsb6h`, 2026-09-25; superseded by `mezo-rstt7`'s rewrite — the rule survives, the component doesn't).** On a judged (`verdict: 'frozen'`) pair, `pair.n`/`alignedDays` are the aligned days AT THE DECISION, while the chart and the reading count the CURRENT window's plotted points (`days.length` — see „Where „most" and „amikor megerősítetted" come from" in §2.1b above). The dual-count naming this note used to describe lived in the now-deleted `PatternDetailHero`; today the same discipline is carried by `Diagnostics`' „Párosított nap a döntésedkor” label plus the „Hogyan számoltuk?” disclosure's decision-time numbers — never two bare, different day counts presented as the same thing on one page (üveg bible rule 51).

### 2.9 Memória (`pages/MemoryPage.tsx`) — read-only memory-layer observatory since `mezo-al1i`
At `/mezo/memoria`. **Its door is the hub's `Memória` tile** (§2.0 item 7 — a full-width L0→L3 band until `mezo-e3zg`), which mirrors on the hub exactly the four-layer stack this page unfolds. Its four page-local segments and every panel below are unchanged by Design 2.0; only the cross-links moved onto `/mezo`.
The companion's own memory pipeline made legible: not another results tab, but a transparency page
onto the **L0→L3 memory stack itself** (raw daily metrics → the L1 episodic journal + vectors → the
L2 judgement inbox → L3 durable knowledge) — the spine [`companion.md`](companion.md) documents by
version slice, rendered live. Four **local segments** behind `useStickyTab('insights.memoria.view')`
(`Rétegek` / `Napló` / `Kereső` / `Audit`, a segmented-control bar identical to the
Growth/FuelSlots idiom, `MemoryPage.tsx:77-82`) — this is a **page-local** sub-nav, not a router
route; all four read off two page-level hooks (`useMemoryOverview()`, `useMemorySummaries()`, both
`@/data/hooks`), so switching segments never refetches. A single **degraded card** (companion off →
404 on the overview call) replaces the whole page with a link **directly to** `/mezo/patterns`
(§2.1) — the doc's earlier claim of an extra `/mezo/motor` redirect hop no longer holds; that hop
was removed and the link now points straight at the Patterns dashboard; the
loading window renders `GhostState` — the same loading/degraded/error three-state discipline the
retired Motor tab pioneered, now carried by the Patterns dashboard (§2.1).

- **Rétegek (`components/MemoryLayersPanel.tsx` + `MemoryLayerCard.tsx`):** four wash-tinted
  layer cards top to bottom — **L0** (neutral `text-tertiary` wash: `daysWithAnyData/windowDays` —
  how many days in the pattern-detection lookback window carry data on ANY `MetricKey`; **the
  synthetic `MetricKey.WEEKEND` series is deliberately excluded from this union** — it is a
  calendar-derived 0/1 that never misses a day, so folding it in would always saturate the count to
  the full window), **L1** (`--wash-lav`: `daily_summary` count + `dailySummary`/`chatTurn`
  vector counts (wire field still `embeddings`/`kind`/`count` — since `mezo-eq85.10` counted over
  `memory_item.source_kind` joined to a live serving-version `memory_vector`, not
  `memory_embedding`; same numbers, different source, "vetítés" not "beágyazás" in copy) + the
  first/last summary date — tappable, opens the Napló segment), **L2**
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
  serving-version `memory_vector` projection exists (`embedded: true`, `mezo-eq85.10`), dim
  `--text-tertiary` = not yet vectorized —
  and the full narrative prose. A `focusDate` prop (set by the Kereső segment's `onPick`, §below)
  scrolls the matching card into view via `scrollIntoView({block:'center'})` in a `useEffect` keyed
  on `focusDate`, and outlines it. Empty state: an honest ghost line that the first nightly summary
  hasn't run yet — never demo fiction.
- **Kereső (`components/MemorySearchPanel.tsx` + `SimilarDayCard.tsx`):** a **lazily-submitted**
  search — the query fires on form `onSubmit`, never on keystroke (`useSimilarDays(query)`,
  `data/insights/memoryHooks.ts`, a raw `useQuery` — not `useDualQuery` — gated `enabled: query
  trim non-empty`; mock branch resolves the deterministic `similarDaysSeed` via `initialData`; real
  branch calls `memoryApi.similarDays(query, 3)`, 404→`degraded`). Since the endpoint moved onto
  the memory platform (`mezo-eq85.10`), each **`SimilarDayCard`** renders a decorative ring
  showing the **1-based `rank`** (`"1."`, `"2."`, …, `aria-label` `"N. legjobb találat"`) instead
  of a similarity percent, plus the date/age line and the excerpt — **no score is rendered**. The
  earlier `egyezés × frissesség = végső` three-chip math (`similarity` × a client-derived
  freshness = `finalScore`) is GONE along with the wire fields it depended on: the platform's
  `finalScore` is an RRF number (order of 0.01–0.05), not a 0..1 cosine fraction, so neither the
  percent ring nor the freshness division would have meant anything. Product-owner decision
  (2026-09-19): rank order only, no numbers — see the task's codebase notes §1 for the full
  reasoning (and the one thing that turned out NOT deliverable: labelling the source kind, since
  results are filtered to `daily_summary` and the label would be a constant). Tapping a card calls
  `onPick(date)`, which `MemoryPage` wires to set `focusDate` **and** switch the segment to Napló —
  a cross-segment jump, not a route change. **Three distinct empty-ish states, never conflated
  (`mezo-eq85.10`):** 404 ⇒ the `degraded` line ("A memória-kereső most nem elérhető."); a query
  that genuinely matched nothing ⇒ "Nincs elég hasonló nap a memóriában."; and a query that
  FAILED (the endpoint raises rather than fabricate an empty list when retrieval is down) ⇒ its
  own failure `GhostState`, surfaced by the hook's new `failed` flag. The empty sentence asserts
  something about the user's history, so a failed search must never borrow it.
- **Audit (`components/MemoryAuditPanel.tsx` + `TokenColumns.tsx`):** two independently-degradable
  blocks. **(1) Cost** — a cost-hero (`totals.costUsd`, `$0.000` formatted, `—` when null) plus
  `TokenColumns` (a small stacked SVG bar chart, one bar per day — `--dv-lav` bottom segment =
  input tokens, `--dv-sage` top = output tokens) off `useLlmUsage()` (`GET
  /api/companion/memory/llm-usage?days=30`); **`enabled:false` renders its own explicit "audit-log
  ki van kapcsolva" card** (the response itself says so — not an error state, not the degraded
  banner) — a THIRD honest state alongside loading/degraded/data, because "audit switch off" and
  "companion switch off" are different truths the panel must not conflate. **(2) Provenance** — a direct link to the canonical Tudástár fact list. The audit no longer renders a second editable/readable copy of the user's facts.
- **Degraded ties:** the page-level degraded card (companion 404 on `useMemoryOverview`) covers
  Rétegek/Napló; Kereső and Audit carry their OWN inline degraded lines because their two queries
  (`useSimilarDays`, `useLlmUsage`) are independently lazy/dual-mode — a mid-session companion outage
  can surface per-panel rather than page-wide.

**Known asymmetry since the Motor retirement (`mezo-tk88.4`):** the retired `MotorPage` used to
carry the reverse of the Rétegek footer link — a "Memória-obszervatórium →" line under its
coverage table, making the two read-only diagnostics surfaces mutually reachable. The Motor-retire
task ported only the metric-coverage-ring wiring into the new Patterns dashboard (§2.1), not this
cross-link, so today the link is **one-way** (Memória → `/mezo/motor`, redirecting to
`/mezo/patterns`); a reverse link back to Memória from the dashboard's „Adat-egészség" section is a
small filed follow-up, not yet done. (Design 2.0 repointed both ends onto `/mezo` without
changing the asymmetry.)

### 2.10 Proaktív coaching (`pages/CoachingHubPage.tsx` + `CoachingObserverPage.tsx` + `CoachingCardPage.tsx`) — the decision made visible, since `mezo-6269.3`

Three routes under `/mezo/coaching`, all reading the SAME per-day trace and rendering only what it
already says — none of the three re-ranks, re-scores, or invents a verdict.

- **`/mezo/coaching` (`CoachingHubPage.tsx`)** answers *„melyik szabály nyert, és hogy oszlott meg a
  nap?"*. A `PageHero` with a `VerdictArc` ring over `splitOf(day)`, the winner's poster (rank
  badge + label + reason, badged „Nyertes") when `day.winner` exists, a `StatStrip` of the four
  state counts, and two wide tiles as doors onto the other two routes — one line each
  (`"mind a N szabály, súlyossági sorrendben"` / `"{winner.label} nyerte a napot"`).
- **`/mezo/coaching/megfigyelo` (`CoachingObserverPage.tsx`, "Megfigyelő")** answers *„mit gondolt a
  motor MINDEN szabályról, és miért ezt választotta?"* — every rule in the wire's own order (rank 1
  = most severe first; the page never sorts), each as a `CoachingRuleTile` with a rank badge, the
  domain's clay icon + wash, the closing state, one evidence line and a tap-to-expand `facts` list;
  a validated `?d=` day pager (`isValidIsoDate`, `CoachingObserverPage.tsx:21-26` — round-trips
  through `Date` so both malformed and calendrically-invalid strings, e.g. `2026-02-30`, fall back
  to today rather than silently rolling over); paging back is floored by the server's own
  `day.earliestDate` (`null` while unresolved leaves paging open rather than pretending there is no
  history); and, only when `day.transitions` is non-empty, the day's own timeline (`hh:mm` + label +
  reason, chronological) — an empty day renders no timeline box at all, never an empty one.
- **`/mezo/coaching/kartya` (`CoachingCardPage.tsx`, "A napi kártya")** answers *„mit üzent a motor
  ma, és mit vertem meg vele?"* — the SAME card anatomy the Nap-thread advice message uses (facts +
  suggestions + actions), plus a **„Miért ez nyert"** strip unique to this page: `losersOf(day)`,
  the raises that were on the table and lost, most severe first. That strip is gated on
  `day.winner?.cardId === card?.id` (`CoachingCardPage.tsx:99`) — `card` and `day` are two
  independent queries about (allegedly) the same decision, and if their card ids disagree they
  describe different decisions, so the strip stays silent rather than pairing mismatched data.
  Actions run on the **existing** `useAdviceActions` path (same `ACTION_INVALIDATES` key prefix as
  the Nap-thread advice card) — there is no second write path, and the applied state is
  server-driven exactly as on that card.

**The order is information.** All three pages render `day.rules` in the array's own order and never
call `.sort()` on it — the severity ranking (`AdviceRankPort.rankOf`, [`companion.md`](companion.md)
§3 "Proactive coaching observer S2 — the read endpoint") is a backend concern precisely so there is exactly one ranking in the
codebase. A frontend re-sort would be a second, potentially-drifting ranking.

**The one map: `coachingCopy.visualOf` (`frontend/src/features/insights/logic/coachingCopy.ts:42-59`).**
The server sends `domain` (a string) per rule; this is the ONLY place the frontend turns a domain
into a look — a `Record<string, {wash, icon}>` (`sleep`→lav/`i-alvas`, `training`→coral/`i-edzes`,
`nutrition`→sage/`i-fuel`, `recovery`→sky/`i-hold`, `habits`→gold/`i-lang`, `logging`→white/`i-naplo`,
`body`→rose/`i-suly`) with a `general` fallback (white/`i-mezo`) that also covers any domain string
the frontend does not recognize yet. There is deliberately **no per-`flagKey` map anywhere** in this
feature — `FlagCatalog` on the backend ([`companion.md`](companion.md) §3) already owns the
per-rule `label`/`domain`, precisely so a round-2 flag rule needs zero frontend changes to render
correctly: it just falls into `general` until (and unless) someone bothers giving its domain a
bespoke wash.

**The state vocabulary (`coachingCopy.ts:14-40`).** `stateOf(rule)` collapses the wire's
`outcome`/`disposition` pair into four screen states: `Jelzett` (raised), `Rendben` (clear),
`Nem mérhető` (unavailable), and `Pihenőn` — **not a wire outcome**: it is `outcome: 'raised'` +
`disposition: 'suppressed_by_cooldown'`, i.e. "true, but it spoke recently," the exact case round 1
of this feature discarded silently (a cooldown-suppressed raise used to be invisible; now it renders
with its own state, its own wash, and (via `FlagTraceCopy` server-side) evidence dated to when it
last actually spoke). `Nyertes` is a fifth, independent label — never a `CoachingState` — applied
only via `day.winner`, never derived from a rule's `stateOf`.

**`useCoachingCard` and why it is not `useCompanionFeed`
(`frontend/src/data/insights/coachingCardHooks.ts`).** `useCompanionFeed` degrades a failed fetch to
`[]`, which is indistinguishable from "the feed is genuinely empty today" — fine for a feed, wrong
here: the card page must tell "no card today" (`card === null`, honest) apart from "couldn't load"
(`isError`). So `useCoachingCard(date)` goes through `useDualQuery` directly rather than reusing the
feed hook, filtering the SAME `feedApi.get(date)` response down to the one `kind === 'advice'`
message and keeping `isPending`/`isError` honest. Its query key shares the feed's own prefix
(`['companionFeed', date, 'advice']`), so `useAdviceActions`' existing `['companionFeed']`
invalidation refreshes this card too with no second action path. The mock seed
(`coachingCardMock.ts`) is **derived from** `mockCoachingDay` (§ below) rather than hand-typed beside
it — two independently-authored seeds would eventually name two different winners on the hub and the
card page for the same day, which is precisely the incoherence this feature exists to remove. The
real companion-feed mock stays `[]` deliberately (Phase-1 byte parity; the Nap thread's own goldens
depend on it) — this seed is scoped to the coaching surface only.

**The winner rule: badged from `day.winner` only, never `cardOutcome`.** `winnerRuleOf(day)`
(`coachingCopy.ts:89-92`) resolves `day.winner.flagKey` against `day.rules` — `day.winner` is a fact
about the DAY (the delivered card), so it is the **ONLY** source of the „Nyertes" badge on all three
pages. `cardOutcome` describes a rule's state AT THE MOMENT the card was chosen and is deliberately
null once that rule has changed since (including the winner itself, if it later went CLEAR) — a
client that inferred the badge from `cardOutcome` would render „Nyertes" on nothing at all on a day
where the winning rule cleared up before the observer was opened. See
[`companion.md`](companion.md) §3 "Proactive coaching observer S2 — the read endpoint" for the full settled semantics
(`mezo-y43v`) this badge rule rests on.

---

### 2.11 Kérdezd a csapatot (`pages/DiagnosisListPage.tsx` + `DiagnosisDetailPage.tsx`) — the Diagnózis page in the team world, `mezo-u3712`, 2026-09-26

**Why.** The csapatfal's nav switch (`mezo-a9bo7.10`) left Diagnózis behind A csapat → Gépterem →
Összes funkció; the owner could not find it, and the list itself hid sleep/weight reports (the
contract default bug, `mezo-tpmr2`, fixed separately). Owner decisions: entry rows on **A csapat**
(between the characters and the Gépterem) and at the **bottom of the Nap hub**, both opening the
page (not a quick sheet — the catalog will grow); every question has a host; fatigue's host is Mezo.
Spec: [`2026-09-26-kerdezd-a-csapatot-design.md`](../superpowers/specs/2026-09-26-kerdezd-a-csapatot-design.md);
parity reference: [`uveg-diagnozis.html`](../design_2.0/prototypes/uveg-diagnozis.html).

- **List (`/mezo/diagnozis`).** A `‹ <origin>` back pill reads the router state `{ from, label }`
  that `AskTeamRow` passes (fallback: A csapat) → head „Kérdezd a csapatot" → the live-only quota
  line (`quotaLeft` = 3 − today's rows in the list; the backend 429 stays the authority) → the
  **latest answer** as the page's one glass (host avatar, verdict, certainty) → „Mit kérdezel?" (one
  flat list, a row per `LIVE_QUESTIONS` entry with its host, `UPCOMING_QUESTIONS` dimmed as
  HAMAROSAN) → „Korábbi válaszok" (flat rows, host filter chips, `Frissíthető` on stale rows).
  Styles: `features/insights/kerdezd.css` (`kt-*`); the old list rules were deleted from the
  `uveg mezo1 diagnozis` block of `prototype.css`.
- **Ask sheet (`components/AskTeamSheet.tsx`, a `GlassBox`).** Host + „X nézi meg", the window
  sentence and „looks at" chips from the catalog; weight gets this week / last week and reopens a
  non-stale report for the chosen Monday instead of spending a question (the `mezo-85x5r` lookup);
  otherwise **Kérdezem** (live only; mock shows the demo line). While generating, four steps advance
  on a timer and the last stays lit until the real response lands; the fresh report opens. The
  409/429 kinds render `ASK_ERROR_COPY` in the sheet.
- **Report (`/mezo/diagnozis/:id`).** The hero wears the host avatar + guests (`guestsOf` = distinct
  suspect owners ≠ host, from `DiagnosisSuspect.domain` → `characterForMetricDomain`), a derived
  `helpersLine` („Mezo nézte meg · Szunya és Mocor segített"), a stale banner with **Frissítés** (a
  same-question regenerate; live only), each suspect's „<X> gyanúja" owner chip, and the
  Szkeptikus's closing honesty note. Számvetés, suspect cards, probe and „Próbáljuk ki" unchanged.
- **Logic.** `logic/diagnosisCatalog.ts` (hosts, blurbs, looks, `weekAnchored`, `hostOf`),
  `logic/diagnosisTeam.ts` (`suspectOwner`, `guestsOf`, `helpersLine`, `quotaLeft`, `newestFirst`) —
  derived labels only, nothing composed (ADR 0049). The Összes funkció dev menu keeps the original
  name „Diagnózis".

## 3. Architecture & data flow

The social root is `TeamFeedPage` (below) plus `useCharacterOverview` for the cold-start gate. The „Összes funkció” grid has no data reads. All existing hooks share their TanStack caches with detail pages; no new backend endpoint or topic state is introduced by the navigation change.

**Csapat-üzenőfal domain-réteg (`mezo-a9bo7.7`, Act I slice A1).** The wall that
replaces the Boop hub root (`/mezo`, spec `docs/superpowers/specs/2026-09-23-boop-team-feed-design.md`,
plan `docs/superpowers/plans/2026-09-24-csapatfal-act1.md`) sits on two pure modules:
`logic/team.ts` (the 5 postable characters + the non-posting Szkeptikus; `characterForMetricDomain`,
`characterForPersona` — every metric domain and backend persona has exactly one owner, unknown → Mezo;
the working names live ONLY here) and `logic/teamFeed.ts` (`buildTeamFeed`, `ownerForPattern`). The
builder maps the existing hooks' records to `FeedPost`s without writing any text of its own (ADR 0049:
`body` uses the record's own prose, question and source/date evidence labels): proposed pattern / fresh or return observation with a question →
`kerdes` (`waiting`, pattern `decision` anchor); monitoring pattern → `sejtes` with an `n/minN` honesty
band ("még kevés adat" below `minN`); confirmed pattern with a `lastDetectedAt` → `megfigyeles`; active
experiment → `kiserlet` on today; resolved prediction → `elorejelzes`; character-feed items → persona-routed
`megfigyeles`, konzílium items → `konzilium` by Mezo. Not posts: pending predictions, proposed/completed
experiments (no event date), rejected/refuted/dormant patterns, watching/confirmed observation row-cards.
Fresh and return questions retain their original dates even when an older unanswered event is returned by today's persistent inbox. An observation post replaces the matching pattern post so one question is not repeated.
Days group by local date (Ma / Tegnap / `huMonthDayDow`; a non-ISO display date such as the mock
predictions' „Máj 22” is kept verbatim and sorts after the dated days), each with at most ONE poster —
the only glass box of the day. The poster must be *earned*: waiting > kiserlet > konzilium; without one,
only a busy day (≥3 posts) promotes its newest — a quiet day's lone post stays a flat panel, otherwise a
sparse wall turns all-glass and the §3.4 ranking collapses (seen live in A2). The `tf-*` CSS section at the end of
`boop-world.css` is the prototype's (`uveg-uzenofal.html`) wall/room anatomy on the shared U1 `.glass` kit.

**A fal (`mezo-a9bo7.8`, slice A2 — mounted on `/mezo` at A4, `mezo-a9bo7.10`).**
`pages/TeamFeedPage.tsx` reads `usePatterns`, `usePatternMonitor` (pair domains for routing),
`usePredictions`, `useExperiments`, `useObservations`, `useCharacterFeed(60)`; it shows `ScreenSkeleton`
until ALL are settled (no empty-state flash, mezo-yew), then header → `StoryStrip` → „Rád vár” strip →
day sections (`FeedPosterCard` = `glass tf-poster`, `FeedPostCard` = flat `tf-post`) → „Ennyi történt”.
Every post carries „Miből látszik?” (`sourceRoute`, an existing deep page) and the unified trio
(`components/feed/FeedTrio.tsx`, spec §2.8): on a pattern question it is the existing pattern decision
(`usePatternActions().decide(id, 'confirm' | 'reject')`), on an observation question the existing chip
reply (`useObservationReply().reply(patternId, 'watch' | 'reject')`) with `Igen, ez igaz rám` / `Nem, ez nem stimmel` / `Beszéljük meg` labels on both fresh and return questions, elsewhere a session-local,
reversible vote that writes nothing. „Nem így érzem” also opens the reply sheet (the character asks back).
**An observation post's own evidence renders structurally, not as prose (mezo-d6ivw.1):** when `FeedPost.evidence` is nonempty, `FeedPostCard.tsx` renders the shared `EvidenceList` (`@/shared/ui/evidence`, also the Today card's block — [`today.md`](today.md) §10) straight from the wire's `ObservationEvidenceItem[]` — the same source-icon/value-pill/quote rows and `Változás` grouping, no client-side re-parsing of a raw context line.
After a decision the trio is replaced by the afterlife label (`AFTERLIFE` in `teamFeed.ts`); a record-borne
one comes from `Observation.repliedChoice`, a session one from `useFeedSession` (query cache, survives
remounts) via `withSessionAfterlife`, which also keeps a just-rejected post on its day after its record
drops out of the stream. An answered observation snapshot suppresses its duplicate monitoring pattern; a newer question supersedes the old snapshot. The acknowledgement records personal experience, not statistical proof or an eight-day promise. `FeedReplySheet` (a `GlassBox`) picks the channel from the post: `thread`
(character-feed source) → `useCharacterReplies` + `useCharacterReplyDraft`; `observation` → the existing
„talk” reply, then `/mezo/chat?c=<id>`; neither (pattern/experiment/prediction) → an honest hand-off to
`/mezo/chat` with the post text as `compose` state. `StoryStrip` rings: fresh today AND not seen
(`localStorage['tf-seen:<id>:<day>']`, try/catch — blocked storage = every fresh ring stays „new”);
a coral dot = something waits on you there; each ring links to `/mezo/csapat/<id>` (the A3 room route).
The trio's four icons (`t-thumb-up`, `t-thumb-down`, `t-send`, `t-flask`) joined the Titanium sprite
from the prototype's approved „Új ikonok” sheet.

**Esti kiadás a falon (csapatfal H1–H2, `mezo-a9bo7.12`/`.13`,
[ADR 0052](../decisions/0052-esti-kiadas.md)).** The daily council moved to 21:00 and publishes a
3–6 post `team_edition` per day (the machinery is in [character.md](character.md) “Esti kiadás”).
`useTeamFeed` reads `useTeamEditions(today-13, today)` beside the I. felvonás sources and merges the
two in `logic/teamEdition.ts`:

- `editionPost(edition, post)` produces the SAME `FeedPost` shape the cards already render, so
  `FeedPosterCard`/`FeedPostCard`/`FeedTrio` are untouched: `id` = `edition:<day>:<rank>`, `kind` =
  the post's genre, `author` = its `characterKey`, `occurredAt` = the edition's day; a `kerdes` on a
  pattern keeps the pattern-decision anchor so the trio still decides the real record.
- `mergeWall(feed, editions, today)`: **a day with an edition IS that edition** — its posts in rank
  order, rank 1 as the day's single glass poster. What missed the cut stays in the character's room
  (spec §2) — which is why `useTeamFeed` also returns the untouched build as `rooms`, and
  `TeamPage`/`CharacterRoomPage` read THAT, never the wall. A `QUIET` edition sets `FeedDay.quiet`
  and the wall says so in one honest UI sentence instead of posts (filler is never written, ADR
  0049). Edition-less days are the I. felvonás fallback unchanged, so the switch-on is seamless.
  Still-open knocks (`waiting` posts) return to the head of TODAY even when their own day became an
  edition, deduped against the edition by `sourceRoute` — in that case the edition's own post
  carries the „Rád vár” flag. `waitingCount` and the story rings are recomputed from the merged wall.

Since H3 (`mezo-a9bo7.14`) a post's text may be the character's own voice (`voiced: true`, written
by the backend's `EditionVoiceWriter` — §2.0a) or the source record's raw text (`voiced: false`, the
honest fallback). **The wall does not branch on it:** both go through the existing
`renderInline(…, { boldOnly: true })`, so the voice's `**kiemelés**` renders and nothing else about
the card changes. The FE never composes text of its own (ADR 0049).

**Vendég-sorok (H4, `mezo-a9bo7.15`).** An edition post may carry up to 2 guest lines — two
characters talking under the post (`TeamEditionPost.guests`, written and fact-guarded by the
backend). `editionPost` maps them to `FeedPost.guests: { author, body }[]` (the key is omitted when
the list is empty; the older single `guest` = „bevonta X” is a different field and stays as is).
The Szkeptikus is a valid guest author: he never posts, but here he speaks, wearing the slate Boop
through the same `TEAM` registry. `components/feed/FeedGuests.tsx` renders them as the prototype's
comment preview (`uveg-uzenofal.html` `.cmt` → `.tf-cmt` in `boop-world.css`): the small
`FeedAvatar`, the name in ink, the character's sentence through the same `renderInline(…,
{ boldOnly: true })` — a flat row, never glass (the poster already is the glass), **at most 2
rows**, and nothing when there are none. `FeedPosterCard` and `FeedPostCard` put it **above the
trio**. The UI adds no emoji or text of its own; only the character's sentence may carry its
emoji, and the Szkeptikus's line has none. The mock's rank-1 post carries the two-guest example
(Mocor on the 4. set, the Szkeptikus with the alternative explanation).

**Falat és Derű napi műsora (H5, `mezo-a9bo7.16`).** Two edition genres come from data the
characters own rather than from a finding. Falat's **napi értékelés** (`genre: 'ertekeles'`,
`sourceKind: 'fuel_day'`, `sourceRoute: '/fuel'`) is the three-voice day review — plate (meal count
+ average score), goal (kcal target vs. eaten), training (done/planned window) — and renders as any
other post: kind label „napi értékelés”, the trio, and „Miből látszik?” to the Fuel day. Derű's
**kérés** (`genre: 'keres'`, `sourceKind: 'checkin_coverage'`, `sourceRoute: '/nap/checkin'`) asks
for a check-in when fewer than 8 of the last 14 days have one. A request is not a claim, so the
card follows the prototype's `kérés` post (`uveg-uzenofal.html`): **the „Miből látszik?” link, the
guest lines and the trio (and the poster's reply row) give way to ONE „Bejelentkezem” CTA**
(`RequestCta` in `FeedPostCard.tsx`, the `t-heart` sprite) that links to the post's own
`sourceRoute`. On the quiet panel it is a small `glass tf-cta` chip; on a poster (already the day's
glass) it is a flat tinted pill — never glass in glass. `keres` is a filler genre (the selector only
takes it when fewer than 3 main candidates are eligible), so it is usually the last post of a thin
day. The `.glass.tf-c-*` accent pairs in `boop-world.css` exist because `.glass` sets its own sage
`--c` later in the bundle at equal specificity — without them every poster and glass chip on the
wall was sage regardless of its character.

**A csapat élő sávja és a csapat-chat szoba (Act III Task 12, `mezo-a9bo7.24`, `/mezo/elo`).**
Below `StoryStrip` on the wall (`TeamFeedPage.tsx:50-51`) sits `components/feed/LiveStrip.tsx`, a
FLAT `tf-live` panel (never glass — the day's poster stays the wall's one glass surface) that opens
the chat room on tap. It shows the day's most recent character line (`logic/teamChat.ts`'s
`stripText`: the newest non-`USER` line's speaker + `renderInline` body, bold-only) behind a
pulsing `tf-live-dot` and the speaker's `FeedAvatar`, with a coral `tf-live-cnt` unread badge
(`unreadCount`, counted since the room was last opened today, `localStorage['boop.teamChat.lastSeen']`
— private/blocked storage just means the count never zeroes, never crashes). If no line has landed
yet today but an ügy is already open, the strip falls back to the oldest `openThreads` entry's
`ruleLabel` + „<owner> figyeli”; with neither a line nor an open ügy the strip renders nothing
(`LiveStrip.tsx:31`) — no manufactured "all quiet" copy (ADR 0049). The eyebrow reads „ÉLŐBEN · A
CSAPAT BESZÉL”.

`pages/TeamChatPage.tsx` (route `mezo/elo` in `router.tsx:420`) is the room itself: an optional
`?d=YYYY-MM-DD` (validated by a regex, garbage falls back to today) picks the day, defaulting to
today's live view. It gates on `ScreenSkeleton` before the empty state (the `TeamFeedPage`
precedent, avoids a "csend van" flash on half-loaded data), then renders a header
(„Ma · élőben · <weekday>” or „<month day> · <weekday>”), a five-avatar „Mind az öten figyelnek —
akkor szólnak, ha teendő van” banner (today only), three chips (nyitott ügy count, rendeződött
count — distinct ügyek on the day's lines `RESOLVED` that day, whatever closed them (data, the
character's answer, an excuse), since S7's reply/excuse closes write no `RESOLVE` line, „értesítés ma/aznap: n / pushBudget”), a glass **„Rád vár”** strip (`tf-strip tf-c-lav`,
the oldest open ügy) that either scrolls to that ügy's opening line or — if the line belongs to a
different day — navigates to `/mezo/elo?d=<that day>`, then the day's lines grouped by time-of-day
(Reggel/Délben/Délután/Este/Éjjel, `logic/teamChat.ts`'s `groupByDayPart`, 05-11/11-14/14-18/18-22/
else, split into consecutive same-part runs so an early-morning and a late-night block never merge),
and finally, on today's room — and, since S7, whenever ANY thread on the page is still awaiting an
answer, not just today's — a reply row: „Te hogy látod? Válaszolj…” opening a compose sheet against
the oldest open ügy. Each character bubble carries a timestamp, and an `OPEN`/`RESOLVE` line adds a
status tag (`nyitott`/`rendeződött HH:mm`/`lejárt`), a push indicator (`értesítettünk · HH:mm` or
`csendben`), and „Miből látszik?” opening `EvidenceSheet` — the line's own `facts[]` list plus, for
a `voiced` line, an honest note that only those numbers could have fed the sentence (a failed check
falls back to the raw rule text). A still-`OPEN` line also carries the unified `ArtifactTrio`
(feedback + „Elmesélem”/„Nem így érzem” reply) and, when the ügy offers actions (e.g. „Horgony
−30 perc”), apply buttons that only show a confirmed „Beállítva: …” after the server accepts the
write (never optimistically) and a Hungarian retry note on failure. `GUEST`/`SKEPTIC` lines (a
second character or the Szkeptikus answering under the same ügy) render smaller and unlabelled by
area, matching the wall's `FeedGuests` convention.

**A csapatfal válaszol (S7, `mezo-d6ivw.7`).** After a `USER` reply, the thread the reply belongs
to enters an `awaiting` state (tracked client-side, not a server field) until a `REPLY` line newer
than that `USER` line appears in the day data; `frontend/src/features/insights/components/teamchat/ReplyAfterlife.tsx`'s
`TypingRow` («{Owner} ír…», animated dots) renders on that thread's last line while it is awaiting.
Once the answer lands, the ügy's **last `REPLY` line only** carries the afterlife: a `RESOLVED`
thread whose `closeReason` is `REPLY` or `EXCUSED` (a code-decided close, no manual close ever
exists — see [character.md](character.md) §Csapat-chat; a `DATA` close gets no tag here, its own
`RESOLVE` line says „Rendeződött”) shows `CloseTag` („Kivétel: {closeNote}” or „{Owner} lezárta:
{closeNote}”, with a silent „csendben” pill), and a thread carrying `remembered` shows
`RememberedChip` whatever its status („Megjegyeztem: …” with a „Visszavonom” undo button — undo
calls `DELETE …/threads/{id}/remembered`, which vetoes the exception, mutes the fact, deletes that
thread's hit, and reopens the ügy if nothing else claimed the flag meanwhile). After an undo the
chip reads „Visszavonva — nem jegyeztem meg, és az ügy újra nyitott.” while the ügy is `OPEN` again,
or „Visszavonva — nem jegyeztem meg.” when a newer ügy of the rule kept it closed; a REVIEW „Nem,
figyelj rá” is not an undo — the server drops that exception from `remembered`, so no chip claims
one. A live `OPEN` thread carrying an `offer` renders `OfferButtons` above the trio
instead: an `EXCUSE` offer is one tap („Igen, {tag} volt” → `answer('EXCUSED')`); a `REVIEW` offer
(the ≥4-hits-in-30-days cap, once per window) is two taps („Rendben van” → `answer('KEEP')` /
„Nem, figyelj rá” → `answer('STOP')`). All three components are distinct from the older, unrelated
`RememberedChips.tsx` (plural — an S3 chat-turn fact-extraction chip). The data layer
(`frontend/src/data/character/teamChatHooks.ts`) tracks awaiting threads in a plain
`Map<threadId, joinedAtMs>` kept outside the query cache (to dodge invalidation), backs off through
a handful of real-mode polls (`TEAM_CHAT_ANSWER_POLL_DELAYS` 2s/3s/5s/10s/10s, ~30s per thread —
the server's debounce + LLM answer often takes 5–15s) before falling back to the room's normal
60s poll, and in mock mode simulates the same shape: `reply()` marks the thread awaiting, waits
~1.2s, then applies a scripted mock answer/close (`teamChatMock.ts`'s `mockReplyAfter`); `answer`/
`undoRemembered` mirror it with `mockAnswer`/`mockUndo`.

`logic/teamChat.ts` is the pure layer behind both surfaces: `dayPartOf`/`groupByDayPart` (the
time-of-day bucketing above), `stripText`/`unreadCount` (the live strip's copy + badge),
`chips(day)` (open/resolved/pushes-today counts for the chip row) and `clockOf` (HH:mm formatting).
It composes no text of its own — every sentence rendered comes from a `TeamChatLine.body` the
backend wrote (ADR 0049).

**Data layer.** `data/character/teamChatApi.ts` wraps three calls under
`/api/character/team-chat` (`day(date?)`, `reply(threadId, text)`, `apply(threadId, actionKey)`) on
the generated `TeamChatDay`/`TeamChatLine`/`TeamChatThread`/`TeamChatAction` contract types.
`data/character/teamChatHooks.ts` follows the repo's `useDualQuery` idiom: `useTeamChat(date?)`
keys on `['teamChat', date ?? null]`, serves `buildTeamChatDay(date)`/`MOCK_TEAM_CHAT_DAY` in mock
mode (`staleTime: Infinity`, no refetch), and in real mode polls every 60s (`refetchInterval:
60_000` — the chat is genuinely live) with an honest empty-day fallback (`realEmpty`, never the
mock seed) on the unresolved window. `useTeamChatActions()` mirrors the `useAdviceActions`
precedent — mock `reply`/`apply` no-op, real mode mutates and invalidates every cached `teamChat`
day, and `apply` additionally invalidates whatever else that action key touches via the advice
card's shared `ACTION_INVALIDATES` map (no separate copy for the chat room, `mezo-a9bo7.24`).
`data/character/teamChatMock.ts` builds the mock seed from two small tables (`THREADS`/`LINES`,
mirrored verbatim from the approved prototype `uveg-uzenofal.html`'s `elo()`) through ONE builder,
`buildTeamChatDay`, so the seeded lines and their `openThreads` projection can never hand-drift
apart — three ügyek (alvásadósság/Szunya, terhelés–táplálás mismatch/Mocor+Falat with a guest
resolution, tartós stressz/Derű) across the fixed local date.

**Mezo csapat-chat összefoglalója (Act III Task 15, `mezo-a9bo7.25`).** The evening edition may
carry one Mezo `ertekeles` post with `sourceKind: 'team_chat_day'` („Ma n ügyön dolgoztunk: …”).
`editionPost` maps it like any post; its `sourceRoute` is `/mezo/elo?d=<day>`, so „Miből
látszik?” opens that day's team chat (`TeamChatPage` reads `?d=`). The chat itself (today's view,
when it has lines) ends with a flat `tf-note` footnote: „21:00-kor az esti kiadás összefoglalja a
nap szálait a falon.”

The mock edition sits on the REAL today (`characterMock.ts`), not on the frozen August mock world's
last night, otherwise the wall's 14-day window could never contain it; its rank-1 post is the
`voiced: true` example (Falat's voice over exp1's own numbers). Since H5 the mock holds TWO editions
in the sequence the selector would really produce: yesterday (prediction · Falat's értékelés as raw
`voiced: false` text · pattern) and today (exp1 on its middle day · Falat's voiced értékelés over the
mock Fuel day's own numbers · Derű's kérés as the filler, since the other two were shown yesterday). Publishing also emits ONE
`team_edition` notification („Megjött az esti kiadás”, deeplink `/mezo`, dedup key
`team_edition:<day>`) — a quiet edition stays silent, and the idempotent re-run never notifies twice.

**Szobák + A csapat (`mezo-a9bo7.9`, slice A3 — the „A csapat” dock tab since A4).** `/mezo/csapat`
(`pages/TeamPage.tsx`) lists the five rooms as `glass tf-rowg` rows in the character accent: „Most
figyeli” = the room's first case, the badge = room maturity („ismerkedik” at 0), then the Szkeptikus
explainer (`tf-dash`, no room) and the Gépterem door. `/mezo/csapat/:id` (`pages/CharacterRoomPage.tsx`;
unknown id or `szkeptikus` → an honest „Nincs ilyen szoba”) follows the prototype room rhythm: hero
(Boop + `ROOM_COPY.quote`) → maturity ring + „Ügy a falon” + „Beépült tudás” → cases (`RoomCaseCard`:
the first `glass tf-case`, the rest flat `tf-flatc`, waiting-first, each linking to the post's
`sourceRoute`) → growth curve → claims list → „Kérése hozzád” note. Logic lives in `logic/teamRooms.ts`:
the room's dimensions are the dossier dimensions whose `expertKey` folds into the character
(`characterForPersona`), maturity = their mean, claims = their `topClaims`; cases = `buildTeamFeed` posts
the character authored OR guests on. **„Így érik a képe rólad” (`mezo-a9bo7.11`):** the growth curve is
the room's real weekly maturity from `useMaturityHistory()` (`GET /api/character/maturity-history`,
stored ISO weeks + the live current week). `roomMaturitySeries` aligns it to 8 calendar weeks as the
mean of the room's dimensions (the ring's rule, so the last point equals the ring); a week without a
snapshot is `null` — never filled, never zero (ADR 0049). `MaturityWell` draws a ladder: no point →
text only; 1–3 points → discrete dots + an honest line of text; ≥4 → the line, broken at every missing
week. `+N% · 3 hét` shows only when both ends exist. `maturityDropNote` adds one quiet `tf-note` when the
latest room value fell — naming the dimension that dropped most and whether claims left the picture or
confidence fell; no push, no wall post. Mock mode ships an empty history (the mock overview starts
empty too), so the mock room shows the text. The earlier cumulative-post-count curve is gone. Both pages share the wall's data load via
`components/feed/useTeamFeed.ts`. Mezo wears the gold and the Szkeptikus the slate Boop (`BoopVariant`).

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
- `useKnowledgeGraphNodes()` (`data/insights/graphHooks.ts`, W2.6 `mezo-b3pp.11`) → `{ nodes, isPending, isError, refetch }`, nodes DESC `updatedAt` rendezve (`GET /api/companion/graph/node`, 404 → honest `[]`, same independent-switch idiom). Actions: `useKnowledgeGraphActions()` → `{ archive }`. **`useGraphEdgeCount()` (`mezo-ms9a`) is RETIRED (S6, `mezo-d6ivw.6` final review)** — the old hero's `· K kapcsolat` segment did not survive the S6 hub redesign (§2.4's new hero counts facts/people/observations/effects only), so the FE hook and its `graphApi.edgeCount` caller were pruned as dead code; the backend endpoint (`GET /api/companion/graph/edge/count`, `GraphController.countGraphEdges`) is untouched and still live, just unconsumed by the FE today.

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
- `FactSource = 'chat' | 'pattern' | 'manual' | 'weekly_review' | 'question' | 'team_chat'` (`types.ts`, `mezo-al1i`; `weekly_review`/`question` added U9b `mezo-zpxv7`, a drift fix — the backend `knowledge_fact.source` CHECK already carried both; `team_chat` added S7 `mezo-d6ivw.7` — chip „csapatfalról”, `MemoryLayersPanel` label „csapatfal”) — mirrored FE-side for the Audit panel's provenance grouping (§2.9) and `factCopy.ts`'s `originChipLabel`/`originSentence`.
- `FactOwner = 'szunya' | 'mocor' | 'falat' | 'deru' | 'mezo'` (`types.ts`, U9b `mezo-zpxv7`) — the team character that owns a fact/candidate (backend `owner` column, resolved server-side, category is the fallback). Rólad's `factOwnerTag`/`candidateByline` (§2.0b) map it to the `TEAM` accent/name; `TŐLED` is a frontend-only label for `source: manual|question`, not an `owner` value.
- `KnowledgeFact { id; text; category: FactCategory; active: boolean; reinforced: number; patternTitle?; source: FactSource; owner: FactOwner; lastReinforcedAt: string | null; createdAt: string }` — 15 facts (`f1`–`f15`, `knowledge.ts`). **`source`/`lastReinforcedAt` are FE fields since `mezo-al1i`**; **`owner`/`createdAt` are new (U9b)** — `owner` required (real mode maps the wire's `KnowledgeFactResponse.owner`, mock seeds one per fact), `createdAt` widened onto `toKnowledgeFact` for freshest-first orderings (U9b's `topRoladFacts` is gone with S6c; the hub still reads `createdAt`).
- `FactCandidate` gained `owner: FactOwner`, `source: 'chat' | 'weekly_review'`, `createdAt: string`, `evidence: string | null`, `weekStart: string | null` (U9b) — `knowledgeApi.ts`'s `toFactCandidate` widened to keep them (previously dropped who/when). `FactDecision`/`LifeEventDecision` gained `'snooze'` (§2.0b); `LifeEventCandidate` gained `createdAt`; `KnowledgeGraphNode` gained `occurredOn: string | null` (`graphApi.ts`'s `toKnowledgeGraphNode`, previously dropped it — Rólad's `RoladTimeline` needs it for the SEASON/LIFE_EVENT date).
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
`useKnowledge()` used to back two views on two tabs — the Mezo-tab `KnowledgeListPage` (facts) and the Én-tab `KnowledgePage` (graph); before that, three (`ProfilePage`, deleted `mezo-d20.6.1`). **`mezo-ms9a` merged the two-page split into `KnowledgeListPage` alone** — `KnowledgePage.tsx` is deleted, `/me/knowledge` redirects into `/mezo/knowledge`. `useKnowledge()` now has a single consumer; the graph-side reads (`useKnowledgeGraphNodes`, `useLifeEventCandidates`) are called by the SAME page, not a second one (`useGraphEdgeCount` is retired, S6 — § above).

**The ownership boundary the two-page era fought for is the hard-won part, and it is unchanged by the merge** (`mezo-0ap9`, restated + folded into a single page by `mezo-ms9a`): *„mit kap most a társ"* (facts, the candidate inbox, the on/off toggles, the prompt buckets) and *„hogyan függ össze, amit rólam tud"* (nodes, edges, archiving) are still two separate answers — they just live behind two `?view=` tiles on the same page (`?view=tenyek` / `?view=kategoriak`) instead of two routes on two hubs. **Tény-lista pontosan egy van** — the `?view=kategoriak` (ex-Tudásgráf) chain never re-lists facts, exactly as `KnowledgePage`'s deleted `Kategóriánként` section never should have (§2.4).

**Crossing type:** `KnowledgeFact[]` + `KnowledgeGraphNode[]`. Since V1.2 the fact half is real; since W2.6 (`mezo-b3pp.11`) the graph-node half is real — the last honest-`[]`/mock-only gap (`edges`) is gone. The edge-COUNT read (`GET /api/companion/graph/edge/count`) went real with `mezo-ms9a`'s backend leg but its FE consumer (the old hero's `· K kapcsolat` segment) did not survive the S6 hub redesign (§2.4 above) and was pruned.

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

### 5.8 Proaktív coaching ↔ Companion flag trace (✅ `mezo-6269.3` wired)

`useCoachingTrace`/`useCoachingCard` (§2.10) read the companion-owned `GET
/api/companion/flags/trace` and the existing companion feed (`GET /api/proactive/feed`, filtered to
`kind === 'advice'`) — Insights owns no table or endpoint of its own here, exactly as with
Weekly/Memoir/Predictions/Memory. **Crossing contract:** `CoachingTraceDay { date, earliestDate,
winner, rules[], transitions[] }` and its per-rule `CoachingRule { flagKey, label, domain, rank,
outcome, reasonCode, reasonText, facts[], disposition, cardOutcome, changedAt }` — both server-sent
shapes, unchanged by this frontend (the server owns ranking, labelling and domain assignment; see
[`companion.md`](companion.md) §3 "Proactive coaching observer S2 — the read endpoint" for the backend seam this read rests
on, `AdviceRankPort`/`DailyCardPort`). The hub tile on `MezoHubPage.tsx:146-151,240-252` reads the
SAME `useCoachingTrace()` the hub page itself reads — no separate teaser/copy.

### 5.9 Észrevételek — the observation feed Today mounts (✅ Reflexió S5, `mezo-eq85.5`)
**Owned here, rendered there.** `data/insights/observationsHooks.ts` + `observationsApi.ts` are the FE half of slice 4's two endpoints, shared by Today's `NapMezoPage` third tab and `NapPersonalInsight` ([today.md](today.md) §2), plus `TeamFeedPage`. All use the same observation records and reply cache; there is no second inbox or confirmation store.

- **`useObservations(date?)`** → `{ observations, degraded, isPending, isError, refetch }`. `useDualQuery` on `['observations', date ?? 'today']`; mock mode serves the four-card prototype seed in `data/insights/observations.ts` (one per card kind), real mode `GET /api/companion/observation` mapped by `toObservation`. A **404 is `degraded`, not an error** (the companion switched off) — the standard `usePatterns` idiom. Today's request (omitted or explicit current date) retains the latest unanswered event per pattern from previous days; historical dates remain day-bound. `toObservation` preserves the optional `kind` and original event date, and maps each wire `ObservationEvidenceItem` through the shared `mapEvidence` (`@/shared/ui/evidence/observationEvidence`, mezo-d6ivw.1) into `Observation.evidence: EvidenceItem[]` — the same structured rows `EvidenceList` renders on both the Today card and the feed post. `kind=statistical` watching rows link to pattern details without a reflection tally. The server already orders the feed, so nothing sorts here.
- **`useObservationReply()`** → `{ reply(patternId, choice, text?), pendingPatternId }`. Real mode POSTs `POST /api/companion/pattern/{patternId}/reply` and invalidates the `['observations']` prefix; mock mode writes `repliedChoice` straight into the cached cards and answers the `talk` branch with `{ conversationId: 'mock-conv' }`. `pendingPatternId` names the row whose reply is in flight — the card uses it to disable its chip group, because **the backend reply is not idempotent** and a double tap posts twice.
- **`sourceIcon` mapping.** The wire sends bare surface names (`naplo`/`alvas`/`edzes`/`vacsora`/`hold`/`mezo`); the clay set is `i-` prefixed. `observationsApi.ts` holds the explicit `Record` — there is no shared domain→icon map to reuse — and falls back to `i-mezo` for anything it does not know, so a newer backend value can never blank a card's disc.

Wire schemas, card semantics, the budget and the `OBSERVATION_NEW` push live in [`companion.md`](companion.md) §1.

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
4. New surface: a **flat `/mezo/<path>` route** in `router.tsx` + a view in `pages/` that brings its own head/padding (§2's seam box) + an entry in `logic/boopNavigation.ts` for the canonical menu. There is no `INSIGHTS_TABS` to extend — `tabs.ts` is deleted.
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

- **Csapat-chat (Act III Task 12/15, `mezo-a9bo7.24`/`.25`) — both modes:** `data/character/teamChatHooks.test.tsx` (`describe('mock mode')`/`describe('real mode')` — the dual-mode day read incl. the honest `realEmpty` fallback, `reply`/`apply` no-op vs mutate+invalidate); `features/insights/logic/teamChat.test.ts` (`groupByDayPart`'s time-of-day bucketing and same-part run-merging, `stripText`, `unreadCount`, `chips`); `features/insights/components/feed/LiveStrip.test.tsx` (latest-line copy, the open-ügy fallback when no line has landed yet, the hidden state with neither, the unread badge); `features/insights/pages/TeamChatPage.test.tsx` (`describe('TeamChatPage (mock mode)')` — day-part sections, the „Rád vár” strip's scroll-vs-cross-day-navigate branch, evidence sheet, apply/reply flows; `describe('TeamChatPage (real mode, failing saves)')` — a failed reply/apply keeps the composed text and renders the Hungarian retry note instead of a false success).
- **Data-layer:** `frontend/src/data/insights/insightsData.test.tsx` (3 patterns all ≥ floor; `p1` critique; weekly score / 4 items; memoir title + 3 anchors; `recentlyConfirmed`×3; 4 predictions w/ validated `actual`; active experiment; `patternCategoryColor('response')`). `frontend/src/data/insights/chatData.test.tsx` (3 msgs assistant→user→assistant; tool/ref shapes). *(Knowledge has no dedicated `data/` test.)*
- **Views:** `pages/{PatternsPage,MemoirPage,KnowledgeListPage,ChatPage,PredictionsPage,ExperimentsPage}.test.tsx`, plus `components/PatternDecisionCard.test.tsx` (the decision-inbox card, `mezo-tk88.4`). `MemoirPage.test.tsx` gained a **`(real mode)` describe** (since **W2**): with an MSW memoir fixture it renders the real title/body/anchors and does NOT render anniversary/archive; on the default 404 it renders the honest „készül" placeholder, not the demo fiction. **Since W4.1** the same file asserts the Phase-1 reaction row is gone in BOTH modes and the feedback chips are present in both (including real mode — that asymmetry was the `mezo-kr9v` bug), and that the 404 placeholder carries no chips (no artifact ⇒ nothing to vote on). **`WeeklyPage.test.tsx` was deleted with the tab (`mezo-p2tr`)** — its coverage (score hero, „tanulom" null-state, live suggestion prose w/o the inert buttons) moved to the `Heti` hub's own test files under `features/me/pages/` ([`me.md`](me.md) §2/§9 has the current per-page test map); `frontend/src/app/router.weeklyRedirect.test.tsx` (mock mode) pins the weekly path landing on `/me/week`'s `Heti` hub instead of a 404 or the retired tab — since `mezo-d20.1.1` that is a **two-hop** resolution for the legacy URL (`/insights/weekly` → `/mezo/weekly` → `/me/week`), which is exactly what makes the test worth keeping.
- **Rólad (§2.0b, U9b `mezo-zpxv7`; S6c `mezo-2dfy2`):** `pages/BoopAboutPage.test.tsx` asserts the S6c ranking (quote → inbox → kirakat → Tovább → footnote) in both modes, the kirakat tiles + hub door + the degraded off-dash, and the inbox fold via `expandInbox()`; `pages/RoladLifeEventsPage.test.tsx` (subpage header/timeline/footnote, empty state); `hooks/useRoladInbox.test.tsx` (every decision — accept/refine/snooze/reject — drops the id from the open `candidates`/`lifeEvents` lists and lands it in `settled` with the right `outcome`/title); `components/rolad/{RoladQuote,RoladInbox,RoladTimeline}.test.tsx` (incl. the collapsed-2/fold/afterlife-in-place cases) and `logic/roladCopy.test.ts` (pure-helper unit tests: `pickQuoteClaim` skips `sensitive` claims and picks highest confidence, `factOwnerTag`, `candidateByline`). The inbox/conflict/life-event/season/`?start=`/real-mode-POST/degraded cases that used to live in `pages/KnowledgeListPage.test.tsx` moved here; `KnowledgeListPage.test.tsx` now asserts the `KnowledgeBaseView` pointer card (pending count → link to `/mezo/rolad`, zero → the quiet line) instead.
- **The S6 Tudástár hub (`mezo-d6ivw.6`, §2.4):** one test file per hub component — `components/hub/{TenyekSection,EmberekSection,EszrevetelekSection,HatasokSection,HubTiles,HubFold,HubRow,ForgetUndoBar}.test.tsx` (loading/error/degraded/empty per section, the verb contract incl. **Javítom**'s inline edit and **Elhallgattatom**/**Elfelejtem**'s `forget`/`isHidden` wiring, drift-pair rendering, topic grouping) plus `components/hub/hubWriteFailure.test.tsx` (real mode, MSW 500s — the optimistic-write rollback + error toast for every section's mute/forget); `logic/{hubCopy,hubCounts,hubSearch,hubTopics}.test.ts` (pure — the hero/tile counting rules incl. the "never an invented zero" branches, `obsState`, topic grouping determinism); `hooks/useForgetUndo.test.tsx` (the 5 s window, undo cancels without sending, a second forget commits the first, unmount commits the outstanding one, a failed commit's rollback toast).
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
- **Chat plumbing (`mezo-at8x`):** `shared/lib/markdown.test.tsx` (11 — inline set, snake_case left alone, no HTML injection, each block kind), `features/insights/logic/useVoiceInput.test.tsx` (6 — record→transcribe→callback, denied mic, unsupported browser, cancel discards, level stays 0 without Web Audio, mis-tap copy; `shared/ui/voice/VoiceBubble.test.tsx` covers the bubble's four phases; a `FakeMediaRecorder` + stubbed `navigator.mediaDevices` stand in for what jsdom lacks), and the multipart case in `data/insights/chatApi.test.ts` (the request must go out as `multipart/form-data`, not JSON).
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
- **The Mezo hub (`mezo-d20.5.1`):** `pages/MezoHubPage.test.tsx` — the orb hero being the spot ALONE (`mezo-e3zg`: no name, no companion sentence, no status line, the composer as its immediate sibling), the composer-shaped opener navigating to `/mezo/chat`, the decision card carrying the strongest decide-bucket question **in human words only** (raw `r`/`p` asserted absent), deciding flipping it to the sage acknowledgement **through the same mutation `PatternsPage` uses**, the six tile lines coming from the pages' own hooks, every tile navigating to its full-page sibling (with `Heti` crossing out to `/me/week`), **plus the `Karakter` tile** (hub-tile-reorg, `mezo-o486` — the `isDossierEmpty`-gated maturity line, navigation to `/me/karakter`, and since `mezo-e3zg` an assertion that it carries no `mz-tile-wide`), the `Memória` tile's real L0→L3 counts opening `/mezo/memoria`, and a real-mode describe over MSW fixtures asserting **no fabricated zeros during the unresolved window** — the `mezo-yew`/`mezo-0xl` bug class, now guarded on the hub as well as the pages.
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
  back pill (`button name="Vissza"`, text `‹ Minták` on a direct open) and the „Minta részletei" eyebrow;
  `mezo-me75u.13` adds the ranking assertions (exactly one `.glass` surface besides the back pill,
  the hero ring and the days card agree on the day count). `logic/metricFormat.test.ts` —
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

- **A minta SOSEM a nyilas belső párcímével vagy a gépi statisztikai mondattal szól a felhasználóhoz (mezo-0469 szabálya, 2026-09-26-i visszaesés után újra kimondva).** A katalógus `title`-je („Esti lezárás ↔ rákövetkező alvásminőség”) a motor belső neve, a tárolt statisztikai `Pattern.mechanism` („Gyenge pozitív együttjárás a(z) … között …”, `PatternDetectionService.mechanism()`) a Pearson-futás leírása. Minden felhasználói felület a `logic/patternCopy.ts` két függvényén át beszél: `patternHeadline(title, pair)` → a pár kérdése (`questionHu`, pl. „Jobban alszol, ha este lezárod a napot?”; pár nélkül a nyilas címből kérdő mondat), `patternPlainLine(mechanism, pair)` → a lelet mondata (`findingSentence`), különben a pár miértje (`mechanismHu`); az emberi (reflexiós) szöveg változatlanul megy. Használói: a fal és a szobák (`teamFeed.patternPost`/`observationPost`, `teamEdition.editionPost` régi kiadásai), a részlet-hero (`PatternAnswerHero`, `mezo-rstt7` óta minden sor — katalógus és laborfüzet egyaránt — ugyanazt az egy hőst kapja; a korábbi `HypothesisStateCard`/`PatternDetailHero` külön hős-párost törölte a rewrite, a „Hipotézis: {cím}?” sor változatlanul megszűnt, helyette a miért), a mentett-minta fallback (`PatternArtifactDetail`). A `pairLine` nyíl helyett „Figyelem: A és másnapi B”; a teszt-terv csempék között nincs nyíl, a sáv köznyelvi („másnap · nézem a hatást”, „8 nap · kell a döntéshez”, „60 nap · ennyit nézek vissza”, érték-fajta: „megtörtént-e aznap / hánykor volt / mennyi volt aznap”). Backend-oldalon az esti kiadás jelöltje (`EditionCandidateCollector`) statisztikai sornál és gyűlő párnál a pár kérdését/miértjét viszi címnek/rekord-szövegnek. **Új felület, ami mintát mutat → ezeken a függvényeken át, soha nem `pattern.title`/`pattern.mechanism`/`pair.title` nyersen.**
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
- **The previous unmounted hub showed ONE decision, not the inbox.** `MezoHubPage` renders `decide[0]` only, over the shared `usePatternActions().decide` mutation, and states the bucket size in its eyebrow (`Döntésre vár · N`). The full inbox stays on `/mezo/patterns`. A hub that carried the whole inbox would have made the Minták tile a duplicate of the page above it.
- **The orb hero carries nothing at all.** Since `mezo-e3zg` it is the breathing spot and then the composer — no number, no name, no companion sentence, no status line. The live/demo-voice rule that used to govern that sentence (prefer a feed row with a real `artifactId`, fall back to the labelled demo briefing **only in mock mode**) now lives solely where the prose does, on `ChatPage`/`MezoChip`.
- **Tile lines are absent, not zero, while unresolved** — and where a page owns an honest word for "not yet", the tile borrows it (`Heti`/`Előrejelzések`/`Kísérletek` read **„tanulom"**) rather than inventing one. The `Memória` tile drops its four counts entirely with no `overview`.

**Deferred / known gaps after Design 2.0** (recorded honestly, not fixed):

- **No page under `/mezo/*` has a back affordance except the three detail leaves** (`PatternDetailPage`, `PredictionDetailPage`, `ExperimentDetailPage` — `useBackTo`, §2.1b). None mounts `PageHead`, so the `‹ vissza` chip the Nap/Én/Fuel siblings carry is missing across the whole tab; the tab bar and browser back are the only way up from Minták, Memoár, Tudástár, Chat, Előrejelzések, Kísérletek and Memória. On a hub-and-siblings IA this is the most visible unfinished edge in the tab.
- **`components/MotorStateHero.tsx` is orphaned** — `PatternsPage` inlined its own hero + lifecycle grid in the `mezo-d20.5.3` re-face and no longer imports it, and nothing else does. `components/MetricCoverageRing.tsx` is half-orphaned in the same way: only its exported `lastSeenLabel` helper is still imported, the ring markup having moved into the page. Both files survive with their behaviour documented above; deleting them means moving `lastSeenLabel` somewhere and dropping their tests, which was left for a deliberate pass. ([me.md §9](me.md) records four Me-side components in the same state.)
- **The Memória ↔ Minták cross-link is still one-way and still goes through a redirect.** `MemoryPage`/`MemoryLayersPanel` link to `/mezo/motor`, which `<Navigate>`s to `/mezo/patterns`; Design 2.0 repointed the prefix but did not shorten the hop or add the reverse link the retired `MotorPage` used to carry (the pre-existing note above §3 covers the reverse-link half).
- **RESOLVED — `Heti`'s designed destination has landed.** This bullet used to track the tile as IN FLIGHT: shipping to a working `/me/week` page (`mezo-p2tr`) while the Design 2.0-specified **Heti hub + four view-pages + a day page**, plus its two backend legs (weekly knowledge candidates, a persisted weekly score + trend endpoint), were still being built on a separate machine under [`docs/design_2.0/2026-08-28-heti-implementation-handoff.md`](../design_2.0/2026-08-28-heti-implementation-handoff.md). That work is done: `mezo-d20.6.10` split `/me/week` into `WeekHubPage`/`WeekAnalysisPage`/`WeekDaysPage`/`WeekLessonsPage`/`WeekDiscoveriesPage` + the pre-existing `WeekDayPage`, and the trend endpoint + `weekly_score` cache landed as `mezo-d20.7.5`–`.7.8` ([`me.md`](me.md) §2 has the per-page breakdown). **The day page itself later moved on** (`mezo-yjzhw.4`, 2026-09-24) into its own Nap-domain tab, "A napom" ([today.md](today.md)); `/me/week/napok/:date` now redirects there. One loose end: `WeekHubPage`'s 8-week score-trend spark is still wired to a hardcoded empty array in the FE even though the backend trend endpoint it would read is live — the spark never renders in this build.
- **`useInsights` is still dead code** — no live consumer since `PatternsPage` moved to `usePatterns`; the re-face did not remove it (§3).


---

## 10. Key files

**Feature (`frontend/src/features/insights/`):** — the directory keeps its `insights` name; the tab is called `Mezo` (§2)
- `pages/{BoopMenuPage,BoopAboutPage,BoopMemoriesPage,MemoryDayPage,KnowledgeNodePage,PredictionDetailPage,ExperimentDetailPage}.tsx` — the „Összes funkció” grid, Rólad, Emlékek and full detail pages.
- **Rólad (§2.0b, U9b `mezo-zpxv7`; S6c `mezo-2dfy2`):** `hooks/useRoladInbox.ts` (the four-decision inbox hook over `useKnowledge`/`useLifeEventCandidates`, page-level `settled` afterlife state) + `components/rolad/{RoladQuote,RoladInbox,RoladTimeline,riseStyle}.tsx` + `logic/roladCopy.ts` (`pickQuoteClaim`, `factOwnerTag`, `candidateByline`, `ROLAD_COPY` incl. the S6c fold/kirakat strings) — all pure/tested, composed by `pages/BoopAboutPage.tsx` (kirakat via the hub's `HubTiles`/`hubCounts`) and `pages/RoladLifeEventsPage.tsx`.
- `logic/team.ts` + `logic/teamFeed.ts` (+ `teamFeed.fixtures.ts`) — **`mezo-a9bo7.7`** the csapat-üzenőfal character registry and record→post builder (§3); pure, unit-tested
- `logic/teamEdition.ts` — **`mezo-a9bo7.13`** the esti kiadás → wall merge (`editionPost`, `mergeWall`, §3; guest lines since `mezo-a9bo7.15`); pure, unit-tested
- `pages/TeamFeedPage.tsx` + `components/feed/{FeedTrio,FeedPostCard,FeedPosterCard,FeedPostHead,FeedGuests,FeedReplySheet,StoryStrip}.tsx` + `useFeedSession.ts` + `useTeamFeed.ts` — **`mezo-a9bo7.8`** the csapat-üzenőfal wall, the unified trio and the reply sheet (§3); `/mezo` since A4 (`mezo-a9bo7.10`), with `IntroPosts.tsx` as the cold start (§2.0); `FeedPostCard`'s `RequestCta` (the „Bejelentkezem” CTA on a `keres` post) since `mezo-a9bo7.16`
- `pages/{TeamPage,CharacterRoomPage}.tsx` + `components/feed/RoomCaseCard.tsx` + `logic/teamRooms.ts` — **`mezo-a9bo7.9`** A csapat and the five character rooms (§3); routed at `/mezo/csapat[/:id]`, the „A csapat” dock tab since A4
- `pages/TeamChatPage.tsx` + `components/feed/LiveStrip.tsx` + `logic/teamChat.ts` — **`mezo-a9bo7.24`** the csapat-chat room (`/mezo/elo`, `router.tsx:420`) and the wall's live strip below `StoryStrip` (§3); data half in `data/character/{teamChatApi,teamChatHooks,teamChatMock}.ts`
- `logic/boopNavigation.ts`, `boop-world.css` — shared function catalog (`BOOP_DESTINATIONS`, `ALL_FEATURES_ROUTE`) and app-token visuals. (`components/BoopNavigation.tsx`, the old chip strip, was deleted in `mezo-twizx`.)
- `pages/MezoHubPage.tsx` — unmounted previous hub, retained source/tests.
- **`InsightsSection.tsx` and `pages/tabs.ts` are DELETED (`mezo-d20.5.1`)** — the shell, `INSIGHTS_TABS`, `visibleInsightsTabs()` and the (already-empty) `PHASE3_TAB_IDS` are gone, along with the app-wide `features/progression/components/AppHero.tsx` and `shared/ui/SubNavDropdown.tsx` they depended on. `InsightsSubNav.tsx` had already been superseded by the dropdown in `mezo-ugqb`; `components/PhaseTeaserCard.tsx` by the empty gate set in `mezo-mifi`
- `frontend/src/shared/ui/mozaik/{index.tsx,motion.tsx}` + `frontend/src/shared/ui/clay/index.tsx` — the primitives the re-faced pages compose (`Tile`/`Mosaic`/`PageHero`; `EntranceGroup`/`useCountUp`; `ClayIcon`/`ClaySpot`). **Not Insights-owned** — [`_platform-design-system.md`](_platform-design-system.md)
- `pages/PatternsPage.tsx` — lifecycle catalogue (§2.1): hero + clickable 3×2 status selector + one active bucket + `PatternFilterSheet` + five-item pager + „Adat-egészség" coverage strip; owns selection/filter/sort/page state, while `patternCatalog.ts` owns pure derivations
- `pages/PatternDetailPage.tsx` — dual-source detail leaf (§2.1b, `/mezo/patterns/:pairKey`): rich pair-backed evidence/history flow when `usePatternPairDetail` succeeds; `PatternArtifactDetail` when only `usePatterns` resolves the key; honest retry/not-found states otherwise
- `components/DetailHero.tsx` — **`mezo-me75u.13`**, the shared üveg anatomy of the three „Miből látszik?" detail pages (§2.1b): `DetailFrame`, `DetailHero`, `StatePill`, `DayRing`, `DecisionRow` + `patternDecisionButtons` + `DecisionNote`, `SectionHead`, `DetailState`
- `pages/PredictionDetailPage.tsx` · `pages/ExperimentDetailPage.tsx` — the prediction / experiment detail leaves on the same anatomy (§2.1b Üveg): prediction hero = expectation + confidence ring while pending, „Ezt vártam / Ez történt" once resolved, then flat „Mennyire biztos…", „Miből következik?", „Mi történt?", „Hasznos volt?" (`FeedbackChips glyph3d`); experiment hero = „Hol tartunk?" day ring + day cells (active), the question + Elfogadom/Elvetem (proposed, live mode only) or the result; status words from `PREDICTION_STATE` / `experimentStateOf` (the lists keep `PREDICTION_STATUS` / `experimentChipOf`)
- `components/PatternArtifactDetail.tsx` — pairless persisted-pattern fallback: proposed rows get their own glass decision hero (the list's `PatternDecisionCard` is not reused); judged rows show a read-only status hero, saved mechanism/evidence and no fabricated graph/statistics
- `components/PatternFilterSheet.tsx` + `PatternDomainMark.tsx` — house `Sheet` filter/sort controls and the shared Clay domain mark; no emoji domain controls
- `logic/patternCatalog.ts` — initial bucket, pairless `other` domain, filter/sort and five-item clamped pagination; pure and unit-tested
- `pages/MemoirPage.tsx · KnowledgeListPage.tsx · ChatPage.tsx · PredictionsPage.tsx · ExperimentsPage.tsx` — the other 5 content sub-tabs, **all real dual-mode** (Memoir W2, Predictions P1, Experiments P2 — each with an honest null-state; ExperimentsPage adds the L2 accept/dismiss + propose write actions)
- **`KnowledgeListPage.tsx`'s view components (`components/{KnowledgeBaseView,KategoriakView,HowItWorksView}.tsx`, §2.4):** `KnowledgeBaseView` = the S6 hub base view — hero + four `HubTiles` + quiet links (RETIRED the pre-S6 approval-inbox/3-tile mosaic shape); `KategoriakView` = the `?view=kategoriak` grid⇄drill switch, thin over the moved `KindTileGrid`/`KindNodeList` below (`mezo-ms9a`, unchanged by S6); `HowItWorksView` = the `?view=hogyan` six Q&A cards (`mezo-ms9a`, unchanged by S6). **`components/FactsView.tsx`/`KnowledgeFactRow.tsx` are RETIRED (S6)** — their `?view=tenyek` behavior lives on as `components/hub/TenyekSection.tsx` over the shared `HubRow`. `components/ProfileView.tsx` is orphaned dead code left over from the `?view=profil` redirect (the communication editor moved to central settings, § above) — no current route renders it.
- **The S6 Tudástár hub (`mezo-d6ivw.6`, §2.4):** `components/hub/{TenyekSection,EmberekSection,EszrevetelekSection,HatasokSection}.tsx` — the four sections, one per hub tile; `components/hub/{HubTiles,HubFold,HubRow,HubSearch,ForgetUndoBar}.tsx` — the shared tile grid, collapsible topic fold, per-row card (icon/text/status/why/verbs), search field + no-hits state, and the undo countdown bar; `logic/{hubCopy,hubCounts,hubSearch,hubTopics}.ts` — all hub Hungarian copy (incl. the verb contract, `VERB`/`TOAST`/`stripNote`), the hero/tile/observation-status counting rules (`hubCounts`/`obsState`), the flat search+highlight helpers, and the six-topic observation grouper; `hooks/useForgetUndo.ts` — the 5 s undo window (`UNDO_MS`), unmount-commits-outstanding-forget policy; `data/insights/knowledgeHub{Api,Hooks}.ts` — the four hub reads/writes (`knowledgeHubApi`, `useKnowledgeObservations`/`useEffectSubjects`/`useFactEvidence`/`useKnowledgeHubActions`) and `groupEffectSubjects` (flat wire → per-subject cards). Backend: [`companion.md`](companion.md) "Elfelejtem/Elhallgattatom" (§3/§4/§10).
- **Moved from `features/me/` (`mezo-ms9a`, was the `KnowledgePage.tsx` overview-first Tudásgráf chain, `mezo-2243` originally — full behavioral history in the pre-merge [`me.md`](me.md) git blame):** `components/{KindTileGrid,KindNodeList,CategoryHeader,ProfileNodeCard}.tsx` + `sheets/NodeDetailSheet.tsx`. Unchanged by the move except their consumer: `KnowledgeListPage`'s `selectedId` state now owns the sheet (was `KnowledgePage`'s), and `KategoriakView`/`ProfileView` above call them instead of the deleted page rendering them directly.
- **`pages/MotorPage.tsx` is DELETED (`mezo-tk88.4`)** — the 8th sub-tab (`mezo-viqs`, redesigned `mezo-18bx`) is retired; its diagnostics folded into `PatternsPage.tsx` above (§2.8 carries the full retirement note + what did/didn't carry over)
- **`pages/WeeklyPage.tsx` is DELETED (`mezo-p2tr`)** — the 2nd sub-tab (D′ `mezo-t16y.1`) is retired; its content (score hero, growth card, tervjavaslat) moved verbatim to `/me/week` (§2.2), later split by `mezo-d20.6.10` into the `Heti` hub + view-pages ([`me.md`](me.md))
- `pages/MemoryPage.tsx` — **`mezo-al1i`**, the 9th sub-tab (now the 8th): read-only memory-pipeline observatory (§2.9), 4 page-local segments (`useStickyTab('insights.memoria.view')`) over `useMemoryOverview`/`useMemorySummaries`, one page-level degraded card (companion 404) + per-panel `GhostState`/degraded lines in Kereső/Audit, shown in both modes
- `components/Memory{LayerCard,LayersPanel,JournalPanel,SearchPanel,AuditPanel}.tsx` — **`mezo-al1i`**: the L0→L3 wash-tinted layer cards + cron-labelled pulsing `FlowConnector`s (Rétegek), the memoir-styled journal cards with month separators + embed dot + `focusDate` scroll (Napló), the lazy-submit search form (Kereső), and the two-block cost-hero/provenance panel (Audit) — §2.9 has the full per-panel breakdown
- `components/SimilarDayCard.tsx` — **`mezo-al1i`** the Kereső result card; **`mezo-eq85.10`** replaced the similarity ring + `egyezés × frissesség = végső` three-chip score row with the 1-based `rank` ring (the platform's RRF `finalScore` is not a 0..1 fraction); `onPick(date)` jumps the page to Napló focused on that day
- `components/TokenColumns.tsx` — **`mezo-al1i`** the Audit panel's small stacked SVG bar chart (`--dv-lav` input / `--dv-sage` output tokens per day)
- `data/insights/experimentsApi.ts` + `experimentsHooks.ts` — **P2** the Experiments consumer (`useExperiments()` → `GET /api/proactive/experiment`; `useExperimentActions()` → the decision/propose mutations)
- `data/insights/predictionsApi.ts` + `predictionsHooks.ts` — **P1** the Predictions consumer (`usePredictions()` → `GET /api/proactive/prediction`, list; `[]`→still-learning null-state)
- **`components/PatternCard.tsx` is DELETED (`mezo-tk88.4`)** — superseded by `PatternDecisionCard.tsx` below (the flat-inbox card had no lifecycle awareness; `highlighted`/`?pair=` scroll-and-ring is gone too, replaced by the `?pair=` → detail-route redirect, §2.1)
- `components/MotorStateHero.tsx` — **`mezo-tk88.4`**, the dashboard hero (§2.1 step 1): question count + confirmed/decide prose, the six `BUCKET_ORDER` tiles, the domain-chip filter row (`onToggleDomain`, the „Mind" chip's same-batch multi-toggle) — pure props, `bucketize()`'s counts computed by the caller
- `components/PatternDecisionCard.tsx` — **`mezo-tk88.4`**, the dashboard decision-inbox card (§2.1 step 2): category/confidence chips, the deterministic `findingSentence` block (never raw `r/p/n`), optional decision explainer, Confirm/Monitor/Reject and the detail link. Since `mezo-0469` the pair-backed detail page no longer reuses this inbox-shaped card, and since `mezo-me75u.13` neither does the pairless fallback.
- `components/LifecycleSection.tsx` — **`mezo-tk88.4`**, dashboard-only `LifecycleSection` (collapsible title+count card) + `LifecycleMiniRow` (title + one-line sub + detail link) for the five buckets and „Adat-egészség”. The detail page's former mismatched diagnostics reuse ended in `mezo-0469`.
- **`components/{HypothesisStateCard,PatternDetailHero,TestPlanTiles,PatternEvidenceChart,PatternStrengthChart}.tsx` (+ tests) are DELETED (`mezo-rstt7`, 2026-09-27)** — the catalog-hero/laborfüzet-hero split, the plan-tile pair, the value-kind-adaptive evidence chart and the strength-over-time chart are all superseded by the one-reading rewrite (§2.1b): `PatternAnswerHero` + `PatternZoneChart` + `PatternRuleCard` below now cover every row, plan or no plan. `PatternScatter.tsx` had already been deleted with `PatternEvidenceChart`'s introduction (`mezo-0469`).
- `logic/patternReading.ts` (+ test) — **`mezo-rstt7`**, the ONE pure reading module (§2.1b): `pearson`/`lean`/`classify` → `readPattern` (state), `answerLook` (word/tone/icon), `decisionPlan` (buttons/note/settled/revoke), `saySentence`/`ruleSentence`/`lagWord` (deterministic prose), `patternZones`/`niceTicks`/`mean`/`zoneValue` (chart math) — every word and color on the page traces back to this file.
- `components/PatternAnswerHero.tsx` (+ test) — **`mezo-rstt7`**, the page's one frameless answer hero (§2.1b step 1): domain-chip pair row, question, the big answer word/icon/tone, `saySentence`, the pre-answer Mezo quote, `PatternLeanMeter`/`PatternDayPips`, and the `decisionPlan`-driven decision block (buttons / settled line / revoke link). Exports `Bold` (the `**…**` → `<b>` inline renderer `PatternRuleCard` reuses).
- `components/PatternLeanMeter.tsx` (+ test) — **`mezo-rstt7`**, the „merre húz” band-and-dot meter (`PatternLeanMeter`, `now`/`then` ghost dot) and the day-tally pips (`PatternDayPips`, `count`/`of`) — both pure props over a `Lean`.
- `components/PatternZoneChart.tsx` (+ test) — **`mezo-rstt7`**, the „Mit mutat az adat” two-zone SVG (§2.1b step 2): binary/continuous zone split, conditional zone-average labels, tappable/keyboard-operable day dots with an OWN `useState` selection (never page state) and a small tooltip, `Napok listája ›` details table. Replaces `PatternEvidenceChart`.
- `components/PatternRuleCard.tsx` (+ test) — **`mezo-rstt7`**, „A szabály” flat card (§2.1b step 3): the pre-registered `ruleSentence` plus the day-progress/lag/window chip row. Replaces `TestPlanTiles`.
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
- `logic/useVoiceInput.ts` — **`mezo-at8x.4`** the record → convert → transcribe state machine (`unsupported | idle | recording | transcribing`); since **`mezo-zyyox`** it also returns `cancel()` (stop and discard, nothing transcribed) and `levelRef` (live mic loudness 0..1 from a Web Audio `AnalyserNode`, a ref so 60 fps never re-renders; 0 without Web Audio). Every consumer (ChatPage, JournalSheet, GratitudeRows, ReflectionStep, FuelLogModes, MealComposer) mounts **`shared/ui/voice/VoiceBubble.tsx`**, the **Hallgató Boop**: one glass bubble portalled into `.phone-screen` at z 300 with the domain Boop, phases listening (level-reactive, tap to stop, ✕ cancels) → thinking → done → sad (the hook's error, auto-hides). The bubble owns the error sentence, so the consumers' inline `voice.error` lines are gone. Spec: `docs/superpowers/specs/2026-09-25-hallgato-boop-design.md`
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
- **Proaktív coaching (§2.10, `mezo-6269.3`):** `pages/{CoachingHubPage,CoachingObserverPage,CoachingCardPage}.tsx` (+ tests) — the three routes; `components/{VerdictArc,CoachingRuleTile}.tsx` (+ tests) — the segmented-ring SVG and the bespoke rule tile (not `CollapsibleStrip`: that shared strip's header takes a `string` eyebrow and has no rank/icon slot, so the interaction contract — `aria-expanded`/`aria-controls`/hidden body — is copied exactly rather than widening a domain-free primitive for one caller); `logic/coachingCopy.ts` (+ test) — `CoachingState`/`stateOf`/`STATE_LABEL`/`STATE_CHIP`/`visualOf`/`washOf`/`splitOf`/`CoachingSplit`/`winnerRuleOf`/`losersOf`/`hhmm`/`dayLabel`, all defined once here (§2.10); `frontend/src/data/insights/{coachingTraceApi,coachingTraceHooks,coachingTraceMock,coachingCardHooks,coachingCardMock}.ts` (+ tests) — `useCoachingTrace`/`useCoachingCard` over `GET /api/companion/flags/trace` and the existing feed read, the demo day (`earliestDate` anchored 13 days before today) and the card mock derived from it (§2.10); `frontend/src/data/types.ts` — `CoachingTraceDay`/`CoachingRule`/`CoachingWinner`/`CoachingTransition`; re-exported from `hooks.ts:28-29`

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
