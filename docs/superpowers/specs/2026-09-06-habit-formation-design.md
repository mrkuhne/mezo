# Szokás-formálódás nézet — design spec (mezo-08zl)

- **Issue:** mezo-08zl · **Date:** 2026-09-06 · **Round:** superpowers:brainstorming + brainstorm-recon
- **Prototypes:** `docs/design_2.0/prototypes/rutin-formalodas.html`,
  `docs/design_2.0/prototypes/rutin-szerkeszto-valasztas.html`

## Problem

A habit's page shows the recipe and a 28-day *proportion* strip. Nothing says **where the user
stands on the way to automaticity**: how formed the habit is, how many more repetitions it
plausibly takes, or whether the context that predicts formation is stable. The 28-day window
also truncates the arc that matters (Lally's median is ~66 days).

The estimate must be computed from the user's OWN data — not a fixed "21 / 30 / 66 days"
template — and a missed day must slow the curve, never reset it.

## Product decisions (Daniel, 2026-09-05/06)

1. **Model:** repetition-based saturating curve, **context-weighted** — `k` is driven by the
   user's own consistency *and* by context stability (the strongest predictor in the literature).
2. **Estimate display:** a **range**, never a point estimate ("1–12 hét", "3–6 hónap").
3. **Threshold wording:** the stage label leads ("kezd magától menni"), the percentage is
   secondary. Language, not a grade.
4. **Misses:** slow the curve, never reset. No streak counter, no red — upholds
   `docs/design_2.0/2026-09-02-rutin-epito-design-iterations.md` §3 and ADR 0010.
5. **History surface:** on the habit page in this slice (full-lifetime calendar + weekday
   breakdown + smoothed consistency); a dedicated `/elozmeny` subpage is a follow-up.
6. **Editing:** moved to its own page (choice board option **B**) — see "Follow-ups".

## The estimator

A pure, Spring-free class: `HabitFormationEstimator` (unit-tested; the domain's first plain
unit test — precedent `HabitFrameworkValidator`).

```
automaticity(n) = 1 − e^(−k · n)          n = successful repetitions (NOT calendar days)
```

`k` from the user's own behaviour:

```
consistency  = Loop-style EMA over the lifetime, seeded 0.5
               done  → s += α·(1−s)          (α = mezo.habit.formation.consistency-rise)
               miss  → s ·= (1−β)            (β = mezo.habit.formation.consistency-decay)
context      = mean of the AVAILABLE context signals, else 0.5
k            = kBase · (0.6 + 0.4·consistency) · (0.7 + 0.5·context)
```

Context signals, both computed from data we already store — absent signals are *omitted*, never
faked:

- **time constancy** — from `habit_day.done_at` clock hours: `1 − 2·circularStdDev/π`,
  clamped to [0,1]; null under `min-sample` timed completions.
- **anchor constancy** — share of this habit's DONE days on which its `anchor_habit_key` habit
  was also DONE; null when the def has no anchor.

`kBase` is calibrated so a maximally consistent, context-stable user crosses the threshold at
about the literature median (~66 repetitions), and the least consistent case lands near ~180 —
spanning Lally's 18–254 spread. It is config (`mezo.habit.formation.k-base`), never a constant.

**Threshold** = 90 % of the asymptote (`threshold-pct`), reported to the FE so the copy and the
curve cannot drift apart.

**Range:** `k` is perturbed ±30 % (`k-band`); repetitions-to-threshold `n_T = ln(1/(1−T))/k`
gives a low/high pair, converted to weeks with the user's OWN recent rate (dones in the last
`strength-window-days` ÷ weeks in that window).

**Null state (honesty rule):** under `min-reps` repetitions there is **no** estimate — no
percentage, no ETA. The endpoint returns nulls plus `minReps` so the FE can say "N ismétlés a
becslésig". This mirrors the existing `strengthPct`-under-`min-sample` rule.

## Contract

New op on `api/feature/habit/habit.yml` — a **separate endpoint**, not a fattened summary:
`GET /api/habit/formation/{key}` → `HabitFormationResponse`.

Rationale: `getHabitSummary` is read on **every companion chat turn**
(`ContextSnapshotAssembler` / `PracticeTools`) and is deliberately cheap and
non-bootstrapping. A full-lifetime scan belongs on a page-triggered endpoint.

```
HabitFormationResponse:
  key, firstDate?, reps, missed,
  automaticityPct?, curveK?, thresholdPct, minReps,
  repsToThresholdLo?, repsToThresholdHi?, weeksToThresholdLo?, weeksToThresholdHi?,
  repsPerWeek?, consistencyPct?, timeConstancyPct?, anchorConstancyPct?,
  days: [{ date, status }]      # lifetime rows, for the history surface
```

The FE owns every stage label and sentence; the backend returns only numbers.

### Relationship to mezo-11nm

**They do not overlap and neither replaces the other.** This endpoint aggregates ONE habit over
its whole lifetime (per-habit axis, page-triggered). mezo-11nm wants per-day perfect-day bits
ACROSS habits on the summary (per-day axis, chat-turn-cheap). Different axes, different call
sites; a single aggregate serving both would either make the summary expensive or make this
endpoint cross-habit for no reader.

## Frontend

`HabitPage` (`/me/rutin/szokas/:habitKey`), Mozaik 2.0, prototype `rutin-formalodas.html` ×1.18:

- **Poster card** — automaticity ring (gradient arc + glow), the saturating curve drawn over
  repetitions (solid past, dashed projection, uncertainty band, dashed threshold line), the four
  stages as a **milestone rail** (current one pulsing), and the ETA band with the range.
- **Context rings** — three conic-gradient mini rings: time constancy, anchor constancy,
  smoothed consistency. A ring with no signal renders as "—", never a fabricated number.
- **History** — full-lifetime calendar (not the 28-day proportion strip it replaces) plus a
  weekday breakdown ("melyik napokon megy").
- The 28-day `rt-hist` proportion strip is **removed**: the lifetime calendar is strictly more
  honest and answers the same question.

Data: `useHabitFormation(habitKey)` via `useDualQuery` with a `realEmpty`, mock fixture in
`habitMock.ts`, barrel line in `data/hooks.ts`.

## Prior art

- **Buyalskaya et al. 2023 (PNAS)** — 12M gym visits: no magic number, gym habits take months,
  and the strongest predictors are timing regularity and inter-repetition gaps. *Adopted:* the
  input choice (context stability, not just a count). *Rejected:* the ML machinery — it needs
  horizons we do not have. https://www.pnas.org/doi/full/10.1073/pnas.2216115120
- **Singh et al. 2024 meta-analysis** — medians 59–66 days, individual range 4–335. *Adopted:*
  the calibration envelope and the decision that a point estimate is indefensible.
  https://pubmed.ncbi.nlm.nih.gov/39685110/
- **Loop Habit Tracker** — exponential smoothing where a miss decays and never resets.
  *Adopted:* as the consistency engine feeding `k`. *Rejected:* as the formation estimate
  itself — it is recency-weighted and cannot say "N weeks to go".
  https://github.com/iSoron/uhabits
- **Atoms (James Clear)** — repetitions as the monotone headline number, "never miss twice".
  *Adopted:* repetitions as the hero numeral. *Rejected:* its total absence of an estimate.
- **Habitify Progress** — smoothed consistency line, weekday breakdown. *Adopted:* both, for the
  history surface. *Rejected:* completion-percentage as the headline (reads as a grade).
- **No shipping habit app shows a range** for time-to-formation, while the literature is
  unanimous that a range is the honest form — so the range display is novel and well-grounded.
- **BJ Fogg's ability / simplicity factors** (time · physical effort · brain cycles ·
  non-routine) — adopted for the *creation* flow's difficulty question in a follow-up slice, not
  in this one. https://www.behaviormodel.org/ability/

## Codebase terrain

- `habit_day` rows are lazily materialized on the first today-read and closed by
  `closePast`/`HabitJob`; **days the user never opened the app have no rows at all**. The
  estimator must treat absent days as absent, never as missed.
- `HabitService.summary()` is `readOnly`, non-bootstrapping and on the chat hot path
  (`HabitService.java:190`) — do not make it heavier.
- `strengthByKey` (`:351`) is the 28-day precedent, including the `minSample` null rule.
- Repository has only `findByCreatedByAndHabitDateBetween`; a per-key lifetime finder is new.
- Tunables belong in `HabitProperties` (`mezo.habit.*`), never as code constants.
- `HabitPage.tsx` hero already follows the "no confident zero" rule (`:246`) — the formation
  block must too.
- Visual golden `me-rutin-szokas` covers this page: darwin **and** linux baselines must be
  regenerated.

## Follow-ups (filed as separate bd issues)

1. Rutin hub redesign — one-screen hub, single "Következik" tick row, active-chain tile,
   Szokásaid list page with the four stage filter tiles.
2. Habit editing as its own page + the anchor **picker** (today the anchor field is `readOnly`
   whenever it is linked, and "Keret váltása" throws the user into the 4-step wizard), plus the
   framework-switch data-loss warning.
3. Chain page: rename/daypart/reorder with the **stacking drawn** — the rope plus per-row anchor
   badges, since chain position and anchor are two independent orderings today (cycles are even
   accepted server-side).
4. One creation flow: the wizard gains a "Keret nélkül" branch (replacing the frameworkless
   sheet), the Clear branch becomes the four laws (craving + identity), and XP is derived from
   Fogg's ability factors instead of a hand-set stepper.
5. Contract extension so `mode` / `metric` become patchable (they are create-only today), and a
   way to clear optional strings (the "omit an emptied key" rule makes them one-way now).
6. mezo-mgpr (hub), mezo-bk26 (editor page + anchor picker), mezo-vxd8 (chain page + stacking),
   mezo-9k99 (one creation flow + Fogg ability XP), mezo-pero (contract: patchable mode/metric).
7. `/me/rutin/szokas/:key/elozmeny` as its own page if the inline history outgrows the page.
