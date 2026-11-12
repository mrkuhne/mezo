# 15 — Feelfit smart scale → body composition in Boop

Issue `mezo-r36n9.27`, epic `mezo-r36n9`. Date 2026-11-12. Research + recommendation only; no product code.

## TL;DR

1. **The morning weigh-in already lands in Boop.** Feelfit (maker: Shenzhen QingNiu Software / "Yolanda",
   bundle `com.qingniu.feelfit`) writes to Apple Health, and B1's wide HealthKit read picks it up on app
   open. Production shows the first Feelfit samples on 2026-11-12: `body_mass` → `weight_log`
   (`source = apple_health`, linked by `external_id`), plus `body_fat_pct` and `lean_body_mass` in
   `health_sample` (source name `Feelfit`). Nothing to build for the *flow* of weight, fat % and lean mass.
2. **Only 4 of Feelfit's ~13 metrics leave the app through Apple Health**: weight, body fat %, BMI, lean
   body mass. HealthKit has no type for visceral fat, body water, bone mass, muscle / skeletal muscle,
   subcutaneous fat, protein, metabolic age; BMR is not written (HealthKit's `basalEnergyBurned` is a daily
   energy sample, not a body-composition value). Boop does not read BMI today (trivially computable from
   weight + profile height).
3. **The other metrics are locked in Feelfit.** No public cloud/data API exists (QingNiu publishes only a
   licensed Bluetooth SDK for device makers). Feelfit 4.17.0 added an "account data export" — format and
   fields unverified. A direct Bluetooth read is possible (openScale / Gadgetbridge / ble-scale-sync speak
   the "QN-Scale", Chipsea CS20-class protocol), **but the scale only sends weight + impedance**; Feelfit
   computes the metrics in a closed library, so our own formulas would show *different* numbers than the
   owner sees in Feelfit.
4. **What is missing is the *use* of the data**, not the data: body fat % and lean mass are stored but shown
   nowhere and not used by the goal engine (which prefers Katch-McArdle when body fat is known but reads only
   the scalar `profile.body_fat_pct`). Terv shows only "SÚLYOD kg → trend kg" from the brief.
5. **Recommendation:** a small standalone build slice right after B3 merges — "Testösszetétel": a body
   room/card in Terv (weight trend + fat % + lean mass with the days behind them), the latest Health body fat
   feeding the goal engine's BMR, `bodyFatPercentage` + `leanBodyMass` added to background delivery (paid
   team), BMI shown computed. ~2–3 days. Check the Feelfit export format before deciding on the extra metrics
   (option B below).

## 1. Routes out of Feelfit

| Route | What it carries | Automatic? | Status for Boop |
|---|---|---|---|
| **Apple Health** | weight, body fat %, BMI, lean body mass | yes (Feelfit writes after each weigh-in; Boop reads on open, background after paid team) | **already flowing** (B1) |
| Feelfit in-app "account data export" (v4.17.0+) | unknown — possibly all metrics | no, manual each time | unverified; owner to check the format |
| Feelfit cloud / developer API | — | — | **does not exist** publicly (QingNiu SDK is device-side, per-app licence) |
| Google Fit / Health Connect | (Android only, via Google Fit, low confidence) | — | irrelevant on iPhone |
| Fitbit link inside Feelfit | weight (2020 report, may be dead) | — | no value over Apple Health |
| **Direct Bluetooth (BLE)** from Boop | raw weight + impedance; metrics via our own formulas | yes, but Boop must be open near the scale, or replace Feelfit | feasible, fragile, numbers ≠ Feelfit |

Sources: App Store listing `id1216588019`; Sahha Feelfit integration page (the 4 HealthKit types);
`yolandaqingniu.github.io/en` (SDK + FAQ "custom protocol"); openScale wiki "Supported scales" (QN Scale,
QN Scale Broadcast, ES-CS20M) and issue #373 (`libyolanda_calc.so`, metrics differ); Gadgetbridge Chipsea
page; ble-scale-sync body-composition page. Caveat: a 2019 review reports Feelfit's Health sync breaking
after an update — sync reliability has broken before.

## 2. Per metric

| Metric | Available outside Feelfit? | Route | Flowing into Boop today? |
|---|---|---|---|
| Weight | yes | Apple Health `bodyMass` | **yes** → `weight_log` (apple_health) + `health_sample` |
| Body fat % | yes | Apple Health `bodyFatPercentage` | **yes** → `health_sample.body_fat_pct` (not shown, not used) |
| Lean body mass | yes | Apple Health `leanBodyMass` | **yes** → `health_sample.lean_body_mass` (not shown, not used) |
| BMI | yes | Apple Health `bodyMassIndex` | no (not read; compute from weight + height instead) |
| Muscle mass / skeletal muscle | no | export? / BLE formula | no |
| Body water % | no | export? / BLE formula | no |
| Bone mass | no | export? / BLE formula | no |
| Visceral fat | no | export? / BLE formula | no |
| Subcutaneous fat | no | export? / BLE formula | no |
| Protein % | no | export? / BLE formula | no |
| BMR | no (not written to Health) | export? / compute (goal engine already has Katch-McArdle) | computed by goal engine, not shown |
| Metabolic age | no | export? / proprietary | no |
| Fat mass (kg) | derived | weight × fat % | derivable |

## 3. What Boop already does (B1)

- iOS: `HealthKitReader` reads `.bodyMass`, `.bodyFatPercentage`, `.leanBodyMass` (60-day backfill, then
  anchored, on app open). `HealthBackground` registers background delivery for `bodyMass` only (active once
  the paid team is on).
- Backend `wearable`: every sample → `health_sample` (`metric`, value, unit, source name/bundle); `bodyMass`
  additionally upserts `weight_log` with `source = apple_health` + `external_id`, one goal recompute and one
  companion event per batch for a fresh weigh-in.
- Production shape (2026-11-12, counts only): `weight_log` 40 manual rows (2026-08-24 → 11-09) + 3
  apple_health rows (11-10 → 11-12; the 11-12 one is Feelfit). `health_sample`: `body_mass` 2 from the
  iPhone itself (manual Health entry, 11-10) + 1 Feelfit; `body_fat_pct` 1 Feelfit; `lean_body_mass` 1
  Feelfit. So the owner's Feelfit history before today was not in Health (or Health permission was granted
  today) — earlier weights were typed manually.
- Display: Terv shows today's weight → trend from the brief. Body fat / lean mass appear nowhere. Known gap:
  deleting a Health weight does not recompute the goal (`boop-ios.md` §open items).

## 4. How it would show in Boop (Napkelte)

Spec (`2026-11-11-boop-standalone-design.md` §3) has no body room; the weight goal lives in **Terv** (read-only
until B6). Fit it to the room skeleton (verdict → level/graph → the days behind it → actions):

- **Terv → "Test" card / room**: verdict sentence ("A súlyod a terv szerint csökken; a zsírszázalék 0,4 ponttal
  lejjebb két hét alatt."), weight trend line with the goal waterline, below it body fat % and lean mass as
  two quieter lines, then the weigh-in days behind them (each row: date, kg, fat %, source "Feelfit").
- **Ma**: no new card; the morning plan can mention a fresh weigh-in in one line (brief already carries weight).
- **Goal engine**: the latest Health body fat (≤ 14 days old) used for BMR (Katch-McArdle) instead of the stale
  profile scalar; "miért?" on the calorie target says which formula and which weigh-in.
- Extra Feelfit metrics (if option B): a "Részletek" row under the card with the last import's values — never a
  daily graph, since they arrive only when the owner exports.

## 5. Options and effort

| Option | What | Effort | Risk |
|---|---|---|---|
| **A. Use what arrives** | Test card in Terv, fat % into goal engine BMR, background delivery for fat % + lean mass, BMI computed | ~2–3 days (iOS view + small backend read model, no new tables) | low |
| B. A + occasional Feelfit export import | Upload the Feelfit export file in Boop → the other ~8 metrics as dated snapshots | +2–3 days, **only if** the export is a readable file with those fields | manual step; format may change |
| C. Own Bluetooth link to the scale | Boop reads the scale directly, computes all metrics | 1–2 weeks + per-model protocol work | numbers differ from Feelfit's; Feelfit and Boop may fight over the scale; breaks with firmware |

**Recommendation: A**, as a small standalone slice after B3 merges (B3 owns `HealthKitReader`,
`HealthReader` and `BoopDayAssembler`). It can also be folded into B6 (the Plan / weight goal), but A is cheap
and gives the owner his scale in Boop weeks earlier; B6 later builds the goal editor on top. Decide B after the
owner checks what Feelfit's export produces. C is not worth it.

## 6. Open questions

- Feelfit export: which format (CSV / Excel / PDF), which fields? (owner checks in the app)
- Does Feelfit write BMI to Health on the owner's phone? (Egészség → Böngészés → Testméretek → Adatforrások) —
  not needed for A (BMI computed), only confirms the four types.
- Sleeping-in-the-morning weigh-in timing vs. the 10-minute sync debounce: fine on open; with background
  delivery (paid team) the morning brief can wait for the weigh-in.
