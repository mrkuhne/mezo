# Mezo — Slice 1 (Today) Implementation Design

> **Date:** 2026-06-03
> **Status:** Approved (brainstorming) → next: writing-plans for the Today slice
> **Scope:** Phase 1, Slice 1 — the Today screen + its two global sheets + supporting
> widgets and dynamic states, on **mock data**, to pixel-parity. Builds on Slice 0 (Foundation).

## Source of truth (the locked design)

- `/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/src/today.jsx` — the Today screen
  (12 sections + `AnchorModeView` + `QuickStat`, `VolleyballTodayCard`, `FuelTimelinePreview`).
- `.../prototype/src/checkin.jsx` — `CheckInSheet` (5-step wizard + `CheckInObservation`, `CHECKIN_DIMS`).
- `.../prototype/src/quickinput.jsx` — `QuickInputSheet` (5 modalities).
- `.../prototype/src/frame.jsx` — `RetaPhaseBar`, `StatBar`, `ToolChipRow`, `RefTag`.
- `.../prototype/src/data.js` — mock data shapes (the `window.MezoData` object).
- `.../02-screens.md` §"TAB 1 — Today" and §"Global sheets"; `.../04-data-model.md` for shapes.

Reproduce values/copy verbatim (Hungarian copy exact). Parity is verified against the prototype.

## Builds on (Slice 0 Foundation — reuse, do not rebuild)

Reused primitives: `NotchCard`, `Chip`, `ToolChip`, `ToolChipRow`, `RefTag`, `Eyebrow`, `LabelMono`,
`Display`, `PageTitle`, `CtaPrimary`/`CtaGhost`, `ProgressBar`, `Sheet`, `Icon`, `BrandGlyph`,
`PhoneFrame` (incl. its `anchor` prop), `ScreenContent`, `Fab`, `TabBar`, the theme system,
`SafeMarkdown`, `cn`. Mock-data hooks pattern + scenario-from-URL is introduced here.

## Decisions (made during brainstorming)

1. **Dynamic states via URL/scenario params.** A `useTodayScenario()` hook resolves state from the
   URL with mock defaults: `?day=good|medium|rough` (default `medium`; `rough` → AnchorMode),
   `?niggle=on|off`, `?vulnerable=on|off`; `retaDay` from mock (default 3, overridable `?retaDay=N`).
   No production UI; deep-linkable so the parity harness screenshots each variant. In Phase 2 the same
   hook reads real data — screens unchanged.
2. **Cross-slice CTAs/links navigate to the target tab placeholder** via react-router (workout teaser
   + "Indítsuk" → `/train`; "Fuel → Terv" → `/fuel`; "Insights → Patterns" → `/insights`; volleyball
   chevron → `/train`). The active-workout-mode itself is the Train slice's concern.
3. **`SafeMarkdown`** renders the briefing `**bold**` (no `dangerouslySetInnerHTML`).
4. **`CheckInSheet`** is owned by `features/today/`; **`QuickInputSheet`** lives in
   `features/quickinput/` and is wired into the shell `Fab` in `AppLayout` (replacing the Slice-0
   placeholder sheet).
5. **Conditional cards** (volleyball, vulnerability) are gated by mock-data presence + scenario.
6. **Backend (future, out of scope):** Java/Spring Boot per the recorded decision; the mock-hook
   layer is the backend-agnostic seam (Phase 2 swaps hook internals to a Spring Boot REST API).

## Decomposition (6 task groups, the Today beads epic)

### T1 — New shared widgets (`src/components/ui/`)
- `RetaPhaseBar` — 7-segment reta gradient (D1→D7); segment `active` (glow) / `past` (dim) / future
  (`--surface-2`), colors `--reta-d1..d7`; prop `day: number`. (Reused on Fuel later.)
- `QuickStat` — `{ label, value, unit, delta }` card (notch-4): mono label, Antonio value + mono unit,
  mono delta. (Maps the prototype's `QuickStat`.)

### T2 — Mock data layer (`src/data/`)
Typed modules ported from `data.js` (only the slices Today consumes), each with TS types matching
`04-data-model.md`:
- `today` (dayLabel, dateLabel, workoutType, retaDay, mesoPhase), `user` (weekInMeso, dayInWeek, mesoLabel)
- `briefing` + `briefingVariants` (good/medium=null/rough): eyebrow, body[], refs[], confidence
- `checkins` (time, state: done|now|skipped|pending, values?{energy,stress,body,mental}, note?)
- `workout` (title, durationEst, exercises[], `niggleWarning`)
- `sport.schedule.volleyball.sessions[]` (for the conditional volleyball card; uses `today` flag)
- `fuelPlan.today.slots[]` + `KIND_META` (shared constant; reused by Fuel later)
Hooks: `useToday()`, `useCheckins()` (returns slots + a `saveCheckIn(idx, data)` mutating local state),
`useFuelPreview()` (now + next 2 slots), `useTodayScenario()` (URL → resolved `{dayState, retaDay,
niggle, vulnerable, anchorMode}`). Hooks isolate the data source for the Phase-2 swap.

### T3 — Today static screen (`src/features/today/`)
`TodayScreen` composes focused sub-components (one responsibility per file), rendered inside
`ScreenContent`, on default mock:
`BrandRow` · `RetaPhaseSection` (RetaPhaseBar + D{n}/7 eyebrow + phase descriptor) ·
`DateMesoHeader` (eyebrow, "Ma · {workoutType}", Week/Day + phase + meso chips) ·
`BriefingCard` (notch-12 + accent strip, eyebrow + confidence, `SafeMarkdown` body, `RefTag` footer) ·
`WorkoutTeaser` (incl. `NiggleBanner`, title, counts, first-3 exercise chips, Prediction footer) +
the `Indítsuk` `CtaPrimary` · `VolleyballCard` (conditional) · `VulnerabilityCard` (conditional) ·
`FuelTimelinePreview` (notch-12 + glow strip, next 3 slots via `KIND_META`, `MOST` chip, AI note) ·
`QuickStatsRow` (3× `QuickStat`) · `InsightsTeaser`. Cross-slice CTAs navigate (decision 2).

### T4 — Check-in (`src/features/today/`)
- `CheckInStrip` — the 4-slot grid on Today (done→avg score, now→`tap`, skipped→`—`, pending→`•`),
  opens the sheet on tap.
- `CheckInSheet` — built on the `Sheet` primitive: 5-step wizard (4 `CHECKIN_DIMS` + summary/note),
  reactive `CheckInObservation`, save → `saveCheckIn` updates the strip's local state.

### T5 — QuickInput (`src/features/quickinput/`)
- `QuickInputSheet` — 5 modalities (voice: simulated record→transcribe→parsed entity preview;
  photo; number; chip; text). Wired into `AppLayout`'s `Fab` (replace the Slice-0 placeholder).
  Phase-1 commit = close (optional brief confirmation; no persistence).

### T6 — Dynamic states + AnchorMode
- `useTodayScenario()` (T2) drives: briefing variant (good/medium/rough), niggle banner, vulnerability
  card, and AnchorMode.
- `AnchorModeView` (`features/today/`) — warm-palette full-screen replacement on `day=rough`
  (anchor eyebrow, two-line title, companion message, "Mai három horgony" 3 actions, weekly-paused
  note, `Kilépés`). The `PhoneFrame` `anchor` prop (Foundation) supplies the warm canvas; `AppLayout`
  passes `anchor` when the Today scenario is rough.

## Data flow

Screens read from typed mock via hooks. Check-in writes to local component state (mock stands in for
the server). Scenario comes from the URL. No network/auth/persistence (theme excepted). The hook layer
is the only thing Phase 2 changes (to a Spring Boot REST API via TanStack Query).

## Verification & testing

- **Unit (Vitest + RTL):** `RetaPhaseBar` (active/past/future segment classes for a given day),
  `QuickStat` (renders label/value/unit/delta), `useTodayScenario` (param parsing + defaults),
  `useCheckins` (saveCheckIn updates a slot to done with avg-able values), `CheckInSheet` (step
  advance, summary edit, save calls onSave with values), `CheckInStrip` (slot states + opens sheet).
- **Parity (Playwright/MCP @440×956):** extend the harness to screenshot `/today` (default) and the
  variants `/today?day=rough` (anchor), `?day=good`, `?niggle=on`, `?vulnerable=on`, plus the two
  sheets open (CheckInSheet, QuickInputSheet) — compared to the prototype's matching states.
- **"Done":** all Today sections + both sheets + AnchorMode built; pixel-parity at default + variants;
  no `dangerouslySetInnerHTML`; tokens instead of stray `rgba()`; cross-slice nav works; check-in
  updates the strip; dark + light both correct on Today.

## Target file structure (added by this slice)

```
src/
  components/ui/
    RetaPhaseBar.tsx        # T1 (+ test)
    QuickStat.tsx           # T1 (+ test)
  data/
    today.ts                # T2 mock + types (today/user/briefing/workout/sport/fuelPlan slices)
    checkins.ts             # T2 mock + types
    kindMeta.ts             # T2 shared KIND_META constant
    hooks.ts                # T2 useToday/useCheckins/useFuelPreview/useTodayScenario
  features/
    today/
      TodayScreen.tsx
      components/            # BrandRow, RetaPhaseSection, DateMesoHeader, BriefingCard,
                            #   WorkoutTeaser (+NiggleBanner), VolleyballCard, VulnerabilityCard,
                            #   FuelTimelinePreview, QuickStatsRow, InsightsTeaser
      CheckInStrip.tsx
      CheckInSheet.tsx      # + CheckInObservation, CHECKIN_DIMS
      AnchorModeView.tsx
    quickinput/
      QuickInputSheet.tsx
  app/
    AppLayout.tsx           # MODIFY: wire QuickInputSheet to Fab; pass anchor from scenario
tests/parity/foundation.spec.ts  # EXTEND: today + variant + sheet screenshots
```

## Out of scope (this slice)

- Backend of any kind (Java/Spring Boot per decision — Phase 2), real persistence, AI text generation.
- Active workout mode, mesocycle screens (Train slice). The workout teaser only navigates to `/train`.
- Other tabs (Me/Fuel/Insights) beyond their existing placeholders.

## Next step

writing-plans for the Today slice (T1→T6 → concrete TDD tasks), then subagent-driven build with
per-screen parity verification against the prototype.
