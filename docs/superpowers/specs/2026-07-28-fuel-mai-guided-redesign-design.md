# Fuel "Mai" — guided mobile-first recomposition (A+C hybrid)

- **Driving issue:** `mezo-rrtj`
- **Date:** 2026-07-28
- **Scope:** frontend only — zero backend, zero OpenAPI contract change
- **Mockups:** [`docs/design/fuel-mai-directions-v1.html`](../../design/fuel-mai-directions-v1.html) (4 directions + scroll meter) · [`docs/design/fuel-mai-hybrid-v1.html`](../../design/fuel-mai-hybrid-v1.html) (chosen hybrid + hero state gallery + motion plan)
- **Living doc to update:** [`docs/features/fuel.md`](../../features/fuel.md) §2, [`docs/features/_platform-design-system.md`](../../features/_platform-design-system.md) §1a

## 1. Problem

`FuelMaiPage` accumulated 15 functions across 9 stacked blocks. Measured in the mockup harness
(content height ÷ viewport, iPhone 14 Pro geometry) today's page is **2.6 screens** of scroll. The
concrete defects, each verified against the code:

1. **The same number twice, both hero-sized.** The "Mai cél" card prints `plan.energy.target`
   (`FuelMaiPage.tsx:115`) and the `KcalGauge` prints `/ {budget.kcal}` (`:136`) — and
   `budget.kcal === plan.energy.target` by construction (`timelineHooks.ts:117-122`). ~300px, one fact.
2. **The primary question is answered ~1200px down.** "What do I eat now, how much" lives in the
   flat timeline, where the `now` window's only distinction is a 2px sage ring (`.slot.next`).
3. **No hierarchy in the timeline.** An evening magnesium capsule renders as the same 68px `.slot`
   row as lunch; 3 protocol slots visually outweigh the 3 main meals.
4. **The AI's work is invisible.** `useMealCoach` returns `isPending` (`coachHooks.ts:33`) but the
   page destructures only `verdicts` (`FuelMaiPage.tsx:32`), so coach taglines pop in silently. The
   score chip is a bare `AI 74` (`SlotCard.tsx:144`) — no scale, no color, no meaning.
5. **Two static-seed surfaces render in real mode.** `useFuelDay` composes `pacing` and
   `micronutrients` straight from the mock seed in BOTH modes (`fuelHooks.ts:49-51`); the pacing
   prose is additionally stale against its own numbers (seed says 59%, the gauge says 26% —
   pre-existing `mezo-bgk8`). ~350px of theater.
6. **Activity burn is not legible where it is earned.** A workout slot shows `· 90 perc` but not the
   `+510 kcal` it contributed; the aggregate "Mozgás +930" chip sits ~1000px away.
7. **Water is an orphan** below the timeline, outside the day's rhythm.
8. **12 equal-weight chips.** 6 open windows × (`Logolás` + `AI`) — all identical visual weight.

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| **D1** | **A+C hybrid**: a `MOST` hero card on top, then ONE day-status card, then time-of-day zone cards. No day-arc, no accordions. | The two extremes each fail in one direction: A hides the day's structure behind accordions (the accordions become the new scroll), C spends ~160px on an arc that partly repeats what the zone balances already say. The hybrid keeps one focal point AND hides nothing. |
| **D2** | **Frontend only. Honest deletion** of the two non-real surfaces. | Keeps one branch / one PR shippable. A real day-level Mezo line and a real weekly micronutrient rollup are separate follow-ups (§8). |
| **D3** | The semicircle `KcalGauge` is **retired** in favour of a 12px segmented bar in the day-status card. | The gauge costs 124px to say what the bar says in 12px, and next to the hero card it reads as a second hero. **Reversible** — the component is recoverable from git if the bar proves too quiet. |
| **D4** | Zones are derived from **fractions of the wake→bed span**, not wall-clock constants. | wake/bed are user-owned (`useSleepGoal`); hardcoded ranges would mislabel an early or late sleeper. |
| **D5** | Hero has **3 states** (open-with-suggestion · open-budget-only · day-closed) plus a **missed strip**. | The mockup's 4th "missed hero" state collapsed into a strip: `buildDayPlan` guarantees at most one `now`, so a missed window is never the single actionable thing while the day is awake — it is an *additional* affordance, not a replacement hero. |
| **D6** | Hero CTAs: **`Logolás` (primary) + `✨` (AI)**. The mockup's third `⌕` button is dropped. | `LogMealSheet` already opens the recipe/pantry picker; a third button would be a redundant path to the same sheet. |
| **D7** | Water is the **4th macro row** in the day-status card, quick-add in place, format `1 850 / 4 000 ml`. | Keeps ml (no unit conversion, no rounding lie) and folds an orphan block into the day's numbers. |
| **D8** | Supplement zone rows **navigate to `/fuel/stack`**; intake logging stays there. | Same as today (the Mai timeline never logged intakes) — the row just stops being a dead end. |
| **D9** | `FuelDay.pacing` / `.micronutrients` **stay in the data layer** (typed + seeded, own tests) but no surface consumes them. | Removing typed seed fields is orthogonal churn touching 4 data-layer test files; the page-level honesty goal is met by not rendering them. Follow-up issue filed (§8). |
| **D10** | The protocol-meta row (`Stack · v{n}` + `Replan`) moves to a **compact footer row** under the zones, keeping both existing gates (hidden at `protocol.version === 0`, `Replan` only when `replanScenarios.length > 0`). | Low decision-value on a "what do I eat now" page, but it is real data and must not be lost. |

## 3. Layout

```
AppHero + SubNavDropdown                     (shared chrome, unchanged)
├─ .pghead-np.sage         ~56px   over = "Fuel · Reta D{n} · {phase} ›" (Link → /fuel/gyogyszer)
│                                  h1   = "A mai nap"        actions = [✨] [＋]
├─ .retamicro              ~14px   7-cell Reta strip (replaces the full RetaPhaseBar block)
├─ NowWindowCard          ~210px   ← THE HERO (§4)
├─ MissedStrip             ~44px   conditional — amber, "Tízórai kimaradt · 300 kcal · Pótlás"
├─ DayBudgetCard          ~250px   remaining kcal + segmented bar + "honnan a napi cél" chips
│                                  + 4 named macro rows (F/Sz/Zs/Víz + water quick-add)
├─ DayZoneCard × 1..4     ~variable  Reggel / Dél / Délután / Este — each with its own
│                                  kcal + burn balance in the header, capsule pips for stacks
└─ ProtocolFooterRow       ~52px   conditional — "Stack v{n} · {n} item · conf {n}%" + Replan
```

Measured: **2.1 screens** (from 2.6). The win is not primarily length — it is that the **first
screen alone is decision-complete**: open window + suggestion + why + budget + `Logolás`/`AI`,
followed by the full energy/macro breakdown.

### Zone derivation (`features/fuel/logic/dayZones.ts`)

Pure function `buildDayZones(slots, wake, bed)`:

- span = `toMin(bed) - toMin(wake)`; boundaries at fractions **`0 / 0.30 / 0.52 / 0.72`** of span →
  labels **`Reggel` / `Dél` / `Délután` / `Este`** (`ZONE_FRACTIONS` + `ZONE_LABELS` in
  `data/fuel/fuelConfig.ts`, next to the existing `SLOT_WEIGHT`).
- Each slot is bucketed by `toMin(slot.time)`, clamped into `[wake, bed]` (a pre-wake or post-bed
  slot lands in the first / last zone — never dropped).
- **A zone with no slots does not render** (a 3-meal day must not produce empty chrome).
- Per-zone aggregates, all derived, never faked:
  - `kcal` = Σ `slot.kcal` over the zone's meal/snack slots (logged **and** planned).
  - `state` — drives the header suffix, exactly three cases:
    `'done'` (every meal/snack slot in the zone is `state === 'done'`) → `{kcal} kcal ✓` ·
    `'open'` (the zone contains the `state === 'now'` slot) → `{kcal} kcal nyitva` ·
    `'ahead'` (otherwise) → `{kcal} kcal`. A zone with no meal/snack slot prints no kcal at all.
  - `burnKcal` = Σ MET burn of the zone's workout/sport slots. **Reuse `blockKcal`**
    (`buildDayPlan.ts:99`) — do not re-derive MET math. `FuelSlot.kind` cannot carry it
    (`buildDayPlan` step 5 collapses `run` into `'sport'`, whose MET differs), so `buildDayZones`
    takes `blocks: PlannerBlock[]` + `weightKg` and matches a block to its slot by **exact `time`
    string equality** — `blockSlots` copies `b.time` verbatim, so the match is lossless.
    Appended to the header as `· +{burnKcal}` only when `> 0`.
  - `stackPips` = for each supplement slot in the zone, one pip per `slot.items` entry, `on` when
    `item.done`.

### Hero selection (`features/fuel/logic/heroWindow.ts`)

Pure function `pickHeroWindow(slots)` → discriminated union:

| Result | Condition | Renders |
|---|---|---|
| `{kind:'open', slot, suggestion:true}` | the `state === 'now'` slot has `suggestedRecipeId` | recipe name as `h2`, "why" line, budget row, `Logolás` (recipe prefill) + `✨` |
| `{kind:'open', slot, suggestion:false}` | the `now` slot has no suggestion | `"{label}-ablak"` as `h2`, budget as the why-line, `Mit ettél?` primary + `✨` |
| `{kind:'closed', consumed, target, doneCount, totalCount}` | no slot has `state === 'now'` (every window logged, or past bedtime — both already encoded by `buildDayPlan` step 6) | sage summary hero: `{consumed} / {target} kcal` as the `h2`, `{done}/{total} ablak · fehérje {p}/{target} g` as the why-line, and **one** primary CTA — `Késői snack logolása` (`aria-label="Késői snack logolása"`) opening the empty `LogMealSheet`. No `Napi zárás ›` button: that view does not exist yet, and a dead CTA is exactly the fake affordance this redesign removes. |
| `missedSlots` (separate return field) | every `state === 'missed'` slot | the `MissedStrip`; tapping = the same `onLogMeal(slot)` path as today's `Pótlás` |

The "why" line is **derived, never LLM prose**:
- a training block starts **after** the window's time → `"{block.label} {block.time} — ez az ablak
  viszi a napi szénhidrát {share}-át"`, where `share = Math.round(slot.c / budget.c * 100) + '%'`
  (rendered only when `slot.c` and `budget.c` are both truthy, so a macro-less window can't print `NaN%`);
- otherwise → `"{slot.kcal} kcal ebben az ablakban — {slot.p} g fehérje a napi célhoz"`.

Plain text, no `SafeMarkdown`, no fabrication.

## 4. AI visibility

**Which layer is actually expensive.** `getScoredMeal` (`data/fuel/fuel.ts:479`) returns a meal only
when it carries a `breakdown`, and since P7 the deterministic score + breakdown arrive **with the
write** (`POST /api/meal`). So the score is never "being computed" from the UI's point of view — a
score-less logged meal is a pre-P7 legacy row that will never get one. The expensive, seconds-long
LLM step is the **coach verdict** (`useMealCoach`). Inventing a "számol…" state for the score would
therefore be a lie; the loading affordance belongs to the coach.

**`MealScoreChip`** replaces the bare chip in `SlotCard.tsx:133-146`, used by every zone row:

| State | Condition | Render |
|---|---|---|
| **scored** | `scoredMeal` present | mini SVG ring (dash = score) + `{score×100}` + a one-word verdict — **`s-hi` ≥ 80 sage `jó` · `s-md` 60–79 amber `közepes` · `s-lo` < 60 coral `gyenge`**. `aria-label="AI score"` **must be preserved** (existing test). Mounts with the spring `pop`. |
| **scored + coach pending** | above, and `coachPending && tagline == null` | same chip plus a trailing `✨` with the `np-twinkle` animation — honest: *the number is final, Mezo's reading is still coming* |
| **absent** | no `scoredMeal` | nothing (today's behaviour for pre-P7 rows — no fabricated placeholder) |

**Coach tagline:** a shimmering skeleton line (`.coachline.sk`) renders while
`useMealCoach().isPending` and the verdict is absent, cross-fading to the text on arrival.
`FuelMaiPage` must destructure `isPending` from `useMealCoach` (`FuelMaiPage.tsx:32` currently takes
only `verdicts`) — that one line is what makes the expensive call visible.

**No prose ⇒ no card.** When the coach is off/unavailable nothing renders (never a seeded sentence).
The skeleton only ever shows while a request is genuinely in flight.

## 5. Motion

All animations are additive CSS in `prototype.css`, gated by
`@media (prefers-reduced-motion: reduce) { animation: none }`:

- **Hero attention:** the coral dot pulses (2.2s ring, the existing `pulse-soft` idiom).
- **Zone stagger:** the zone cards enter with the existing `np-anim` (`--i` × 70ms).
- **Budget bar:** segments grow from 0 (1.1s `--np-ease-ios`); a coral tick marks "now in the day".
- **Score landing:** the chip mounts with a spring `pop` (score present ⇒ chip mounts ⇒ mount
  animation is sufficient; no state tracking needed).
- **Press feedback:** the primary CTA keeps `np-press` (scale .96 spring).

Count-up numbers and the hero slide-morph after a successful log are **explicitly out of scope** for
this slice (they need transition state the page does not hold today) — noted as a follow-up.

## 6. File map

**New** — `frontend/src/features/fuel/`:
- `logic/dayZones.ts` + `logic/dayZones.test.ts`
- `logic/heroWindow.ts` + `logic/heroWindow.test.ts`
- `components/NowWindowCard.tsx` + test
- `components/DayBudgetCard.tsx` + test
- `components/DayZoneCard.tsx` + test
- `components/ZoneSlotRow.tsx` + test
- `components/MealScoreChip.tsx` + test

**Modified:**
- `features/fuel/pages/FuelMaiPage.tsx` — full recomposition; both existing test files rewritten
- `data/fuel/fuelConfig.ts` — `ZONE_FRACTIONS`, `ZONE_LABELS`
- `styles/prototype.css` — new families `.nowcard`, `.daystrip`/`.brk`/`.ebchip`/`.mac` (extend),
  `.zcard`/`.zrow`, `.aiscore`, `.retamicro`, `.missedstrip`
- `docs/features/fuel.md` §2 (the "Mai" paragraph — rewrite, overwrite in place per the living-doc
  policy) and its `key_files` if needed; `docs/features/_platform-design-system.md` §1a (CSS families)

**Deleted** (each is consumed by `FuelMaiPage` only — verified; Today uses its own
`FuelTimelinePreview`):
- `components/PacingCard.tsx`
- `components/FuelTimeline.tsx` + `FuelTimeline.test.tsx`
- `components/SlotCard.tsx` + `SlotCard.test.tsx`
- `components/KcalGauge.tsx` + `KcalGauge.test.tsx`

## 7. Tests

**Ported, not lost** — `ZoneSlotRow.test.tsx` must carry over every behavioural assertion from
`SlotCard.test.tsx`: `done`/`now`/`missed` state classes, `missed` → `Pótlás` (and `missed` winning
over a lingering `suggestedRecipeId`), the AI chip gated on `slot.slotKey && onAiLog`, supplement
item rows, the `duration` guard on the `· {n} perc` suffix, and the score chip → `onOpenScore`.

**aria-label contract** (prevents a `getByRole('button', {name:'Logolás'})` collision — the header
chip and the hero CTA would otherwise both match):
- header `＋` keeps **`aria-label="Logolás"`** (existing test),
- the hero primary gets **`aria-label="{label} logolása"`** (the slot-card convention),
- water buttons keep **`Víz +250 ml` / `Víz +500 ml`**,
- score chip keeps **`AI score`**, settings chip keeps **`Fuel beállítások`**.

**`FuelMaiPage.test.tsx` rewrite** — assertions that must change:
`heading 'Mai pacing'` → `'A mai nap'` · `'Mikrotápanyagok · heti'` → absent · `/Mai cél/` → the
`honnan a napi cél` caption + the `Alaphő {n}` / `Mozgás` / `Deficit` chips (labels kept so the
`EnergyBreakdownSheet` tests survive) · `kávé cutoff` / `konyha zár` now in the Este zone row ·
`/Víz · \d+ \/ \d+ ml/` → the water macro row format. Everything else (protocol-meta v3/v0 gating,
real-mode Replan suppression, score sheet open/close, slot AI chip, real-mode schedule-derived
workout label) must keep passing with adapted queries.

**Gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes
green — then `node scripts/lint-docs.mjs` clean.

## 8. Non-goals / follow-ups (file as bd issues)

1. **Real day-level Mezo pacing line** — extend the existing coach LLM call with a day summary
   (`GET /api/meal/coach`), rendered under the hero with a skeleton. Backend + contract + IT.
2. **Real weekly micronutrient rollup** — `meal_item` → nutrient aggregation, surfaced on **Terv**
   (weekly data belongs on the weekly view), not on Mai.
3. **Remove the now-unconsumed `FuelDay.pacing` / `.micronutrients` fields** + their data-layer tests.
4. **Log-success motion** — count-up on the zone balance and the hero slide-morph to the next window.
5. `mezo-bgk8` (mock seed `consumed` ≠ Σ seed meals) is untouched and unrelated to this slice.
