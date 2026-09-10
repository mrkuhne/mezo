# Nap → Mai — Titanium production rebuild (slice 1: landing page)

Date: 2026-09-10. Status: concept approved by owner; coverage audit pending.
Workflow: [Titanium production rebuild handoff](../../design_2.0/2026-09-10-titanium-production-rebuild-handoff.md),
[ADR 0041](../../decisions/0041-feature-coverage-before-titanium-production-rebuild.md).
Prototype reference: [Én/Nap deep](../../design_2.0/2026-09-10-titanium-me-nap-deep.md),
`docs/design_2.0/prototypes/companion-titanium/` (`nap.html#nap/0`).

## Problem

The Nap landing page (`/nap`, `NapHubPage`) is the app's front door: morning arrival,
orientation and entry into every daily detail. It must be rebuilt production-quality in the
approved Titanium direction — living liquid-titanium companion, tile mosaic, data as graphics —
while preserving every current capability per the frozen coverage manifest.

## Owner decisions (brainstorm, 2026-09-10)

1. **First production page: Nap → Mai.** It lays down the shared foundations (companion,
   tile mosaic, quick picker, shell integration) that later pages reuse.
2. **Scope A — landing page only.** Beszélgetés, Rutin, Napzárás and the deep editors stay in
   their current form; tiles link to existing detail pages. They are rebuilt in later slices.
3. **One-tap tile logging: water only.** The hydration tile carries a small `+` that logs one
   glass immediately (undoable). Everything else goes through the quick picker or detail pages.
4. **Structure: companion + one next step + six stable tiles.** Full-size companion with
   daypart greeting and ONE computed next step (Oura "One Big Thing" pattern). Six live tiles
   (hydration, sleep, intake, gym, routine, journal) in a stable order; daypart changes only the
   greeting and the suggested step, never tile positions (Headspace pattern: stable skeleton,
   adaptive hero). Rejected alternatives: event-feed-first layout (slower "where am I now"
   answer, diverges from approved prototype) and daypart tile reshuffling (destroys spatial
   memory).
5. **No day paging on Nap Mai.** Confirmed against the approved prototype
   (`day-navigation-state.js` `dayRoute`: paging covers me 1–3 and fuel/train 0 only) and
   current production (pinned to `localDateString()`). Nap Mai is always today; historical
   inspection lives on the detail pages.

## Primary flow

Enter → full-size living companion greets by daypart → ONE highlighted next step (noon: water,
training window: workout, evening: napzárás; quiet state after day close) → six live tiles show
the day's state as graphics (rings/gauges/numbers) → any tile opens its existing detail page.
Floating `+` opens a full-page quick picker (≤2 taps to any log flow); water tile logs one glass
in one tap with undo.

## States

- Daypart adapts greeting + next step only (single-sourced via `useDayFace`/`useMinuteTick`).
- After napzárás the page calms down (closing state from ritual data).
- Honest states doctrine: nothing numeric renders while pending; empty is honestly empty.
- `prefers-reduced-motion`: companion renders as a calm static/low-motion variant; entrance
  choreography and ring animations degrade gracefully.
- Companion presence: production has no Titanium companion renderer yet (prototype uses
  Three.js, >500 kB warning). Production approach: lazy-loaded renderer with a static fallback
  for reduced-motion/low-end; exact engineering decided in the implementation plan. The visual
  outcome must match the approved prototype either way.

## Prior art

Researcher report (2026-09-10, 5 sources):

- **Finch** — companion-as-centerpiece home; the creature is a live gauge of the day with idle
  micro-animations. Adopt state-reactive presence; reject the cluttered task list under the pet.
  (ixd.prattsi.org design critique; screensdesign.com showcase)
- **Oura app rebuild** — "One Big Thing": one prioritized daily insight above compacted scores;
  trends pushed off the daily screen. Adopt as the next-step brain; reject text-card insight
  style. (ouraring.com/blog/new-oura-app-experience)
- **Apple Fitness** — swipe-the-summary day paging. Validates the shared date axis on detail
  pages; Nap Mai itself stays today-anchored. (support.apple.com iph4c34a8a95)
- **Headspace Today tab** — time-of-day re-prioritization with a stable layout skeleton. Adopt
  hero-layer adaptation only. (help.headspace.com 1260803328650)
- **MyFitnessPal** — classic FAB quick-add with typed shortcuts; its 2025 redesign backlash
  shows tap-count-to-first-log is the survival metric. Budget: ≤2 taps to any log flow, 1 tap
  for water. (bentobunny.app MFP UI guide)

Recurring failure mode across all sources: clutter and logging friction. The six-tile mosaic and
quick-add path stay minimal even as the companion layer gets richer.

## Codebase terrain

Investigator report (2026-09-10, CODEMAP-first):

- **Target**: `frontend/src/features/today/pages/NapHubPage.tsx` (hooks held at lines 27–46),
  routed at `frontend/src/app/router.tsx:198-209` (`/nap` + subroutes + `today/*` redirects).
- **Day model to keep untouched** (survived five render swaps): `features/today/logic/`
  (`dayFace.ts`, `useMinuteTick.ts`, `needs.ts`, `windDown.ts`, `habitAction.ts`,
  `questAction.ts`, `mezoMessages.ts`).
- **Data boundary**: all reads/mutations via `@/data/hooks`, dual-mode (mock seed / real query).
  Water: `useWaterActions(date)` (`data/fuel/fuelHooks.ts:120`, mock mutates `['fuelDay',date]`
  cache, real POSTs `/api/water-log`). Sleep: `useSleep` — **`duration` is HOURS on the wire**.
  Journal tile: `useJournalNotes(from,to)`. No new backend needed for slice 1.
- **Shell ownership**: header (daypart switch, Mezo badge, bell, DayOrb) lives in
  `AppHeader`/`AppLayout`; `MezoThreadProvider` is the single thread/unread owner; chrome-free
  surfaces extend the `hideChrome` flag, never fork headers.
- **UI kits**: `shared/ui/mozaik` (`Tile`/`Mosaic`/`EntranceGroup`/`useCountUp`),
  `shared/ui/clay` (sprites mounted once in `AppLayout`), `--mz-*` tokens in
  `styles/prototype.css`.
- **Guard tests to update deliberately**: `todayScope.test.ts` (retirement list),
  `todayTapTargets.test.ts` (≥44 px), `todayCssTokens.test.ts`, `hubHeaders.test.tsx`.
- **Traps**: CODEMAP regeneration in the same change; both explicit mock/real test modes
  (`VITE_USE_MOCK` unset = mock; `pnpm test` file filters don't scope); `useCompanionFeed`
  returns `[]` in mock mode (feed chips are real-mode-only by design); `prototype.css` union
  merges have cut `@media` braces four times (build is its own gate); tested-but-unrendered
  exports under `features/today/` — green tests ≠ live surface; growth/quests must not silently
  return to or vanish from Nap (explicit coverage rows).
- **Staleness found**: `docs/features/today.md` §8/§10 still cites retired visual goldens
  (mezo-ryb6); its §3 hook list predates `useGamificationDay`, `LifeGoalTodayTile` and the
  intention chain-prompt logic — trust `NapHubPage.tsx`, not the doc, when freezing coverage.

## Out of scope (this slice)

Beszélgetés/Rutin/Napzárás pages and deep editors; day paging on Nap Mai; any backend change;
the shared multi-domain date state (arrives with the first paged detail page slice).

## Next phase

Full feature coverage audit: expand the Nap starting set (`today`, `habit`, `intention`,
`needs`, `ritual` + mandatory related checks) into per-capability rows in a dated coverage
record; owner decides every row (KEEP/MERGE/MOVE/DEFER/DROP); no prototype work while a
relevant row is UNKNOWN.
