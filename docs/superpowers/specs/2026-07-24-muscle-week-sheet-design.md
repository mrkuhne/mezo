# Muscle Week Sheet — Gym heti izomterhelés (design)

- **Date:** 2026-07-24
- **Status:** validated with visual-companion mockups (v2 approved)
- **Scope:** frontend-only; `frontend/src/features/train/` (GymPage + new sheet + 3 logic modules). **No API-contract or backend change.**
- **Driving issue:** `mezo-ly27`
- **Driving request:** the GymPage meta card should show a per-muscle-group weekly breakdown — sets, reps, exercise count, and weekly stimulation frequency per muscle group; plus how the week's planned Sport (röpi/cross/TRX) and Running events load the muscle groups; plus a forecast of how the Growth athletic skills are expected to develop that week.

## Decision summary

Three user decisions (AskUserQuestion rounds), then a v2 visual-companion mockup approved:

1. **Presentation: sheet.** The meta card stays compact but gains a region-grouped muscle grid showing **all** muscles; tapping the card opens the new full-detail `MuscleWeekSheet`.
2. **Sport/Running muscle load: static FE heuristic.** A fixed per-sport-kind muscle→load table in the logic layer, computed from the **live** weekly sport schedule + active running block. Honestly labeled a becslés; the Phase-3 cross-load engine replaces it later (the existing mock-only `crossLoad` fixtures stay untouched).
3. **Growth forecast: FE estimate.** A logic module mirrors the backend XP weights + level curve (documented drift risk), combines the planned week with `GET /api/progression/profile`, and flags expected level-ups. No new endpoint.

## 1. Logic layer — three pure modules (`frontend/src/features/train/logic/`)

### 1.1 `muscleWeek.ts`

`muscleWeekFromMeso(days: MesoDay[]): MuscleWeekRow[]`

Aggregates the active meso's template week per muscle key (the 13 catalog muscles + legacy `back`):

- `workingSets` — Σ `exercise.workingSets` (warmups excluded, consistent with the card's `Szetek` stat, `GymPage.tsx:63`),
- `repRange` — `[Σ sets×repMin, Σ sets×repMax]` weekly total reps,
- `exerciseCount` — number of template exercises targeting the muscle,
- `gymFrequency` — number of days with ≥1 exercise for the muscle.

Rows sorted by `workingSets` desc. Exercises on rest/sport days are excluded the same way the builder detects off-days (muscle `''` / `'sport'`).

**Region grouping** for the card grid: region == the existing muscle color family (`logic/muscleColors.ts` `MUSCLE_FAMILY`): coral=Mell (chest), sky=Hát (lats, back-mid, traps, back), lav=Váll (shoulder, rear-delt), rose=Kar (biceps, triceps), sage=Láb (quad, ham, glute, calf), amber=Core (core). `muscleColors.ts` gains an exported `REGION_LABELS: Record<family, string>` + a `muscleRegion(muscle)` helper so card and sheet share one mapping. Region display order is fixed: Mell, Hát, Váll, Kar, Láb, Core; regions with no trained muscle that week are omitted.

### 1.2 `sportMuscleLoad.ts`

A fixed heuristic table, sport/run kind → granular muscle keys with load level 1–3 (▲..▲▲▲):

| kind | muscle loads |
|---|---|
| `volleyball` | shoulder 3, rear-delt 1, quad 2, calf 2, core 1 |
| `cross` | quad 2, glute 2, core 2, shoulder 1, triceps 1 |
| `trx` | core 3, back-mid 2, lats 1, biceps 1, triceps 1, shoulder 1 |
| run `steady` | quad 2, ham 1, calf 2, core 1 |
| run `sprint` / `pyramid` | quad 3, ham 3, glute 2, calf 2, core 1 |

`sportLoadForWeek(slots: VolleyballSession[], runSessions: RunPrescribedSession[]): SportLoadResult` where the result carries:

- per-muscle aggregation: for each muscle, the list of `{source: 'volleyball'|'cross'|'trx'|'run', kind, load, count}` — drives the muscle-row chips (`▲▲ röpi`, `▲ futás`, `×2` when the same kind hits twice a week) and the `+n sport` part of the stimulus frequency;
- per-event rows: one entry per planned slot / prescribed run session with day, time, kind and its **region-aggregated** loads (max load among the region's members) — drives section ② of the sheet.

Inputs are live data in both modes: the sport weekly schedule (`useTrain().sport.schedule` slots) and the active running block's current-week prescribed sessions (`useRunning().activeRunningBlock.structure.weeks[currentWeek-1].sessions`). Empty schedule / no active block → empty result → honest empty line in the sheet.

The table is a **product heuristic, not physiology ground truth** — tunable constants in one place, replaced wholesale when the Phase-3 cross-load engine lands (`train.md` §Phase-3 list).

### 1.3 `growthForecast.ts`

`growthForecast(input: { days: MesoDay[]; slots: VolleyballSession[]; runSessions: RunPrescribedSession[]; skills: SkillLevel[] }): ForecastRow[]`

**Mirrored economy constants** (single `ECONOMY` const + `xpThreshold(level)` = `Math.round(100 * (level-1) ** 1.6)`), with a doc comment pointing at `backend/src/main/resources/application.yml` (`mezo.progression.*`) and `ProgressionService.java` — the authoritative source; drift is accepted and documented (the tunables are "tune freely" values; the whole surface is labeled `~ becslés`).

Per-source estimates over the planned week (`repMid` = `(repMin + repMax) / 2` of the exercise recipe):

- **Gym (per template day):**
  - per-muscle volume XP: `floor(Σ workingSets×repMid×anchorWeightKg / 100) × 10` per muscle per day — an exercise **without** `anchorWeightKg` contributes no volume XP (honest omission, no weight guess);
  - `max_strength`: per day best estimated e1RM = max over anchored exercises of `anchor × (1 + repMid/30)` (Epley), ×2 XP/kg; the one-off PR bonus is **not** forecast;
  - `strength_endurance`: Σ workingSets × 8; `plyo` exercises instead contribute `workingSets × repMid × 1` (bodyweight reps).
- **Sport (per planned slot):** volleyball → `vertical_jump`/`agility`/`coordination` +3×12 each, `explosiveness` +7×6, `aerobic_capacity` +duration×4; cross → `anaerobic_capacity`/`strength_endurance` +4×14, `explosiveness`/`core_stability` +7×6; TRX → `core_stability`/`strength_endurance` +4×14, `anaerobic_capacity` +7×6, `mobility` +duration×4. Assumed defaults where the plan has no value: volleyball setsPlayed=3, cross/TRX rounds=4, RPE=7; duration from the slot.
- **Running (per prescribed session of the current block week):** sprint/pyramid → `sprint_speed` +rounds×25, `anaerobic_capacity` +rounds×15, `explosiveness` +rpeMid×6 (rounds and `rpeTarget` come from the plan structure; rounds default 4 when the structure lacks them); steady → `strength_endurance` +min×4, `aerobic_capacity` +min×5 (duration default 30 min when absent); the HR-recovery bonus is not forecast.
- **Not forecast:** robustness weekly streak XP, quest/activity/habit XP, PR/HR bonuses — outside the planned-training scope.

Output per athletic skill with est. XP > 0, sorted by XP desc: `{skillKey, xpEst, level, progressPct, willLevelUp}` where `willLevelUp = cumulativeXp + xpEst ≥ xpThreshold(level+1)` (from the profile's `SkillLevel`; a skill absent from the profile counts as level 1 / 0 XP). **Muscle-skill XP estimates** are returned separately keyed by muscle and rendered inside section ①'s rows, not as forecast rows.

## 2. UI

### 2.1 `GymPage` meta card (approved mockup panel 1)

- Below the existing 4-stat row, a new **region-grouped muscle grid**: a 2-column grid (44px label column), per region a small colored uppercase label (region family's `deep` color) + wash-colored pills for **every** trained muscle of the region, each `"{MUSCLE_LABELS[muscle]} {workingSets}"`. All muscles shown — no `+N` overflow.
- The card becomes tappable (a focusable button-role wrapper, `aria-label="Heti izomterhelés — részletek"`) → opens the sheet; a small `tap → heti izomterhelés` hint appears under the card. The header `Időpontok` chip is unaffected.
- Ghost/pending states unchanged (no meso → no card, as today).

### 2.2 `sheets/MuscleWeekSheet.tsx` (approved mockup panel 2)

Built on the shared `Sheet`. Header: eyebrow `Gym · W{n} / {weeks} · {phase}` + display-font title `Heti izomterhelés`. Section headers: colored accent dash + uppercase title + muted explainer sub-line (coral ①, rose ②, lav ③).

- **① Izomcsoportok** — one card row per muscle (all muscles, sorted by sets desc): 5px muscle-rail (the `ExercisesPage` record-card idiom), muscle name in the family `deep` color, sub-line `"{repMin}–{repMax} rep · {n} gyakorlat"`, chip row (`{gymFrequency}×/hét gym` wash chip + one chip per sport source `"▲▲ röpi"` / `"▲ futás"` in the sport/run tag colors, `×2` suffix when a kind repeats), right column: large display-font working-set count + `SZETT` label + coral `+~{xp} XP` muscle-XP estimate.
- **② Sport & futás terhelés** — one card per planned event: kind tag (`RÖPI`/`CROSS`/`TRX` rose, `FUTÁS` sky) + event name + right-aligned `Nap · HH:mm`, below a chip row of region-aggregated loads (`Váll ▲▲▲`, `Láb ▲▲`, `Core ▲` in region wash/deep colors). Empty week → `"Nincs tervezett sport/futás esemény ezen a héten."`
- **③ Growth előrejelzés** — one row per forecast skill: emoji in a wash circle (`ATHLETIC_META` from `levelUpMeta.ts`), name, thin progress bar (current `progressPct`), right column: display-font coral `+~{xp}` and, when `willLevelUp`, a sage `Lv {n} → {n+1} ↗` flag. Footer note: `"~ becslés a tervezett hét alapján — a valós XP a logolt teljesítményből számolódik"`.

### 2.3 Data wiring

`GymPage` passes props it already has from `useTrain()`: `meso` (activeMeso) + `sportSlots` (`sport.schedule` slots; `null` schedule → `[]`). The sheet itself calls `useRunning()` + `useProgressionProfile()` (both from `@/data/hooks`) so those queries run only when the sheet is open. All three logic modules are pure — the sheet is a thin view.

**Mock/real parity:** every input is live in both modes (meso fixture / API, sport schedule fixture / API, running block fixture / API, progression profile mock / API) — no mode branch inside the new code. Real-mode empties ghost per section (no sport schedule → empty ② line; profile ghost → forecast treats all skills as Lv 1 / 0 XP).

## 3. Testing

- `logic/muscleWeek.test.ts` — aggregation (sets/reps/exercises/frequency), rest-day filtering, sorting, region grouping.
- `logic/sportMuscleLoad.test.ts` — multi-slot weeks (incl. duplicate kinds ×2), run-week merge, region aggregation for event rows, empty inputs.
- `logic/growthForecast.test.ts` — known planned week → exact XP numbers per formula, anchor-less exercise omission, plyo branch, defaults (sets/rounds/RPE/duration), `willLevelUp` threshold edge, absent-skill = Lv 1 baseline.
- `sheets/MuscleWeekSheet.test.tsx` — renders all three sections from fixture props (mock mode), empty-week ② line.
- `pages/GymPage.test.tsx` — extended: card tap opens the sheet; muscle grid shows every trained muscle.
- Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green).

## 4. Documentation

- `docs/features/train.md`: §2 `Gym` paragraph (card grid + sheet), §Phase-3 note (the static sport-load heuristic is the interim for the cross-load engine), file map (§8) additions; run `node scripts/lint-docs.mjs`.
- No growth.md change (read-only consumer of the progression profile).

## 5. Out of scope / future

- Phase-3 live cross-load → volume engine (replaces `sportMuscleLoad.ts` wholesale; the mock-only `crossLoad` fixtures and `CrossLoadRow` views are untouched by this change).
- Backend forecast endpoint (revisit if the mirrored constants drift becomes a real maintenance pain).
- LIFE-skill / quest / robustness XP in the forecast; PR + HR-recovery bonuses.
- Any change to `volumePerMuscle` (MEV/MAV/MRV) — the builder's `Volumen` view stays the provenance surface.
