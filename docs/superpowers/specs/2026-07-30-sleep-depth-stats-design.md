# Sleep depth stats — phase visualisation, hypnogram & phase statistics · Design spec

**Date:** 2026-07-30
**Status:** approved (brainstorming 2026-07-30), writing-plans next
**Driver:** `mezo-fk9a`
**Companion mockup:** [`2026-07-30-sleep-depth-stats-mockup.html`](2026-07-30-sleep-depth-stats-mockup.html) — three directions for the last-night block; direction **A** (hanging depth silhouette) approved
**Predecessors:** [`2026-07-23-sleep-shot-design.md`](2026-07-23-sleep-shot-design.md) (which deferred exactly this: *"Phase-based scoring/analytics beyond storing the minutes"*) · [`2026-07-23-sleep-anchor-design.md`](2026-07-23-sleep-anchor-design.md) · [`2026-07-24-sleep-c3-education-design.md`](2026-07-24-sleep-c3-education-design.md)

---

## 1. Goal and scope

**Goal:** the sleep phases the app already reads off the screenshot stop being write-only data, and become the sleep page's second dimension — *how* the night was built, not just how long it was.

**The starting position is better than it looks.** `sleep_log` already carries `deep_min`, `light_min`, `rem_min`, `awake_min`, `in_bed_min` and `source_quality_pct` (added by `mezo-dbsr`), the extraction prompt already asks for all four phases, and `POST /api/biometrics/sleep` already persists them. But repo-wide, the only consumer is a 10px grey text strip in the draft-review step ([`SleepLogSheet.tsx:242`](../../../frontend/src/features/me/sheets/SleepLogSheet.tsx)). Nothing on `SleepPage`, nothing in `sleepStats.ts`, nothing in the chart. **The bulk of this slice is read-side.**

**In scope:**

1. **Phase composition made visible** — a proportional phase rail + legend on the last-night hero, and the same rail reused for averages and half-nights.
2. **Reference bands** — deep and REM as a share of total sleep, against the adult normal range.
3. **Hypnogram** — a *new* extraction: a 15-minute quantised stage sequence, stored as `jsonb`, rendered as a hanging depth silhouette ("Az éjszaka íve").
4. **First half / second half split** — derived from the hypnogram; the one genuinely new lesson it buys.
5. **Phase-stacked trend chart** — the existing `SleepChart` bars split into deep/light/REM.
6. **Duration ↔ REM card** — personal evidence that short nights cut REM disproportionately.
7. **Two correctness fixes** the above would otherwise expose: the manual-save phase leak, and the empty mock/MSW seed.

**Out of scope (deliberate):**

- **Heart rate, HRV, respiration, snoring** — they live behind *other tabs* in Sleep Cycle (the ♥ and waveform chips), so they are not on the screenshot this feature reads. A separate slice, needing a separate upload.
- **Sleep Cycle's own sleep goal** (`22:30 / 7:00`, `Sleep Goal: Missed`) — mezo has its own `sleep_goal` aggregate; importing a second, conflicting goal would be a data-ownership bug, not a feature.
- **Phase-based scoring** — no "sleep architecture score", no grading. The reference bands inform; they do not judge (see §9).
- **Backfilling old nights** — nights logged before this slice keep their `null` hypnogram forever. No re-extraction path.
- **Editing the hypnogram by hand.** It is provenance from a screenshot, not user input.

---

## 2. The central design rule

> **The hypnogram never feeds a ratio statistic. Every percentage, average and trend value comes from the exact per-phase minute totals.**

This is what makes the risky part safe to ship. The minute totals (`Deep 1h 40m` etc.) are printed as *text* on the screenshot — the LLM transcribes them, and the existing validator already cross-checks their sum against `In bed` within 10%. They are trustworthy.

The hypnogram is different in kind: it is read off a *smoothed curve* with no sharp segment boundaries. Quantising it to 15-minute buckets is already a lossy approximation of an approximation. Feeding that into "your deep sleep is 22%" would corrupt a number we can compute exactly.

So the hypnogram earns exactly two jobs:

- **the drawing** (§6.3) — where a bucket being one step off is invisible, and
- **the first-half/second-half split** (§6.4) — which is a *ratio between two halves of the same noisy series*, so the quantisation error largely cancels, and which is reported in coarse language ("a mélyed 72%-a az első félbe esett"), never to the minute.

If the hypnogram is missing or fails validation, the night simply has no arc card. Everything else on the page is unaffected. **The feature degrades to 80% of itself, silently and correctly.**

---

## 3. Extraction — the prompt change

`SleepShotService.SYSTEM_PROMPT` gains a tenth field. The prompt currently enumerates nine; the addition keeps the same terse, JSON-shaped style:

```
"hypnogram": a string with ONE letter per 15 minutes of the 'Sleep stages' graph,
left to right, from 'Went to bed' to 'Woke up'. Letters: D=Deep, L=Light,
R=Dream, A=Awake. Decide each 15-minute slot by the COLOUR of the curve there
(white=Awake, magenta=Dream, light cyan=Light, dark teal=Deep), not by its height.
```

**Why colour, not height.** The graph is a continuous smoothed line, so "how low is low" is a judgement call that varies with the vertical scale — but Sleep Cycle colours the line by stage, and colour is categorical. This turns a measurement problem into a recognition problem, which is what vision models are actually good at.

`SleepShotDraftValidator.Extracted` gains a `String hypnogram` component. No other extraction change.

---

## 4. Validation — three new checks, one verdict

New checks in `SleepShotDraftValidator`, applied only to the hypnogram:

| # | Check | Rule |
|---|---|---|
| V1 | **Alphabet** | every character is one of `D L R A` |
| V2 | **Length** | `abs(len − round(spanMin / 15)) <= 2`, where `spanMin` is the midnight-wrapped `bedtime → wakeup` clock span (always available; `inBedMin` may be null) |
| V3 | **Composition** | for **every** stage `k` ∈ {D, L, R, A}: `abs(count(k) × 15 − actualMin_k) <= max(30, 0.35 × actualMin_k)` |

**Precondition:** a hypnogram is only considered at all when `deepMin`, `lightMin`, `remMin` **and** `awakeMin` are all present — without them V3 cannot run, and an uncheckable hypnogram is not worth drawing.

> **All four, not three.** An earlier draft of this spec exempted `A` from V3 whenever `awakeMin` was null, while still letting `A` characters consume V2's length budget. Review found that exploitable: with `awakeMin` null, the sequence `AAAAA` + `D×6` + `L×11` + `R×12` (34 chars against an expected 33) passes V2 and all three remaining composition checks, and shows the user a fabricated 75-minute awake stretch that nothing cross-checked. Every stage that occupies length must be tethered to a number, or the untethered one absorbs the slack. The Sleep Cycle screenshot always renders all four legend rows, so requiring `awakeMin` costs nothing real.

**Verdict is all-or-nothing:** any failure sets `hypnogram = null` on the draft. A hypnogram with one stage misread is a *wrong picture*, and there is no partial-credit rendering that would be honest.

**The hypnogram verdict is independent of `confidence` / `needsReview`.** Those two describe the numbers the user is about to save; a rejected hypnogram says nothing about them. Coupling the two would either scare the user away from good data or hide a bad drawing behind a good confidence score. They fail separately because they mean different things.

The V3 tolerances are deliberately loose (`±30 min` floor, `±35%` above it). A tighter bound would reject correct-looking hypnograms purely for quantisation drift: at 15-minute resolution a 100-minute deep total legitimately lands anywhere in 6–8 buckets (90–120 min). The check exists to catch a *hallucinated* sequence — one that says "mostly deep" when the totals say "mostly light" — not to grade rounding.

---

## 5. Data model, storage and contract

### 5.1 Column

```sql
alter table sleep_log add column hypnogram jsonb;
```

New Liquibase script `202607301200_mezo-fk9a_add_sleep_log_hypnogram.sql` + an entry in `1.0.0_master.yml`. Nullable, no constraint, no index — it is never a query predicate.

### 5.2 Why jsonb and not a child table

The alternative — `sleep_stage_segment` with one row per segment — buys normalisation we have no use for. This blob is **never queried independently, never aggregated in SQL, never joined**: it is always fetched with its parent row and consumed whole by one component. A child table would add a join, an N+1 risk on the list endpoint, a new `*Populator`, and a new entry in `ResetDatabase`'s TRUNCATE list, in exchange for nothing. CLAUDE.md already establishes jsonb-onto-a-typed-object as first-class here (`@JdbcTypeCode(SqlTypes.JSON)`), which is precisely this shape.

### 5.3 Shape

```json
{ "bucketMin": 15, "stages": "ALDDLRRLDDLLRRRLDDLLRRLALDDLRRLRRR" }
```

Mapped to a typed embedded record, not a `String`. `bucketMin` is stored rather than assumed so a future finer resolution does not require a migration or a data fix-up — the renderer reads the bucket width from the data.

The start time is **not** stored: the sequence starts at `bedtime`, which is already a column. Storing it twice invites the two copies to disagree.

### 5.4 API

Contract-first, per `api_contract_conventions.md` — the YAML changes land **before** any Java or TS:

- `api/feature/sleep-shot/sleep-shot.yml` — `SleepShotDraftResponse` gains a nullable `hypnogram` object (`bucketMin`, `stages`).
- `api/feature/sleep/sleep.yml` — the same object on **both** `LogSleepRequest` and `SleepLogResponse`.
- Regenerate: `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. Backend types regenerate during `generate-sources`.

---

## 6. Frontend

### 6.1 Logic — a new module, not an extension of `sleepStats.ts`

New file `frontend/src/features/me/logic/sleepPhases.ts`. It stays separate from `sleepStats.ts` because they answer different questions: `sleepStats.ts` is about *timing* (regularity against the goal, efficiency, bed delta); this one is about *composition*. They share no helpers and no state, and merging them would produce one file that needs two mental models.

Exported surface:

```ts
export type Stage = 'D' | 'L' | 'R' | 'A'

export interface PhaseBreakdown {          // all minutes
  deep: number; light: number; rem: number; awake: number
  asleep: number                            // deep + light + rem
  inBed: number                             // asleep + awake
}

export const DEEP_REF = { lo: 13, hi: 23 } as const   // % of total sleep
export const REM_REF  = { lo: 20, hi: 25 } as const

export function phaseBreakdown(entry: SleepEntry): PhaseBreakdown | null
export function phasePct(b: PhaseBreakdown, key: 'deep' | 'light' | 'rem'): number
export function averageBreakdown(entries: SleepEntry[], windowDays: number):
  { avg: PhaseBreakdown; nights: number } | null
export function parseHypnogram(entry: SleepEntry): Stage[] | null
export function halfNightSplit(stages: Stage[]): { first: PhaseBreakdown; second: PhaseBreakdown }
export function deepFrontLoadPct(stages: Stage[]): number | null
export function remByDuration(entries: SleepEntry[]):
  { shortAvg: number; longAvg: number; deltaMin: number; shortNights: number; longNights: number } | null
```

Rules baked into the module, so no caller can get them wrong:

- `phaseBreakdown` returns `null` unless `deep`, `light` **and** `rem` are all non-null. `awake` defaults to `0` when absent. `asleep` is computed as the sum, **never** read from `duration` — `duration` is the rounded-to-hundredths hour value and would disagree.
- `phasePct` denominates on `asleep`, never `inBed`. Awake time is fragmentation, not a sleep stage, and mixing it into the denominator would make everyone look deep-deficient.
- `averageBreakdown` returns `null` below **3** qualifying nights (§7).
- `halfNightSplit` splits by bucket index; with an odd count the middle bucket goes to the first half. Because buckets are uniform, index-split *is* time-split.
- `deepFrontLoadPct` returns `null` when total deep buckets `< 4` — below that the percentage is quantisation noise wearing a number's clothes.
- `remByDuration` returns `null` unless there are **≥3 nights on each side** of the 7-hour line. Six nights all on one side cannot support the claim.

### 6.2 Components

| File (all `frontend/src/features/me/components/`) | Responsibility |
|---|---|
| `PhaseRail.tsx` | The proportional stacked rail + the 2×2 legend. Props: `breakdown`, `showLegend`, `height`. **Three consumers** (hero, average card, half-night rows) — the reason it is its own component. |
| `PhaseReferenceRow.tsx` | One reference row: label, value, verdict text, and the band+pin bar. Props: `label`, `pct`, `ref`, `color`. |
| `NightArcCard.tsx` | "Az éjszaka íve" — the hanging silhouette + hour axis, the two half-night rails, and the front-load sentence. |
| `PhaseAverageCard.tsx` | "Átlagos összetétel · N éjszakából" — average rail + both reference rows. |
| `RemDurationCard.tsx` | "Ha rövidebb az éjszaka" — the duration↔REM scatter + the derived sentence. |

Modified: `SleepChart.tsx` (bars split into deep/light/REM; phase-less nights stay a single faint bar), `SleepPage.tsx` (composition), `SleepLogSheet.tsx` (the review strip becomes a `PhaseRail`; §8 fix).

### 6.3 The silhouette

An SVG whose bars **hang from a top baseline** — the deeper the stage, the further the bar dips. This matches the reading direction of the Sleep Cycle graph the user already knows; an upward silhouette would invert the metaphor and make "deep" look like "more". Depth fractions `A .20 · R .52 · L .74 · D 1.0`, colour by stage, hour ticks along the bottom with the bed/wake clock times pinned to the ends (ticks within 26 minutes of either end are dropped so labels never collide).

The card carries a standing caption: *"A sziluett magassága a fázist kódolja, nem mért mélységet. 15 perces felbontás."* The drawing must not imply a precision the source lacks.

### 6.4 Page composition

`SleepPage` order after this slice — specific to general, so the page reads as a narrowing story:

1. Header · 2. Alvás-cél · 3. Éjszakai mód · 4. Score rings · 5. Education/escalation *(all unchanged)*
6. **Tegnap éjjel** — hero + phase rail + both reference rows *(new block, only when `phaseBreakdown` ≠ null)*
7. **Az éjszaka íve** — `NightArcCard` *(only when a valid hypnogram exists)*
8. **Átlagos összetétel** — `PhaseAverageCard` *(≥3 phase nights)*
9. **Trend** — `SleepChart`, now phase-stacked *(unchanged position)*
10. **Ha rövidebb az éjszaka** — `RemDurationCard` *(≥3 nights each side of 7h)*
11. **Napló** *(unchanged)*

### 6.5 Colour tokens

Four new tokens in `prototype.css`, declared as **aliases onto Napív accents** so the documented alias architecture carries them into dark mode automatically (the dark override block stays empty — overriding them would break the swap):

```css
--ph-deep:  var(--lav-deep);   /* the sleep domain's own colour, the deepest layer */
--ph-light: var(--sky);        /* already the wake end of the night-arc gradient */
--ph-rem:   var(--rose);       /* dream */
--ph-awake: var(--faint);      /* absence — never alarming */
```

Deliberately **not** Sleep Cycle's neon magenta/cyan: the page has an established warm palette, and importing a foreign accent set for one card would read as a paste-in. The new `.ph*` CSS family is documented in `docs/features/_platform-design-system.md` alongside the existing `.sstat*`/`.sesc*`/`.night*` sleep families.

---

## 7. Gating — cards earn their place

| Surface | Requires | Below threshold |
|---|---|---|
| Hero phase rail + reference rows | `phaseBreakdown(lastNight)` ≠ null | block absent; hero unchanged |
| `NightArcCard` | valid hypnogram on `lastNight` | card absent |
| Front-load sentence | ≥4 deep buckets | sentence absent, rails still shown |
| `PhaseAverageCard` | ≥3 phase nights in window | card absent |
| `RemDurationCard` | ≥3 nights each side of 7h | card absent |
| `SleepChart` stacking | per-night; phase-less nights render as today | mixed chart, by design |

Two reasons this matters. First, **an average of two nights is a lie with a number attached** — and this page's whole tone is built on not manufacturing certainty. Second, it makes the feature *unfold*: a user who starts logging screenshots watches cards appear as the data earns them, which is a better first-run experience than five empty skeletons.

Phase-less nights are never hidden or interpolated — in the trend chart they stay visibly plain. **The gaps in the series are part of the truth.**

---

## 8. Two fixes this slice forces

**8.1 The manual-save phase leak.** [`SleepLogSheet.save()`](../../../frontend/src/features/me/sheets/SleepLogSheet.tsx) omits `awakeMin/lightMin/remMin/deepMin/sourceQualityPct/source`. Extract from a screenshot, switch back to "Kézi", save — and every phase field is silently dropped. Today that is invisible (nothing renders them). The moment the phase rail ships, it becomes a user-visible data-loss bug. Fix: when a draft exists, its phase fields ride along regardless of the active mode.

**8.2 Empty mock and MSW seeds.** `frontend/src/data/me/sleep.ts` has 14 nights with **no** phase field on any of them, and the MSW real-mode handler returns one phase-less row. Mock mode would show none of this feature, and — more seriously — `VITE_USE_MOCK=true pnpm test` could not test it, so the project's both-modes-green gate would be vacuous for the whole slice. Fix: 8 of the 14 mock nights get phase minutes (5 of those with a hypnogram), and the MSW rows match.

---

## 9. Tone

The sleep page's established rule (`docs/features/me.md`) is *gentle — no red, no guilt framing*, and this slice adds the app's first surfaces where a user can be "outside a range". Rules:

- Reference bands render in **sage**, and the out-of-band verdict is *"a sáv felett" / "a sáv alatt"* — locational, never *"low"*, never red, never an alert colour.
- Deep and REM get bands; **light does not**. Light is the residual — a "light band" would imply a target for the stage you have least control over.
- The front-load sentence states the norm before the number (*"ez a normális minta"*), so a typical night reads as reassurance rather than as a finding.
- No composite "architecture score". The existing rings already carry the two scores this page makes claims about (regularity, efficiency), and both rest on exact data.

---

## 10. Testing

**Frontend** — `sleepPhases.test.ts` is the centre of gravity: null-returns for every gate, `asleep` computed from the sum and not from `duration`, odd-length half-split, `deepFrontLoadPct` below the 4-bucket floor, `remByDuration` with a lopsided distribution. Component tests for `PhaseRail` (proportions, legend, awake excluded from the denominator), `PhaseReferenceRow` (in/above/below band), and each card's gated absence. `SleepPage.test.tsx` gains assertions for the new blocks *and* for their absence on thin data. Both modes must be green.

**Backend** — validator tests own the risk: V1/V2/V3 each rejecting in isolation, the all-null-minutes precondition, a correct hypnogram surviving, and — the important one — **a rejected hypnogram leaving `confidence`/`needsReview` untouched**. Plus a `SleepLogService` round-trip proving the jsonb column persists and reads back as a typed object.

**Visual** — `/me/sleep` goldens move. Per the house flow: linux baselines via `gh workflow run update-visual-baselines.yml`, darwin locally; only the sleep screens' PNGs get committed.

---

## 11. File map

**New:** `sleepPhases.ts` (+test) · `PhaseRail.tsx` · `PhaseReferenceRow.tsx` · `NightArcCard.tsx` · `PhaseAverageCard.tsx` · `RemDurationCard.tsx` (+tests) · `202607301200_mezo-fk9a_add_sleep_log_hypnogram.sql`

**Modified — backend:** `SleepShotService.java` (prompt, normalise, response) · `SleepShotDraftValidator.java` (`Extracted`, V1–V3) · `SleepLogEntity.java` (jsonb + embedded record) · `SleepLogService.java` · `1.0.0_master.yml`

**Modified — contract:** `api/feature/sleep-shot/sleep-shot.yml` · `api/feature/sleep/sleep.yml`

**Modified — frontend:** `types.ts` · `biometricsApi.ts` · `sleep.ts` (mock seed) · `sleepShot.ts` · `msw/handlers.ts` · `SleepChart.tsx` · `SleepPage.tsx` · `SleepLogSheet.tsx` · `prototype.css`

**Docs:** `docs/features/me.md` (§Alvás, §4 data model, §the add-a-field recipe) · `docs/features/_platform-design-system.md` (`.ph*` family) · a short ADR for the display-only-hypnogram rule (§2), which is the one decision here a future reader would otherwise be tempted to undo.
