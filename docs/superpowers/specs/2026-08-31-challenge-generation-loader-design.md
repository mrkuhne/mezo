# Challenge-generation loading screen — design

Date: 2026-08-31 · Scope approved by user (option: mission page only)

## Problem

On the prep flow's "A mai küldetések" page (`frontend/src/features/train/pages/prep/PrepKuldetesekPage.tsx`), the day's
challenges are LLM-generated lazily on first list read. While `useChallenges`
reports `pending`, the page shows only three skeleton bars and a misleading
`0/0` hero — the user sees "nothing" for the whole generation window.

## Design

Game-style loader replacing the `SkeletonText` in the pending branch:

1. **New component** `ChallengeGenerationLoader`
   (`frontend/src/features/train/components/ChallengeGenerationLoader.tsx`):
   - Rotating playful status lines (Hungarian, Mezo voice), cycling every
     ~2.2 s with a fade, looping while generation runs:
     „Edzésnapló átfésülése…”, „Formád felmérése…”, „Megmérettetések
     kalibrálása…”, „Küldetések kisorsolása…”, „Utolsó simítások…”.
   - Progress bar in Mozaik/coral style. No real backend progress exists, so
     it fakes it game-style: fast to ~40 %, then decelerating creep toward
     ~90 %; it never reaches 100 % on its own (completion = data arrival,
     at which point the whole loader unmounts and cards render).
   - `prefers-reduced-motion`: no animated fill/fade — static bar + text
     that still swaps (no transition).
   - `role="status"` + `aria-live="polite"` so the rotating line is announced.
2. **Page polish while pending** (`PrepKuldetesekPage`):
   - Hero big number shows `–/–` instead of `0/0`.
   - Stat cells show `…` instead of `0`.
3. **Hub tile quiet line** (`ActiveWorkoutPage` Küldetések tile): while
   `challengesPending`, the tile line reads „készül…” instead of
   „0/0 elfogadva”.

CSS goes in `frontend/src/styles/prototype.css` following the existing
`progress-mbar` / reduced-motion guard conventions (`mz-chload-*` classes).

## Testing

- Component test with fake timers: first message renders, advances after the
  rotation interval, loops past the end.
- `PrepKuldetesekPage` pending render: loader present, `–/–` hero, `…` cells;
  non-pending: cards render, loader absent.
- Hub tile: „készül…” while pending, `N/M elfogadva` after.

## Out of scope

Full-screen blocking transition, animated hub tile, real backend progress
events, the NapKuldetesekPage (daily quests) surface.
