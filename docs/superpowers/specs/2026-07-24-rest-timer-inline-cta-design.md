# Rest Timer Inline CTA-morph — active workout (design)

- **Date:** 2026-07-24
- **Status:** validated with visual-companion mockups (variant B + state walkthrough approved)
- **Scope:** frontend-only; `frontend/src/features/train/` + app-shell cleanup (`DynamicIsland` / `LiveActivityProvider` removal). **No API-contract or backend change.**
- **Driving issue:** `mezo-xt65`
- **Driving request:** the floating rest pill (Dynamic Island) overlaps the `wk-top` sticky header on `/train/session`; the warmup set is labelled twice (set dot `B1` + the `Bemelegítő · B1` chip); the timer has no pause/resume and skip is an accidental-tap hazard (tapping the pill body skips). The timer must become part of the page with explicit skip/pause/resume controls.

## Decision summary

Four placement mockups were browsed in a visual-companion session (A card-takeover · B CTA-morph · C under-header strip · D bottom dock); **B — the `Szett kész ✓` CTA morphs into the countdown bar — was chosen**, then a 4-state walkthrough (idle → running → paused → revert) was approved. Decisions locked with the user:

1. **CTA-morph, zero layout shift.** The bar is pixel-identical in size to the `.donebtn` it replaces; only the content swaps.
2. **Controls: ⏸ pause / ▶ resume + ⏭ skip.** The bar body is deliberately **not** tappable (kills today's accidental-skip-on-tap). **No ±15s** (rest durations are fixed 150s/90s heuristics — YAGNI; trivially addable later).
3. **No "Következő" label on the bar.** Mid-exercise the next set is visible right above (set dots + prefilled steppers); on an exercise's last set no rest starts at all (debrief takes over). This also **removes the documented dead-code finding** — the island's `next` label always showed the current exercise (`docs/features/train.md` §quirks) — by deleting the label concept entirely.
4. **The island rest display is removed.** `DynamicIsland` reverts to inert device chrome; rest state moves page-local into the Train feature.
5. **The `.stag` current-set kind chip is deleted** (both `Bemelegítő · B{n}` and `Working · {k}/{n}` variants) — the set dots alone carry the warmup/working distinction. Supersedes the `mezo-eerq` chip decision (owner call: the dots suffice).

## 1. `RestTimerBar` — states & visuals

A presentational component rendered in the `.excard` in place of the `Szett kész ✓` button whenever a rest is active.

| State | Fill | Label | Right-side buttons |
|---|---|---|---|
| *(idle — no rest)* | — | normal `.donebtn` `Szett kész ✓` | — |
| **running** | CTA gradient (`--cta-g1→--cta-g2`), width `remaining/total`, drains right→left, `width .5s linear` transition on the 500ms tick | eyebrow `PIHENŐ` + `m:ss` (`fmtMMSS`, tabular-nums) | ⏸ (pause), ⏭ (skip) |
| **paused** | same width, greyed (`--faint`), no animation | eyebrow `SZÜNETEL` + frozen `m:ss` | ▶ (resume), ⏭ (skip) |
| **expiry / skip** | reverts instantly to the idle `.donebtn` — no separate "done" state, no sound/haptic | | |

- Track: `--warm` with a subtle inset shadow; bar radius/padding matches `.donebtn` (999px pill, same height) — **zero layout shift** on morph.
- Buttons: white 34px circles (`--coral-deep` glyphs), real `<button>`s with `aria-label`s (`Pihenő szüneteltetése` / `Pihenő folytatása` / `Pihenő kihagyása`); container `role="timer"`.
- CSS: new `.restbar` block in `styles/prototype.css` next to `.donebtn`; dark theme falls out of the existing tokens (no hardcoded colors) — the always-dark island exemption dies with the island.

## 2. Behavior rules

- **Trigger unchanged:** `completeSet`'s continue branch (`ActiveWorkoutPage.tsx:389-393`) starts a rest of `restSecondsFor(current.type)` (150s compound / 90s other, unchanged) whenever more sets of the same exercise remain. An exercise's **last** set still starts **no** rest (debrief path).
- **One global rest per session, shown wherever you are:** the bar occupies the CTA slot of **whichever exercise is viewed** (free navigation/swipe included) — the rest belongs to the user, not the exercise. Logging on another exercise mid-rest therefore costs one ⏭ tap first; the new set starts a new rest anyway.
- **Pause freezes remaining** (`Math.ceil` seconds at pause); resume re-anchors `endsAt = now + pausedRemaining`.
- **Auto-revert at 0:00** — the hook clears itself; the CTA returns.
- **Clear paths unchanged:** exercise skip (`handleSkip`), exit (`onExit`), `summary`/`complete` phase, and unmount all clear the rest — a rest never survives past the session. Mid-rest reload loses the rest (in-memory state, same as today).

## 3. Warmup chip removal

Delete the `currentTarget` `.stag` block (`ActiveWorkoutPage.tsx:951-969`) entirely. `currentTarget`/`isWarmupSet` **stay** — they still drive the RIR-row visibility and the `kind` field of the `SetLogRequest` payload. The read-only set list below the card keeps its per-row `Bemel.`/`Working` tags (different surface, not duplicated with the dots).

## 4. Architecture & file map

| Change | File |
|---|---|
| **NEW** stateful hook `useRestTimer()` → `{ status: 'idle'\|'running'\|'paused', remaining, total, start(seconds), pause, resume, skip }`; internal state `{endsAt,total}` vs `{pausedRemaining,total}`; 500ms tick while running; self-clears at 0 | `features/train/logic/useRestTimer.ts` (+ colocated test) |
| **NEW** presentational bar (props `{remaining, total, paused, onPause, onResume, onSkip}`) | `features/train/components/RestTimerBar.tsx` (+ colocated test) |
| Swap `useLiveActivity` → `useRestTimer`; render `RestTimerBar` in the CTA slot while `status !== 'idle'`; drop the `next:` computation; delete the `.stag` chip block | `features/train/pages/ActiveWorkoutPage.tsx` |
| `.restbar` styles; **remove** `.dynamic-island.live` + its `.ring/.lt1/.lt2/.lnext` rules | `styles/prototype.css` |
| **DELETE** — `PhoneFrame` renders the plain `<div className="dynamic-island" />` inline again | `app/DynamicIsland.tsx`, `app/DynamicIsland.test.tsx` |
| **DELETE** provider; unwrap `AppLayout` | `app/providers/LiveActivityProvider.tsx`, `app/AppLayout.tsx` |
| `fmtMMSS` / `restSecondsFor` unchanged | `features/train/logic/restTimer.ts` |

`useRestTimer` lives in `logic/` beside `restTimer.ts` (feature-local logic; placement re-checked against `docs/references/frontend_conventions.md` at implementation time).

## 5. Testing

- **Hook** (fake timers): start→ticks down; pause freezes; resume continues from frozen value; skip and natural expiry both land on `idle`.
- **Page** (`ActiveWorkoutPage.test.tsx` updates): logging a non-final set swaps the CTA for the bar; ⏭ restores the CTA; the bar persists when swiping/jumping to another exercise; the `Bemelegítő · B{n}` chip is gone while the `B1` set dot remains; exercise skip / exit / summary clear the bar. Existing island-related assertions rewritten against the bar.
- **Removals:** `DynamicIsland.test.tsx` deleted with its component.
- Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green).

## 6. Documentation updates (same change)

- `docs/features/train.md` — rewrite the Rest Live-Activity paragraphs (§2, §9 seam row, quirks §: dead-`next` finding resolved-by-removal, island always-dark exemption gone, `mezo-eerq` chip row) to describe the in-card `RestTimerBar`.
- `docs/features/_platform-design-system.md` — drop the live-island exception note (§2); the `.dynamic-island` mockup chrome note stays.
- `node scripts/lint-docs.mjs` to clear staleness.

## 7. Out of scope

- ±15s adjust buttons; end-of-rest sound/haptics.
- Per-exercise configurable rest duration (needs a data-model field — stays a Phase-2 backlog candidate, `train.md` §data-gaps).
- Rest persistence across reload (in-memory, as today).
