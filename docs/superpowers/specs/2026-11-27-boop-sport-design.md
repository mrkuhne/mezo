# Boop Sport — a tenth area orb: the sport day next to the gym day

> bd `mezo-r36n9.188` (absorbs `mezo-wyb54`, takes over B5 `mezo-r36n9.15`'s unbuilt sport scope) · epic `mezo-r36n9` ·
> 2026-11-27 · spike `spike/boop-sport` @ `078d513d1` (throwaway, never merged) · owner decisions Q1–Q4 below

## 1. Intent — why

The owner, 2026-11-27: „a sportnap és az edzés nap most egyben van. lehet egy nap kondi is meg sport is vagy olyan
ahol csak az egyik van egy nap." Then, widening it: „kéne nekünk egy új menügömb akkor az edzés mellé, ami a sport …
a webes app és a szerveren lévő ÖSSZES sport featuret hozzuk át."

The server already stores the gym week (`gym_schedule_slot`, the mesocycle) and the sport week
(`sport_schedule_slot`) as independent layers. **The merge is in what Boop shows**: Ma carries one gym session and no
sport card; a logged volleyball marks the planned gym session done (`BoopDayAssembler.markDone` is kind-blind); the
Edzés room says „pihenőnap" on a sport-only day; the season menu feeds only the first sport window; and the only sport
surface in the app is the quick capture sheet. His real week (prod, read 2026-11-27): gym Mon–Fri 07:00, volleyball
Mon/Tue/Wed/Fri 18:00 for 120 min — so four of seven days are *both*.

## 2. Goals · non-goals · anti-goals

**Goals**
- A **Sport** orb on the home ring (10th), directly after Edzés, opening its own area page on the L0 kit.
- **Gym and sport are two things everywhere**: a day can be gym only, sport only, both, or neither — Ma, the Edzés
  room, the season week, the menu, the wall and capacity all read the two layers separately.
- Every sport feature of the retired web app and the server reaches the phone (inventory §5.8), minus the hidden ones.
- A volleyball he starts on his Apple Watch pre-fills the log; he adds only effort, sets and shoulder.

**Non-goals**
- The interval **run-plan builder** (Q1): running is a sport kind with a journal and the weekly rhythm only, until he
  actually starts running (then with watch distance/pace — its own slice).
- Moving sport in capacity re-plans (B7 keeps sport as context; `mezo-r36n9.187` is separate).
- A watchOS app (B5 / paid team).

**Anti-goals** (owner decisions, do not reintroduce)
- Stars, XP, medals, the sport ceremony, jump count — hidden (Q2, #52 gamification rule).
- A second card surface, notification policy or explanation: sport joins the Ma wall through a `WallSource`, its
  hints use the shared „miért?" (spec 2026-11-13 §5.1 rules).
- A plain text-and-list page (#119): every tab has a hero graphic.

## 3. Constraints

- **Owner decisions.** Q1 running = journal + schedule only. Q2 he starts Volleyball on the Watch → pre-fill from the
  Health workout, manual log stays as fallback. Q3 (spike round 1) Hét and Beosztás are one tab; the fourth tab is
  **Test**. Q4 (spike round 2) Test uses **the Edzés muscle map** (`NKBodyMap`), and recurring slots are edited and
  added on the Hét tab. Spike look OK'd 2026-11-27 („Mehet így").
- **Look.** Napkelte, a new hue `Hue.sport` (coral evening sky); gym blocks wear the Edzés colour (`Hue.mozgas`) so the
  two read apart on every shared graphic. No emoji, no SF Symbols beyond chevrons; a volleyball glyph `ball-sun` drawn
  as an outline (its filled artwork flattens into a blob on the dark look — fixed in the spike's kit change).
- **Data drift (must fix server-side).** Schedule slots and events accept only `volleyball|cross|trx` (DB CHECK + API
  pattern) while the log accepts ten kinds — a widening Liquibase change + contract change is required before the slot
  editor offers eleven kinds.
- **Prod reality.** `wearable_workout` holds only `strength` (35 rows): the Watch never recorded a volleyball yet, so
  pre-fill is built and tested on fixtures and verified live after his first Watch session. 19 `sport_session` rows
  (all volleyball, RPE avg 6.2, sets on 15, shoulder on 19, jumps 0); last logged 2026-11-02.
- **Hot spots.** `api/openapi.yml`/`merge.yml`, `ios/BoopKit/Sources/BoopAPI/**`, Liquibase master, `ResetDatabase` —
  one writer at a time (boop skill §3). Hue cases are exhaustive switches (`MaiView` metricKey, `AreaRoom`
  name/glyph/tabs, `KezdolapView`).
- **Parallel work.** `mezo-r36n9.15` (B5 player) owns the in-workout player; this slice does not touch it.

## 4. Approaches (owner picked: own area, four tabs)

| | What | Verdict |
|---|---|---|
| A — Sport inside Edzés as an inner tab | cheapest, but the Edzés room is already four tabs deep and the sport week would stay „under" the gym | rejected |
| **B — Sport as its own area orb** | the 10th ring orb, own page, own tabs; gym+sport meet on the shared graphics | **picked** („kéne egy új menügömb") |
| C — Only fix the merge (no new surface) | Ma/Edzés read both layers, no sport screens | too small for „ÖSSZES sport feature" |

Tab set round 1 was Ma · Hét · Napló · Beosztás; the owner merged Hét + Beosztás and asked for a relevant fourth →
**Ma · Hét · Napló · Test** (+ the kit's Boop ask button).

## 5. Design

### 5.1 The ring and the hue
- `Area`/`Hue` gain `.sport`; the ring places it right after Edzés (clockwise). Its orb fills with **this week's sport
  sessions done / planned** (e.g. 2/4); „–" when there is no rhythm yet. Checked on iPhone 17 Pro Max and iPhone 16e:
  ten orbs, no name collisions.

### 5.2 Ma — tonight's sport
Top to bottom (spike `SportMa`):
1. **Hero card** — ring with the week count, „Ma este · 18:00", sport name, length · kind · place. Four moments:
   - *before*: „6 ó 20 p múlva kezdődik", „2/4 e heti röpi kész", a line asking him to start the Watch workout,
     **Ma kihagyom** · **Rögzítem most**.
   - *after the Watch recorded it*: duration, kcal and average HR from the Health workout, one button **Kiegészítem**
     (badge 1 on the Ma tab).
   - *done*: load (RPE × min), kcal, sets, shoulder; the orb moves to 3/4.
   - *skipped*: the reason chip, „a heti szabad kihagyás" when the first soft skip of the week, **Visszavonás**.
2. **A napod** — a 6–23 time strip with the gym block (Edzés colour) and the sport block (coral) as two blocks, a tick
   on each when done.
3. **Ezen a héten** — day-card carousel, each card two lanes (gym line, sport line), today outlined.
4. **Amire figyelek** — interference hints (gap between the two, hard sport before a heavy gym morning).
5. Ask row.
A sport-only day shows the same page with no gym block; a gym-only day shows „Ma nincs sport" with the next one.

### 5.3 Hét — the week and its rhythm
1. **Hero** — heti mozgás / kondi / sport totals and the two-lane week chart (filled = done, outlined = planned, today
   in coral).
2. **Terhelés · 6 hét** — stacked bars per week, sport (RPE × min) over gym (volume load converted to the same scale,
   §5.7).
3. **A heti rend** (was Beosztás) — a one-line explainer (gym days are set in Évad, sport here), then
   - **Rendszeres alkalmak** — one row per slot (day time · sport, length · edzés/meccs · place), tap → slot editor;
     **Új rendszeres alkalom**.
   - **Egyszeri események** — date tile, title · kind, time · length · place, and what Boop changes because of it
     („aznap és előtte nem teszek nehéz lábnapot"); **Új esemény**.
   - **Milyen sportot írhatsz be** — the eleven kinds.

### 5.4 Napló — the journal
Hero: alkalom · 4 hét, átlag megterhelés, váll átlag, the RPE line of the last sessions, one sentence about the
shoulder. Then one card per session: date, title, load number, chips (duration, megterhelés, szett, váll), „N kcal az
órádról · átlagpulzus" when a Watch workout matched. Tap → the log sheet in edit mode (correct / delete).

### 5.5 Test — how the body takes gym + sport together
1. **Hero** — a switch **Együtt · Kondi · Röpi** over `NKBodyMap(views: .both)`: Kondi in the Edzés hue from the
   week's gym muscle volume, Röpi in coral from the sport muscle-load table (§5.7), Együtt = the two combined (scale,
   capped at 1). One sentence per mode; stats: izom kap mindkettőből · váll átlag · pihenő köztük.
2. **A vállad · 6 hét** — weekly average shoulder strain after sport, a dashed line at 7, the current week bright.
3. **Pihenő a kettő között** — per day of this week a 6–23 strip with both blocks and the gap in hours; one sentence.
4. **Amire figyelek** — Boop's hints with **miért?** (the shared why sheet, expert lines as labelled rows).
5. Ask row („Kérdezd meg Boopot a testedről").

### 5.6 Sheets (opened for review, actions at the bottom)
- **Log** — pre-filled block „Az órádról" (duration, kcal, HR) when a matching Health workout exists; otherwise sport
  chips + duration. Then effort 1–10 (defaults to his last value), sets, shoulder, note → **Mentés**. Offline-first via
  the existing `OutboxKind.sportSession` (`clientRef`).
- **Skip** — eight reasons (Beteg vagyok, Gyomorpanasz, Sérülés, Utazom, Fáradt vagyok, Nincs időm, Nincs kedvem,
  Egyéb) → **Kihagyom**; serious reasons follow the existing kímélő-mód rules.
- **Slot editor** (edit + new) — sport (11 chips), day (7 tiles), start and length steppers (15 min), edzés/meccs,
  place; an **Ez változik** box (from next week; the gap to that morning's gym; a same-day clash notice) →
  **Mentés** / **Felveszem**; **Alkalom törlése** on edit. The schedule is a full replace server-side (PUT); the phone
  sends the whole list.
- **Event** — date, title, kind, time, length, place → **Mentés**; delete on edit.

### 5.7 Gym + sport as two things everywhere (server)
- `BoopDayAssembler`: `BoopDay` gains a `sport` list next to `session`; `markDone` matches **by kind** (a sport log or
  a volleyball Health workout ticks the sport, a gym instance or a strength workout ticks the gym).
- Ma wall: a `sport` `WallSource` (tonight's game, „the Watch recorded it — complete it", skipped) — the one card
  surface.
- Edzés room: a sport-only day reads „Ma sport van: röpi 18:00" with a door to the Sport area, never „pihenőnap".
- `SeasonMenuSourceAdapter`: every sport window of the day feeds the menu (pre-session snack per window).
- Évad week / Módosítás: the two rows stay separate (already true), the week view shows both.
- **Read models the phone needs** (one new endpoint family under `/api/train/sport/…`, contract first):
  `overview?week=` (week lanes for both layers, totals, week count, tonight's moment incl. the unmatched Health
  workout for pre-fill), `load?weeks=6` (sport RPE×min and gym load on one scale), `body?week=` (per-muscle heat
  for gym and sport; sport from a server-side **sport → muscle-load table** — volleyball: shoulders, quads, calves,
  core, glutes — scaled by session load), `shoulder?weeks=6`, `gaps?week=`. Hints reuse `SportInterferenceDetector`
  logic, moved off the character feature or called through a port.
- **Widening migration**: slot + event kinds = the log's ten + `other`; API patterns aligned.

### 5.8 Inventory — what comes over, what stays hidden
| Comes over | Where |
|---|---|
| sport log (10 kinds, duration, RPE, sets, rounds, shoulder, note, kcal override) + edit/delete | Log sheet, Napló |
| weekly sport schedule (GET/PUT) | Hét · A heti rend, slot editor |
| one-off events (GET/POST/DELETE) | Hét · Egyszeri események, event sheet |
| slot skips + planned skips with reasons, undo | Ma hero, skip sheet |
| Health workout ingest + reconciler | log pre-fill, done-matching |
| crossload / all-movement week, sport muscle load | Hét hero, Terhelés, Test |
| interference detector | Ma · Amire figyelek, Test hints |
| running as a kind (journal + schedule) | everywhere a kind appears |
| **Hidden**: stars/ceremony, XP, medals, jump count, run-plan builder, `skip_sport_slot` coach advice card (folds into hints) | — |

### 5.9 States and accessibility
- Empty („Még nincs sportod" → **Heti rend megadása**), loading (skeleton cards), error („Nem érem el a sportodat",
  **Újra**, capture still works), offline (the last cached week + „Nincs net" note; capture queues).
- **Largest Dynamic Type (spike found these breaking):** chips and day tiles must wrap whole words (flow layout, never a
  split word); the 1–10 effort row becomes two rows of five; the hero card stacks the ring above the text; the tab bar
  uses the kit's large-text behaviour. VoiceOver labels on every chart (as in the spike) and every chip/tile with its
  selected trait. Reduced motion: no orb/ring animation beyond the kit's own handling.

## 6. Left to the builder
- The gym→„load" conversion for the shared Terhelés scale (spike shows the shape only); pick one defensible rule and
  state it in `train.md`.
- Exact sport → muscle-load weights per kind (volleyball first; others a sensible default, honest „–" when unknown).
- Whether `overview` folds into the existing Boop day read model or stays its own call (cache key `sport/overview`).
- Photo rule: the head uses the coral hue's mood photo; session cards may carry the sport's photo where one exists.

## 7. Prior art
- **Session-RPE × duration** (Foster) is the standard team-sport load; Apple Training Load (iOS 18 `workoutEffortScore`,
  1–10) uses the same scale, so his number matches the Watch's.
- **Whoop / Garmin**: auto-detect the activity, then ask to confirm and add effort — the pattern behind Q2's pre-fill;
  one-tap completion from a notification or widget.
- **Strava / Apple Fitness**: the week as lanes or rings, the log as cards with one hero number.
- **Muscle maps** (Fitbod, Hevy): heat per muscle from the week's work, front + back — Boop already has it in Edzés.
- Concurrent-training guidance: ≥ 6–8 h between a strength session and a high-impact sport, avoid heavy lower-body work
  the morning after a hard jump session — the basis of the gap strip and the hints.
  (From the 2026-11-27 recon UX scout — session notes `kondi-sport-nap-recon.md`; reference points: Apple HealthKit
  `HKWorkoutActivityType.volleyball` and `workoutEffortScore`, Foster et al. 2001 session-RPE. The concurrent-training
  gap figures are common coaching guidance, to be re-checked by the builder before they become hint thresholds.)

## 8. Codebase terrain
- **Backend, train:** `feature/train/entity/{SportSessionEntity,SportScheduleSlotEntity,SportEventEntity}`,
  `service/{SportService,SportSlotSkipService,PlannedSkipService,PlannedSkipPolicy,SportGroups}`,
  `controller/PlannedSkipController`, contract `api/feature/train/{train.yml,train-skip.yml}`; Liquibase history
  `1.0.0/script/202606121000_mezo-0ae_t3_sport_schedule.sql`, `202607141200_mezo-05v6_sport_schedule_slot_sport.sql`.
- **Backend, others:** `feature/boop/service/BoopDayAssembler.java:264` (`sessionWithDone`/`markDone`, kind-blind),
  `feature/wearable/service/WorkoutReconciler.java` (volleyball vs strength sets),
  `feature/season/service/SeasonMenuSourceAdapter.java` (first sport window only),
  `feature/character/detector/SportInterferenceDetector.java` (strain ≥ 6 or RPE ≥ 8),
  `feature/capacity/service/CrossEffectCalculator.java`, `feature/train/service/PlanEvaluator.java` (sportSameDay).
- **iOS:** `BoopCore/Health/{HealthKitReader,WorkoutMapper}.swift` (volleyball already mapped),
  `BoopCore/Ritmus/{Outbox,RitmusClient}.swift` (`OutboxKind.sportSession`), `BoopCore/Train/TrainClient.swift`,
  `Boop/Capture/CaptureSheet.swift` (quick sport entry), `Boop/Kezdolap/{Area,KezdolapView}.swift`,
  `Boop/Nap/{AreaRoom,MaiView,NapView,MaWall}.swift`, `Boop/Edzes/EdzesRoom.swift` (`NKBodyMap` heat usage ~566),
  kit `BoopDesign/Napkelte/{Area,AreaBlocks,BodyMap,Glass,Tokens,Wall}.swift`.
- **Spike (reference only):** `ios/Boop/SportDemo/SportDemoRoom.swift` on `spike/boop-sport` — flags `-previewSport YES`,
  `-sportTab Ma|Hét|Napló|Test`, `-sportMoment`, `-sportState`, `-sportSheet log|skip|slot|slotNew`, `-sportMap`.
- **Docs to update on ship:** `docs/features/boop-ios.md`, `docs/features/train.md`, a new handbook folder page for
  Sport, `_funkciok.json` rows for the sport endpoints.
