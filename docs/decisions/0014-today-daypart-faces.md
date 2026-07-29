# 0014 — Today is three sleep-anchored daypart faces, in one card language

- **Status:** Accepted
- **Date:** 2026-07-29
- **Driver:** `mezo-mvb4` (epic) · `mezo-1khu` (the closing slice); slices `mezo-jyua` → `mezo-ly8c` → `mezo-j7u4` → `mezo-1khu`

> **Numbering note.** The driving spec (§11) and the implementation plan both name this file
> `0011-today-daypart-faces.md`. `0011` was already taken by
> [`0011-public-repo-for-free-actions-ci.md`](0011-public-repo-for-free-actions-ci.md) by the time
> this ADR was written, and [`docs/README.md`](../README.md) forbids reusing a number, so it landed
> at **0014**. The two references in the frozen spec/plan artifacts were deliberately left alone —
> a dated design artifact is never rewritten.

## Context

`/today` (tab „Ma") is the PWA's landing surface. It grew by accretion across eight slices —
Napív S3 (`mezo-8141`), the gamified header (`mezo-k7rn`), action-first (`mezo-gj2y`), intention
(`mezo-a686`), ritual (`mezo-ilsj`), habit (`mezo-d1jb`), the sleep night-layer (`mezo-d71m`) and
the quest restyle (`mezo-vj0b`). Every slice was individually sound; the sum was not. Full-page
mock-mode captures at 09:12 and 21:05 produced four concrete defects (diagnosis in
[`specs/2026-07-29-today-daypart-redesign-design.md`](../superpowers/specs/2026-07-29-today-daypart-redesign-design.md) §1):

1. **Thirteen distinct card idioms on one screen** — `.intent`, `.dayarc`, `.np-hero`,
   `.card`+`.quest-row`, `.ritcard`, the `RoutineCard` `.hab-*` thread, `.beats`, `.brief`,
   `.scard`, the fuel left-rail list, `.wdb`, `.zonediv`, plus the plain `.card` three components
   wore — each with its own radius, accent, CTA shape and internal rhythm. The app's one genuinely
   repeatable card language was Train's `.todaycard`.
2. **No guidance** — ~2570 CSS px of scroll (≈3 phone screens) carrying **~14 co-equal CTAs**
   (`Indítsuk →`, `Edzés`, `+15 XP`, `Naplózz`, `Zárjuk le a napot ✨`, `Pipa` ×2, three chevrons,
   `koppints`, `bővebben`, `+ Log`, `+ Fókusz`, `szerkeszt`). Nothing stated what to do next.
3. **The screen was clock-blind.** At 21:05 it still rendered „KÖVETKEZŐ · MA 17:00 / Indítsuk →"
   (a past session in the future tense), the „Reggeli briefing · 06:30" at full size, and a fuel
   timeline marking 18:11 as `MOST`. Only the greeting, the habit chain and the ritual card were
   time-aware.
4. **Duplication.** The morning weigh-in was simultaneously a daily quest **and** a habit-chain
   row; the workout was simultaneously the hero, a quest **and** a habit row.

Constraint: **no functionality may be lost.** Restructuring, re-parenting and deleting redundant
surfaces were allowed and desired. Frontend-only — no backend, no API-contract change.

## Decision

**Today becomes three faces of one screen, selected by daypart, rendered in one card language.**

1. **Three sleep-anchored faces** — 🌅 `reggel` / ☀️ `nap` / 🌙 `este`, derived by the pure
   `features/today/logic/dayFace.ts` from `useSleepGoal()`'s `wakeTime`/`bedTime`: the **same
   anchor** `windDown.ts` and the Napzárás window already use, so the app has one clock and no
   drift. `MORNING_LEAD_MIN` (30) is deliberately the exact minute `windDownPhase`'s `night` ends,
   so the day closes a circle: `night → reggel → nap → este (dim → winddown) → night`. All math is
   minute-of-day and wrap-aware (a past-midnight bed works).
2. **`?dp=reggel|nap|este` is the single source of truth** for which face renders, following the
   `TrainTodayPage` `?day=` precedent: derived from the URL, never mirrored into state; `null`
   (absent) and `''` (blank) both mean „the current face"; an unknown value falls back to the
   current face; writes are `{ replace: true }` — face-hopping is a view switch, not a history step.
   **Act-anywhere:** every action on a face works while that face is merely *selected*, not current
   (a retroactive `Pipa` at 22:00, an early evening-stack log at 16:00) — generalizing
   `RoutineCard`'s midday-expand affordance (`mezo-km27`), whose whole point was retroactive logging.
3. **One card language.** Train's `.todaycard` is promoted into two domain-free `shared/ui`
   primitives — **`ItemCard`** (full size) and **`ItemRow`** (compact) — and every Today surface is
   re-dressed onto them. `features/train/components/TodaySessionCard.tsx` becomes a thin wrapper.
4. **One merged todo card** (direction B's contribution): `TodoCard` replaces `TodayQuestsCard`,
   `RoutineCard` and the standalone check-in/ritual sections with one progress bar, small-caps group
   headings and uniform rows. A pure normalizer, `logic/todayItems.ts`, collapses **six sources**
   (daily quests, habit chains, check-ins, fuel slots, train sessions, ritual/wind-down) onto one
   `TodayItem` shape, buckets them by face, **deduplicates** (defect 4) and partitions open vs. done.
5. **The four context blocks dissolve** — the standalone, action-less sections become content
   *inside* the card language rather than sections beside it: `DayArc` → `DayFaceStrip`'s per-pill
   open-item counters; `QuickStatsRow`/`QuickStat` („Ma eddig") → the briefing card's `.metapill`
   facts; `FuelTimelinePreview` → fuel `ItemRow`s in each face's `TodoCard`; `CheckInStrip` (the
   „Hogy vagy ma?" beats strip) → one `ItemRow` per slot, bucketed onto its own face. `ZoneDivider`
   goes with them — the faces own the split, and a within-face section line is `.zoneline`.
6. **Nothing leaves the app.** Content is time-bucketed, not exiled to a sub-page or another tab;
   Today simply stops duplicating what Fuel and Én already own.

## Consequences

**What this makes easy.** The screen follows the day structurally rather than by per-component
`daypartNow()` checks (defect 3 is fixed at the root, not patched per card). One normalizer means a
new source is one table entry, not a new card idiom; one card language means a visual change lands
once. The three faces each carry ~1 screen of content instead of ~3, and each has exactly one hero
CTA — the guidance defect 2 asked for.

**What we now have to maintain / live with:**

- **`useSleepGoal` is a root dependency of Today.** The face selection cannot be computed before
  the anchor resolves, so real mode renders a **layout-matched skeleton** (`pages/TodaySkeleton.tsx`,
  the `TrainTodaySkeleton` precedent) rather than flashing a face derived from the placeholder
  anchor. **Accepted imperfection:** one fixed skeleton cannot match all three faces — it mirrors
  two hero cards, which is exactly `FaceMorning` and the common `FaceEvening` shape, so `FaceDay`
  (always) and the first ~150 min of `FaceEvening` shrink by one hero card's height (~150–160 px) on
  the swap. Two cards is the honest majority match. `scenario.anchorMode` is checked **before** the
  pending gate — it derives synchronously from `?day=` and must never detour through a skeleton on
  the way to a calm recovery screen.
- **`DayArc.tsx` left Today, but `logic/dayArc.ts` survives it.** The Napzárás „A napod íve" act
  (`features/ritual/components/DayStoryStep.tsx`) reprises the same Bézier, importing
  `buildArcPoints`/`pointXY`. The module outliving its namesake component is a standing trap; the
  file says so at the top. Only `arcProgress` (the sun-dot cursor, DayStoryStep's one unused export)
  was dropped with the component.
- **`shared/ui` gained two primitives that Train also consumes**, so a change to either is
  cross-domain. The binding constraint during the extraction was that **Train Mai stay
  pixel-identical** — the `train-*` visual goldens were the proof and passed unchanged. One residual
  compromise: `ItemCard` imports `DoneBar` from `@/features/train/components/DoneBar`, so a
  `shared/ui` file reaches into a feature. That is inherited, not new (`DoneBar` is domain-free in
  substance); moving it is filed as follow-up rather than widening this change.
- **Four accepted trades, approved rather than fixed:**
  1. **The four check-in slots now live on separate faces.** The daypart model working as designed;
     the at-a-glance „Hogy vagy ma? 2/4" strip is gone by intent.
  2. **„Ma eddig" survives as briefing facts on the morning face only.** The approved content map
     puts the day's numbers there; the day and evening faces show none.
  3. **`ritual:day`'s `nav` action is unreachable because the `RitualCard` hero owns the route.**
     The hero *is* the route, soft-gated outside the window per [ADR 0010](0010-gamified-growth-xp-feedback-not-payment.md);
     `/ritual` stays reachable by URL any time.
  4. **The real-mode level-up double-fire inherited from `RoutineCard`** (the mutation's resolved
     payload plus the invalidated day read's cached payload) is unchanged. Parity over a silent
     behaviour change.
- **A whole class of regression had to be closed explicitly.** Three review rounds on the
  re-composition each surfaced *dead controls* — rows labelled with an action the new host could not
  serve — and every one of them passed a green suite. The class is closed by a `servableAction()`
  predicate in `TodayPage`'s `items` memo, which strips the action from any row this screen cannot
  serve (a button-less habit row picks up `habitHint`'s explainer instead), plus a real-fixture test
  that clicks every control on all three faces and requires an observable effect. **Its honest
  limit:** the net cannot catch a *missing* `questAction` mapping — the mock fixtures contain no
  such quest — so that gap is covered by targeted dispatch tests, not by the class net.
- **CSS shrank by whole families.** `.dayarc`/`.arc-*`, `.beats`/`.beat*`, `.scard`, `.zonediv`,
  `.np-hero*`, `.quest-*`, `.ritcard*`, most of `.intent-*`, the `.hab-*` chain thread, `.rt-*`,
  `.np-eventrow*`, `.alt-btn` and `.accent-strip` are gone (each replaced in place by a comment
  saying where its job went); `.itemrow`, `.dfs`, `.tdc`, `.fhc`, `.donefold`, `.creedchip`,
  `.zoneline` and `.faceswap` arrived. Ten components and `shared/ui/QuickStat.tsx` were deleted
  with their tests.
- **Visual coverage tripled for Today.** One clock-frozen `today` golden became
  `today-{reggel,nap,este}`, each pinning **both** `?dp=` and its own frozen clock — the clock alone
  is not sufficient, because it also decides which face is *current* versus *selected*.

## Alternatives considered

Four directions were prototyped as real browser mockups on the app's own tokens and fonts
([`2026-07-29-today-daypart-redesign-mockup.html`](../superpowers/specs/2026-07-29-today-daypart-redesign-mockup.html))
and reviewed side by side:

| | Alternative | Rejected because |
|---|---|---|
| **A** | **Akció-konzol** — one `MOST` hero + a compact list; briefing/arc/stats/fuel moved to a sub-page | Exiles too much. It re-dresses the same fourteen CTAs and pays for the calm by hiding context behind a navigation step. |
| **B** | **Műszerfal** — one scroll, four zones, unified cards, one merged todo card | Also only re-dresses the fourteen CTAs — it fixes the *idioms* (defect 1) but leaves the screen clock-blind (defect 3). **Its merged todo card was adopted** into the chosen direction. |
| **C+** | **Napszak-vezérelt + B's merged todo card** | **Chosen.** Only C fixes defect 3 structurally, and it reuses an idiom already proven in this app — Train Mai's `DayStrip` navigator over a single day's content, the surface Daniel named as the one that works. |
| — | **Fixed-hour dayparts** (e.g. 06–12 / 12–18 / 18–06) instead of sleep-anchored windows | Would introduce a **second clock**. `windDown.ts` and the Napzárás window are already anchored to `useSleepGoal()`'s wake/bed; fixed hours would drift against them, so a card could sit in the evening face while `windDownPhase` still said `none`. Reusing the anchor costs a `useSleepGoal` dependency + a skeleton (above) and was judged the cheaper price. |
| — | **A fourth „áttekintés" (overview) face** summarizing the whole day | Reintroduces the defect. An overview face is a fourth idiom whose content is by definition a duplicate of the other three, and it gives the user a place to stand that is not *now* — which is what made the old screen clock-blind. The whole-day view exists: `DayFaceStrip`'s three counters, and the Napzárás „A napod íve" recap for the retrospective. |
