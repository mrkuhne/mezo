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

## Delivery — slices

The design round covered more than one issue's worth of work: the estimate itself, plus the
Rutin surfaces the prototype redesigned around it. It ships in **seven slices**, each its own bd
issue, so a red slice never blocks a green one. Only S1 is a prerequisite for anything (the
others read the formation data it adds); S2–S6 are independent of each other and can land in any
order.

| # | bd | Status | Scope |
|---|----|--------|-------|
| **S1** | `mezo-08zl` | **DONE** — PR #503, merged `43667e3fe` (2026-09-06) | The formation view itself: the pure `HabitFormationEstimator`, `GET /api/habit/formation/{key}`, and the habit page's poster card + context rings + inline lifetime history (replacing the 28-day proportion strip). |
| **S2** | `mezo-mgpr` | OPEN | **Rutin hub 2.0** — one screen, no scrolling: hero + statstrip, a single „Következik" tick row (the daily logging home stays `/nap/rutin`), an active-chain tile, and the Szokásaid list on its own page with the four stage filter tiles, one full-width tile per row. |
| **S3** | `mezo-bk26` | OPEN | **Editing on its own page + the anchor picker.** Today the anchor field is `readOnly` whenever it is linked (`HabitPage.tsx:324`) and „Keret váltása" throws the user into the 4-step wizard. The picker (your habits + mezo moments + free text + „Leoldom") is what makes the contract's empty-string unlink convention safe; the framework switch must name the fields it will destroy *before* it does. |
| **S4** | `mezo-vxd8` | OPEN | **Chain page: rename, daypart, reorder — with the stacking drawn.** A rope down the chain plus a per-row badge for what each habit is *actually* anchored to; the rope goes dashed where anchor and position disagree. Chain position and anchor are two independent orderings today, and nothing surfaces it (cycles are even storable). |
| **S5** | `mezo-9k99` | OPEN | **One creation flow.** The wizard gains a „Keret nélkül" branch (retiring the frameworkless sheet, today the only place `mode`/`metric`/`skillKey` can be set); the Clear branch becomes the four laws (craving + identity, which it does not collect today); XP stops being a hand-set stepper and is derived from four **Fogg ability factors** (time · physical effort · brain cycles · non-routine) in a deliberately narrow band, with a „make it tiny" nudge on the weakest link. |
| **S6** | `mezo-pero` | OPEN | **Contract gaps.** `mode`/`metric` are absent from `HabitDefUpdateRequest`, so tick mode is create-only and the user cannot change it; and the „omit an emptied optional key" rule means no optional string (`why`, `linkUrl`, `identity`, `anchorCopy`) can ever be cleared back to null. S3 and S5 both promise UI that S6 has to make real. |
| **S7** | `mezo-q18h` | OPEN (conditional) | **`/me/rutin/szokas/{key}/elozmeny` as its own page** — only if the inline history from S1 outgrows the habit page. Filed so the decision is tracked rather than remembered. |

### What S1 actually settled

Two decisions the later slices inherit rather than re-litigate: **editing lives on its own page**
(option B of `docs/design_2.0/prototypes/rutin-szerkeszto-valasztas.html` — option A was built
first and rejected in use, because the formation page grew long enough that an in-place editor
opened below the fold), and **the mock arm derives `k` with the estimator's own formula**, so
demo mode cannot teach dynamics the server does not have.
