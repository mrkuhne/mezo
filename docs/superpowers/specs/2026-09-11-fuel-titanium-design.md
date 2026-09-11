# Fuel Titanium rebuild — design spec

Driving issue: `mezo-jb84`. Date: 2026-09-11. Owner brainstorm completed in Hungarian,
one question at a time, per the
[Titanium production rebuild handoff](../../design_2.0/2026-09-10-titanium-production-rebuild-handoff.md).
This spec freezes the approved concept; the per-capability coverage record (phase 4) and the
interactive prototype (phase 5) follow before any production code.

## Problem

The Fuel domain is the widest remaining non-Titanium slice (~6 CODEMAP blocks, ~44 backend
operations, 21 routed pages, 15 sheets). The owner's daily job is meal logging and it must be
lightning fast; recipes and pantry are rarely used and currently occupy two of the four premium
domain destinations, while the weekly/long-term picture has no home at all.

## Owner decisions (2026-09-11 brainstorm)

1. **Scope:** all four Fuel destinations in this slice (discussed, prototyped, then implemented
   via subagents after explicit prototype approval).
2. **New destination set:** `Mai · Konyha · Trendek · Kiegészítők` — replacing
   `Mai · Receptek · Kamra · Kiegészítők` from the handoff §6 table.
   - **Konyha** = Receptek + Kamra merged under one page (owner: both are rarely used;
     the two everyday actions are *saving a recipe* and *adding a pantry item*).
   - **Trendek** takes the freed slot. Hero: "Jól ment a hetem?" (weekly picture); below it
     the longer horizon (intake × weight over weeks) and recognized patterns. All three
     present, weekly picture is the protagonist.
3. **Logging priority order:** photo → voice → typing → repeat/favorites. The log surface
   opens camera-first; mic, keyboard and a time-of-day-ranked "szokásosak" row are one tap away.
4. **Kiegészítők:** today's dose checklist first (one-tap check-off, grouped by time band);
   protocol management ("what/why I take") one level deeper.
5. **No 3D companion on any Fuel page** — owner explicitly removed it from all four
   (overrides the handoff's compact-companion task-page default for this domain).
6. **Bevásárlás (shopping) is DEFERRED** from this slice — owner decision; gets a formal
   `DEFER` row + bd follow-up in the coverage record. Not a DROP.
7. **Settings** (daily budget, diet principles) live behind a quiet corner entry on Fuel Mai.

## Page roles

### Mai — "Hogy állok ma, és naplózzunk villámgyorsan"

Keeps the already-approved visual calibration
([me-nap-deep §Fuel visual calibration](../../design_2.0/2026-09-10-titanium-me-nap-deep.md)):
open borderless energy instrument — large dimensional 3D bowl in a progress arc, dominant
remaining-kcal numeral, compact `keret − étel + mozgás` equation, four animated
protein/carb/fat/fibre rings (staggered rise on entry and day change), ONE icon-led log action,
flat meal rows (large icons + numbers, no card-per-row). No companion header. Shared date
navigation contract applies (one selected date with Súly/Alvás/Napló/Edzés Mai; horizontal
swipe = one day; arrows + calendar alternatives; cross-domain switch preserves the date).
Water logging and the day timeline stay on Mai (exact placement decided in coverage audit).

### Konyha — "Mentsd el, ami jött"

Two large quick-capture actions on top: save a recipe (URL/photo import, Műhely handoff) and
add a pantry item (photo import supported). Below: browsable recipe library and pantry stock.
"What can I cook from what's home" moves one level deeper. Shopping list: deferred (see above).

### Trendek — "Jól ment a hetem?"

Hero: the week's days against the budget, weekday/weekend contrast — adherence-neutral framing
(no red/shame; "így alakult", never "elrontottad"). Below: intake × weight long-horizon view and
nutrition patterns. Patterns remain canonically owned by Mezo/insights — Trendek references the
canonical items, never duplicates them (MERGE rule: one canonical home).

### Kiegészítők — "Mit veszek be ma?"

Today's doses grouped by time band with one-tap check-off as the protagonist. Protocol
(reasons, editing, placement engine) one level deeper. Medication surface belongs here too;
note it is production-empty by owner decision (mezo-lwmq) — needs its own coverage row, do not
silently drop or "fix".

## The lightning log flow

1. Entry: the one primary log action on Mai; the global quick-log FAB routes to the same surface.
2. Opens camera-first: photo → AI recognition prefills the meal; user approves or corrects.
3. One tap to: mic (speak it), keyboard (type it), "szokásosak" (recent/frequent items ranked by
   time of day + recency — FoodNoms pattern).
4. Nothing is ever finalized without user confirmation; AI uncertainty is honest (`tanulom`).
5. On save, bowl and rings animate to the new state.

States the prototype must demonstrate: empty day, historical day (swiped back; late logging to a
past day), photo-recognition failure (graceful manual fallback), loading, and
`prefers-reduced-motion` variants.

## Prior art

Researcher report (5 sources), adopted/rejected:

- **MacroFactor dashboard revamp** — adopted: adherence-neutral coloring; dual-mode budget hero
  is the poster-card model; analytics pushed into slide-in details.
  https://macrofactor.com/dashboard-revamp/
- **FoodNoms** — adopted: multi-modal quick log with time-of-day + recency "smart suggestions"
  row; rejected: bar-based goal display (Titanium uses rings/gauges).
  https://www.macstories.net/reviews/foodnoms-a-privacy-focused-food-tracker-with-innovative-new-ways-to-log-meals/
- **Oura 2025 redesign (5→3 tabs)** — adopted: time-horizon split; Nap surfaces only
  time-relevant fuel slices, Fuel owns the canonical rings/timeline/logging (anti-duplication
  rule). https://ouraring.com/blog/new-oura-app-experience/
- **Whoop three-tier density hierarchy** — adopted: tier-1 big dial → tier-2/3 detail via
  slide-in; consistent semantic state palette; rejected: single dense scroll composition.
  https://www.925studios.co/blog/whoop-design-breakdown
- **MyFitnessPal redesign critiques** — adopted as anti-pattern checklist: logging ≤1 tap from
  Fuel itself; the page is both summary and logging surface; every tile must pass "does this
  change what I eat next?".
  https://uxdesign.cc/ui-ux-case-study-designing-an-improved-myfitnesspal-experience-3492bbe4923c

## Codebase terrain

Investigator report (CODEMAP-first), key facts:

- **Blocks:** `fuel`, `meal`, `nutrition`, `pantry`, `recipe`, `medication` + companion tools
  (`FuelTools`, meal/pantry/recipe LLM adapters), quickinput, notifications. Contracts:
  `api/feature/{fuel,meal,diet-settings,pantry,recipe}/*.yml` (~44 ops).
- **FE today:** 21 flat routes under `/fuel` ([router.tsx:264-296](../../../frontend/src/app/router.tsx)),
  hub `FuelMaiPage` (KeretHero + mosaic), the 556-line `MealComposer` shared by sheet and page
  flows, pure-VM layer (`logic/fuelSwimlane.ts`, `logic/keretHero.ts`), dual-mode hooks in
  `data/fuel/*` re-exported via `data/hooks.ts`.
- **Rebuild precedent:** nap-mai-titanium (PR #630, merge 938876a63) — frozen coverage record →
  spec → plan → SDD; manifest decision IDs cited in page comments; mozaik/clay primitives +
  `titan-*` CSS in `prototype.css`; `useForceTheme('dark')` via the hardcoded `titanDark` path
  list in [AppLayout.tsx:57](../../../frontend/src/app/AppLayout.tsx) — Fuel conversion must
  grow or generalize this list.
- **Traps:** all Fuel register rows are `UNKNOWN` until the coverage conversation; medication is
  deliberately production-empty (mezo-lwmq); `VITE_USE_MOCK` unset = mock; `pnpm test -- <file>`
  filters are ignored (CI=true + full-suite discipline); date-fragile fuel fixtures (anchor
  dates); contract-drift gate on any yml touch; CODEMAP regeneration after merges;
  `prototype.css` ~12k lines is the main conflict surface; several Plan/replan hooks are
  mock-only — honest-null differences will surface.
- **Staleness:** `docs/features/fuel.md` structure is trustworthy but pre-Titanium; re-verify §3
  hook details. CLAUDE.md's "Mozaik 2.0" design section lags the Titanium canon; the Titanium
  handoff is operative.

## What this slice does NOT do

- No change to the five-domain bottom nav or other domains (Nap/Edzés/Mezo/Én untouched except
  the shared mechanisms they already expose).
- No shopping-list UI (deferred, bd follow-up).
- No duplication of insights/patterns — Trendek links to canonical Mezo items.
- No weakening of the dual-mode hook contract, ownership/security rules or preservation tests.

## Next steps

1. Phase 4: dated coverage record `docs/design_2.0/2026-09-11-fuel-coverage.md` — expand every
   capability of the 6 blocks into rows; owner decides KEEP/MERGE/MOVE/DEFER/DROP per row in
   Hungarian batches; closure record before prototype.
2. Phase 5: extend `docs/design_2.0/prototypes/companion-titanium/` with the four-page Fuel
   flow; verify at 390–430 px, reduced motion, no horizontal overflow; owner approves explicitly.
3. Phases 6–9 per the handoff: plan → SDD implementation → reviews → PR/CI/premerge → merge →
   deploy → production smoke.
