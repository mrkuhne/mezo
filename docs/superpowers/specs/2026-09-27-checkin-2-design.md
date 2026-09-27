# Check-in 2.0 — a richer check-in that feeds everything

- **bd:** to be filed (this cloud session has no `bd`; file an epic + slices at the start of the
  planning session and replace this line).
- **Date:** 2026-09-27
- **Branch:** `claude/checkin-questions-refinement-orm0mt`
- **Owner decisions (this session, do not reopen):**
  1. All five missing topics come in: **mood** (separate from clarity), **hunger + craving**,
     **muscle soreness + pain** (separate from plain tiredness), **morning restedness**,
     **motivation**. Plus an evening **"how was the day"** rating.
  2. All three directions ship: **clean-up** (no pre-set values, skip = empty), **time-of-day
     questions**, **the adaptive "question of the day"**.
  3. **Max it out** — as many questions as research says still works; the owner will say when it is
     too many. The question plan must therefore be **trimmable without a rebuild**.
  4. A **"Most csak ennyi"** quick exit after the core items.
  5. **Everything ships in one go** (one release, not two waves).
  6. Guiding principle, in the owner's words: *"lényegében mindent is táplálni fogunk az új
     checkinnel … minél gazdagabb legyen tőle minden."* Every area that can use an answer must use it
     visibly.
- **Approved prototype:** pending (gate 2). Nap living prototype (`docs/design_2.0/prototypes/elo/nap.html`,
  check-in sheet + Napom day rating) and Edzés living prototype (`elo/edzes.html`, readiness card).

## 1. Problem

The check-in (4 fixed slots: 06:30 · 10:00 · 14:00 · 20:00; four 1–10 items energy, stress, body,
mental + optional note) feeds ~40 consumers (map in §9), but:

1. **Pre-set values pollute every consumer.** `CheckInSheet.tsx:70` seeds `{energy:7, stress:4,
   body:7, mental:7}`, and "Kihagy" (`:185`) keeps the seed, so a click-through is stored as a real
   "fine". Every flag, pattern, detector and prompt treats it as truth. Research agrees: a pre-set
   anchor biases answers, more on phones (Liu & Conrad 2019).
2. **Mood is consumed but never asked.** `mental` is labelled "Mentális tisztaság" (Köd–Éles), yet
   `PeopleMoodLinkDetector` uses it as mood, `SignalCatalog` labels it "Check-in hangulat", and
   `ComfortEatingDetector` treats `mental <= 4` as low mood.
3. **`body` is ambiguous** (tired? sore? in pain?) while the train patterns want exactly that
   distinction.
4. **Same four items four times a day.** Restedness only makes sense in the morning, hunger around
   meals, a day verdict in the evening.
5. **Topics the system only guesses:** hunger/craving (comfort eating infers it from stress), soreness,
   pain location, motivation.
6. **The chat snapshot and the daily summary only see energy + stress**
   (`ContextSnapshotAssembler.java:678-696`, `DailySummaryService.java:238-253`).

## 2. The question plan

### 2.1 Items

All numeric items are **1–10 tap rows with nothing pre-selected**. An unanswered or skipped item is
stored as `NULL` and never counted anywhere. Stress and soreness keep "10 = worse".

| id | Label (UI) | Question | 1 ↔ 10 anchors | Kind |
|---|---|---|---|---|
| `energy` | Energia | Mennyi energia van benned most? | Üres ↔ Tele | core |
| `mood` **new** | Hangulat | Milyen most a hangulatod? | Nagyon rossz ↔ Nagyon jó | core |
| `stress` | Stressz | Mennyire vagy feszült most? | Nyugodt ↔ Túlfeszült | core |
| `body` | Testi érzés | Hogy érzi magát most a tested? | Lerakva ↔ Friss | core |
| `mental` | Fejtisztaság | Mennyire tiszta a fejed? | Köd ↔ Éles | core |
| `rested` **new** | Kipihentség | Mennyire pihented ki magad éjjel? | Egyáltalán nem ↔ Teljesen | slot |
| `soreness` **new** | Izomláz | Mennyire van izomlázad? | Nincs ↔ Nagyon erős | slot |
| `pain` **new** | Fájdalom | Fáj valami? | Nem / Igen → **hol** (multi) → **mennyire** 1–10 | slot |
| `motivation` **new** | Motiváció | Mennyi kedved van a mai dolgaidhoz? | Semmi ↔ Tele vagyok vele | slot |
| `hunger` **new** | Éhség | Mennyire vagy éhes most? | Egyáltalán nem ↔ Nagyon | slot |
| `craving` **new** | Sóvárgás | Kívánsz most valamit? | Nem ↔ Nagyon → **mit** (édes · sós · zsíros · bármit) | slot |
| `day` **new** | A nap mérlege | Milyen volt a napod összességében? | Nagyon rossz ↔ Nagyon jó | slot |

Pain regions (fixed list, multi-select, drawn on a simple front/back figure): fej · nyak · váll ·
könyök · csukló, kéz · felső hát · derék · csípő · térd · boka, lábfej · has · egyéb. No side
(bal/jobb) in v1. The train `BodyMap` is a muscle map; the pain figure is a new, simpler
region picker in the same drawing style.

### 2.2 Which items when

| Slot | Core (5) | Time-of-day items | + Question of the day | Max |
|---|---|---|---|---|
| Reggel 06:30 | energia · hangulat · stressz · testi érzés · fejtisztaság | kipihentség · izomláz · fájdalom · motiváció | 1 | 10 |
| Délelőtt 10:00 | ↑ | motiváció · éhség | 1 | 8 |
| Délután 14:00 | ↑ | éhség · sóvárgás | 1 | 8 |
| Este 20:00 | ↑ | izomláz · fájdalom · sóvárgás · a nap mérlege | 1 | 10 |

- **Quick exit:** after the five core items a secondary button **"Most csak ennyi"** saves the
  check-in; everything not yet asked stays `NULL`. The check-in still counts as done (day score,
  quest, rings, streaks).
- **Per-item skip** ("Kihagyom") stays and stores `NULL`.
- **The question plan is server config**, not frontend code (`mezo.checkin.plan` in
  `application.yml`, served by a new `GET /api/biometrics/checkin/plan`). Trimming a question is a
  config change + deploy, no frontend release. Slot times stay the four fixed ones (moving them is
  out of scope; the four hard-coded "4"s stay valid).

### 2.3 The question of the day (adaptive slot)

One extra item per check-in, chosen server-side when the plan is fetched for a slot:

- **Pool:** every non-core item not already in that slot's plan and meaningful at that time
  (`rested` morning only; `day` evening only).
- **Choice:** 80 % by need, 20 % uniformly random (planned-missingness guard, so rotating series stay
  unbiased — Silvia et al. 2013; "Ask Less, Learn More", IMWUT 2024).
  - *Need* = the item whose series is thinnest among the items that an **active hypothesis, open
    pattern pair or enabled detector** is waiting on (count of non-null answers in the last 14 days,
    lowest first). No active need → random.
- **Transparency:** the item carries a one-line "why": e.g. *"Most azt figyeljük, a délutáni
  sóvárgás összefügg-e az alvással."* (need) or *"Ma ez a véletlen kérdés."* (random).
- **Logged:** which item was offered and why (`adaptive_item`, `adaptive_reason`), so analysis can
  separate need-driven from random answers.

## 3. What each area gets (the "feed everything" map)

Every row lists the concrete integration point (anchors from recon, §9). "Visible" = what the owner
notices.

### 3.1 Companion chat, daily summary, tools, memory
- `ContextSnapshotAssembler.checkInValues` (`:678-696`) and `DailySummaryService.addCheckIns`
  (`:238-253`) render **every non-null item** through one shared renderer (new
  `CheckInText.render(CheckInEntity)`), also used by `BiometricsTools.renderCheckIns`,
  `MealCoachPrompt.appendCheckIns` and `PersonalRecordSource`. Pain renders as
  "fáj: térd, derék 6/10"; craving as "sóvárgás 7/10 (édes)".
- Snapshot adds today's **day-level line** (all of today's check-ins, not just the latest).
- **Visible:** the companion knows about pain, hunger, low motivation without being told.

### 3.2 Flags (advice cards)
New rules (full 10-step wiring per rule, `FlagEvaluator` / `FlagCatalog` / `AdvicePriority` /
payload / renderer / properties / yml / `ck_companion_flag_log_flag_key` migration, keys ≤ 24 chars):

| Key | Raises when | Card says (HU) |
|---|---|---|
| `persistent_pain` | same region reported on ≥ 3 of the last 5 days | „Harmadik napja fáj a {térded}. Érdemes ránézni." — action: lighten tomorrow if a planned exercise loads that region |
| `poor_restedness` | `rested <= 4` on 2 consecutive mornings | „Két reggel egymás után nem pihented ki magad." |
| `craving_streak` | `craving >= 7` on ≥ 3 of the last 5 days, same kind | „Sokszor kívánsz mostanában {édeset}, főleg {délután}." |
| `motivation_slump` | day-mean `motivation <= 3` on ≥ 3 of the last 4 days | „Pár napja alacsony a kedved. Kisebb lépések?" |

Changed rules:
- `AcuteBadDayRule`: a slot also qualifies on `mood <= 3` or `pain intensity >= 7`.
- `RecoveryNeededRule`: adds `rested <= 4` or `soreness >= 7` as alternatives to the sleep-hours arm.
- Every rule reads `NULL` as "not answered" (already true for metric-based rules; audit the raw-row
  rules).

### 3.3 Training (Edzés)
- **Readiness hint on today's workout** (new, `WorkoutService.getToday` stays side-effect-free for
  this; a new read-only `ReadinessService.today(userId)` reads today's morning check-in):
  - `rested <= 4` or `soreness >= 7` or `motivation <= 3` → the today card shows **"Mai állapot:
    könnyebb nap javasolt"** with the reason, and a one-tap **"Könnyítsük"** that applies the existing
    `LIGHTEN_TOMORROW`-style lightening to *today* (one lever lower, `ProgressionDecider.Lever.HOLD`).
    Never automatic.
  - **Pain overlap:** a reported pain region that a planned exercise loads (region → muscle-group map,
    new `PainRegionMap`: váll→shoulder, térd→quad/ham, derék→back/core, …) marks that exercise
    **"Fáj a {váll}, ma óvatosan"** on its row.
- **Soreness after training:** new pattern pair `gym-workload~next-day-checkin-soreness` (lag 1) and
  per-muscle "how long soreness lasts after this session" surfaced by the Edző detector (§3.7).
- **Visible:** the workout adapts to how you feel this morning; sore/painful areas are flagged.

### 3.4 Meal coach and Fuel
- `MealCoachContextReader.CheckIn` (`:55`) gets `mood, hunger, craving, cravingKinds`;
  `MealCoachPrompt.appendCheckIns` renders all non-null items of the last check-in before the meal.
  Prompt guidance: a morning `hunger >= 7` at 10:00 → breakfast too small/light; `craving` of a kind →
  suggest a concrete satisfying option of that kind, not a generic one.
- **Visible:** meal advice reflects hunger and craving ("10-kor már éhes voltál").

### 3.5 Comfort eating
- `ComfortEatingDetector`: low-mood test becomes `mood <= 4 OR stress >= 7` (mental no longer used
  as mood; falls back to `mental <= 4` for days with no `mood`, so history keeps working), and a
  **direct arm**: craving days (`craving >= 7`) vs NOVA-4 share.

### 3.6 Sleep
- New Szomnológus detector **`sleep-need`**: pairs morning `rested` with the previous night's
  `sleep_log` duration; after ≥ 14 paired nights, estimates the duration above which `rested` stops
  improving ("neked kb. 7,5 óra elég"). Shown as a character signal; if it differs from
  `sleep_goal.target_minutes` by ≥ 30 min, it proposes updating the goal (no silent change).
- `SelfCalibrationDetector`: energy-vs-sleep-quality arm gains a `rested`-vs-`sleep_log.quality` arm.

### 3.7 Character team (detectors)
`DetectorInput.CheckinDayPoint` (`:88-92`) and `CharacterSignalReads.toCheckinDays` (`:298-326`) gain
the new day means (`mood, rested, soreness, painIntensity, motivation, hunger, craving, day`) plus
`painRegions` (distinct regions of the day). New / changed detectors:

| Detector | Expert | What it says |
|---|---|---|
| `PeopleMoodLinkDetector` (changed) | Antropológus | uses `mood` (fallback `mental` for older days) |
| `pain-map` (new; extends the niggle idea with self-reported regions) | Doki | „A derekad 2 hete visszatérő; főleg ülős napokon." |
| `sleep-need` (new, §3.6) | Szomnológus | personal sleep need |
| `craving-trigger` (new) | Táplálkozó | which prior-day factor precedes cravings (short sleep, high stress, low protein) |
| `mood-text-calibration` (new) | Pszichológus | check-in `mood` vs `text_signal.mood` from the journal (scales 1–10 vs 1–5, rescaled): do you write the way you rate? |
| `motivation-follow-through` (new) | Drill | morning `motivation` vs what actually got done (workouts, habits) |
| `soreness-recovery` (new) | Edző | per session type, days until soreness returns to baseline |

### 3.8 Pattern engine
New `MetricKey`s: `CHECKIN_MOOD, CHECKIN_RESTED, CHECKIN_SORENESS, CHECKIN_PAIN, CHECKIN_MOTIVATION,
CHECKIN_HUNGER, CHECKIN_CRAVING, CHECKIN_DAY` (`CHECKIN_PAIN` = day max intensity, 0 when answered
"Nem"). `MetricSeriesService` switch + getters. New pairs in `mezo.companion.patterns.pairs`:

- `sleep-duration~checkin-rested` (lag 0) · `sleep-quality~checkin-rested`
- `sleep-duration~next-day-checkin-craving` · `checkin-stress~checkin-craving`
- `daily-protein~checkin-hunger` (same day) · `meal-score~checkin-craving`
- `gym-workload~next-day-checkin-soreness`
- `training-monotony~checkin-motivation` · `sleep-quality~checkin-motivation`
- `social-mentions~checkin-mood` · `habits-done~checkin-mood` · `daily-xp~checkin-mood`
- `checkin-mood~checkin-day` (does the momentary mood predict the day verdict?)
- `day-score~checkin-day` (does the app's day score agree with yours?)

Existing `*~checkin-mental` pairs stay (clarity is still a real series).

### 3.9 Life goals
- `SignalCatalog`: `checkin_mental` relabelled **"Check-in fejtisztaság"**; new entries
  `checkin_mood` ("Check-in hangulat", Elme), `checkin_motivation` ("Motiváció", Elme),
  `checkin_rested` ("Kipihentség", Test).
- `LifeGoalTriggerRules` + `LifeGoalProposeLlmAdapter.TRIGGER_SOURCES`: new triggers
  `checkin_motivation_lte` (default 4) and `checkin_mood_lte` (default 4). Enables "ha nincs kedvem,
  akkor csak 10 perc" plans.

### 3.10 Evening: day verdict, Napom, ritual
- The evening `day` rating is stored on the check-in.
- **Napom** (`NapomLeadCard`): next to the app's day score, **"Te: 7/10"**; when they differ by a
  lot (score band vs rating band), one line: „Az app szerint közepes nap, szerinted jó volt."
- `DayReviewService` gets `day` as a context signal; the AI day review can acknowledge the gap.
- **Ritual Reflection step** shows the day rating if given (read-only), so the evening check-in and
  the ritual do not ask the same thing twice.

### 3.11 Week, insights, rings, day score
- `MeWeekService`: adds `avgCheckinMood`; the week view shows mood next to energy.
- Insights metric series (`checkin-energy`, `checkin-stress` today): the new series appear
  automatically through `MetricKey` (verify the frontend list, `insights.ts:333-336`).
- Day score logging component: a check-in counts as filled when **at least the core** was answered
  (quick exit included). Unchanged weight.
- Lélek ring refill (`needsInputs.ts:151-160`) unchanged.

### 3.12 Notifications and copy
- Push body (`notificationScheduleWriter.ts`): „Hogy vagy most? Pár koppintás, fél perc."
- `NapCheckinPage` next-slot sub-line: „hogy vagy most?" (was energy-only „hogy vagy energiával?").

## 4. Data model

One Liquibase changeset in `1.1.0` (`yyyyMMddHHmm_<bd-id>_checkin_2.sql`), all nullable:

```sql
ALTER TABLE check_in
  ADD COLUMN mood            SMALLINT,
  ADD COLUMN rested          SMALLINT,
  ADD COLUMN soreness        SMALLINT,
  ADD COLUMN pain            BOOLEAN,          -- NULL = not asked/skipped, false = "Nem"
  ADD COLUMN pain_regions    VARCHAR(16)[],
  ADD COLUMN pain_intensity  SMALLINT,
  ADD COLUMN motivation      SMALLINT,
  ADD COLUMN hunger          SMALLINT,
  ADD COLUMN craving         SMALLINT,
  ADD COLUMN craving_kinds   VARCHAR(8)[],
  ADD COLUMN day_rating      SMALLINT,
  ADD COLUMN asked_items     VARCHAR(16)[],    -- what the sheet showed (plan + adaptive)
  ADD COLUMN adaptive_item   VARCHAR(16),
  ADD COLUMN adaptive_reason VARCHAR(16),      -- 'need' | 'random'
  ADD COLUMN quick_exit      BOOLEAN NOT NULL DEFAULT false;
```

Range checks 1–10 as `CHECK` constraints. `asked_items` distinguishes "not asked" from "skipped"
(asked + NULL). Old rows: `asked_items` NULL = legacy (the four items were always shown, with
pre-set values; treat as-is — there is no way to tell a click-through apart).

API (`api/feature/checkin/checkin.yml`): `SaveCheckInRequest` / `CheckInResponse` gain the fields;
`energy/stress/body/mental` stay optional; new `GET /api/biometrics/checkin/plan?date&slotTime` →
`{ items: [{id, label, question, low, high, kind, extra?}], adaptive: {id, why} | null }`.
Contract-first as usual (`BiometricsContractIT`).

## 5. The sheet (UI, to be prototyped)

- Same capture sheet, one item per step, 1–10 row with **no selection**; tap selects and advances.
- Progress shows the real count for this slot ("03 / 09").
- After item 5: **"Most csak ennyi"** (secondary) next to the next step.
- Pain: Nem / Igen; Igen → figure with regions → intensity row. Craving: row, then kind chips when
  `>= 4`.
- The question of the day is marked with a small "A nap kérdése" eyebrow and its one-line why.
- Summary step: every answered item as a cell (skipped shown as „—"), note, save.
- Titanium sprite icons for each item; new icons (mood, rested, soreness, pain, motivation, hunger,
  craving, day) go on the prototype's „Új ikonok" sheet for owner OK.

## 6. Error handling and honesty
- Nothing is ever defaulted: `NULL` is not „közepes" anywhere (audit every raw-row reader:
  `AcuteBadDayRule`, `EnergyDipMealTimingRule`, `MealCoachContextReader`, detectors).
- New detectors and flags keep the existing small-n guards (`UnavailableReason`, `MIN_*`), with a
  Whoop-style rule for rotating items: no finding until ≥ 5 answers in each compared group.
- Adaptive choice is logged; analysis code that needs unbiased series can filter to
  `adaptive_reason = 'random'` or plan-asked answers.

## 7. Testing
- Backend: migration + contract IT; `CheckInService` round-trip of every field; plan endpoint
  (slot plans, adaptive 80/20 with a seeded RNG, need ordering); each new/changed flag rule
  (raise / clear / small-n / NULL-is-not-answered); `MetricSeriesService` new keys; each new detector
  with fixtures; renderer snapshot tests for chat/summary/meal coach; life-goal trigger matching.
- Frontend: `CheckInSheet` (no pre-selection, skip = null, quick exit, pain + craving sub-steps,
  adaptive eyebrow, per-slot plan), `NapCheckinPage` done-row cells for the new items, Napom
  „Te: X/10", training readiness card + pain row marker; both modes (`CI=true`, mock +
  `VITE_USE_MOCK=false`), 320 px layout specs, reduced motion.

## 8. Slices (the plan will expand these; shipped together as one release)
1. Data model + contract + plan config/endpoint + adaptive chooser.
2. The sheet (all item kinds, quick exit, adaptive) + `NapCheckinPage` + copy + notifications.
3. Shared check-in renderer → chat snapshot, daily summary, tools, meal coach, personal records.
4. Flags (4 new, 2 changed).
5. Metrics + pattern pairs + life-goal signals/triggers + week/insights.
6. Character detectors (1 changed, 6 new; ComfortEating/SelfCalibration updates).
7. Training readiness + pain overlap.
8. Evening day verdict: Napom, day review, ritual.
9. Docs: `docs/features/me.md` (check-in backend), `today.md`, `train.md`, `character.md`,
   `companion.md`, `lifegoal.md`, `ritual.md`, feature index, milestone log; living prototypes synced.

## 9. Codebase terrain (recon, 2026-09-27)

**Write path.** `CheckInEntity` (`feature/biometrics/checkin/entity`), `CheckInService.save()` upserts
on (user, date, slotTime), sets `savedAt`, publishes `CheckInSavedEvent` → `FlagEvaluationListener`,
`LifeGoalTriggerListener`. Frontend always posts `state:'done'`; `skipped/now/pending` are derived
client-side (`checkinHooks.ts:37-40`). Slot times live only in `frontend/src/data/today/checkins.ts:3-8`.

**Consumers today, by field** (full audit in this session's recon):
- *energy:* ComfortEating, MedCycleCovariance, SelfCalibration; flags AcuteBadDay (raw ≤ 3),
  EnergyDipMealTiming; `CHECKIN_ENERGY` → 6 pattern pairs, Diagnosis FATIGUE, DayReview, Meso context,
  SignalCatalog, life-goal trigger (≤ 4); chat snapshot, daily summary, tools, meal coach; MeWeek.
- *stress:* ComfortEating (≥ 7), MedCycleCovariance; flags SustainedStress (≥ 7, 3 of 4 days),
  RecoveryNeeded (≥ 6); 2 pairs; Diagnosis; Meso; SignalCatalog; chat/summary/tools/meal coach.
- *body:* MedCycleCovariance, SelfCalibration (vs joint pain); AcuteBadDay; 2 pairs; FATIGUE;
  tools, meal coach. Not in chat snapshot or daily summary.
- *mental:* ComfortEating (≤ 4 as "low mood"), MedCycleCovariance, PeopleMoodLink (sole scale);
  4 pairs; SignalCatalog ("hangulat"); tools, meal coach. Not in snapshot/summary.
- *note:* embeddings, mentions, person extraction, team chat, memory repair/visibility, chat,
  summary, tools, SelfCalibration evidence, Nap timeline.
- *presence/count:* DayScore logging (÷ 4), MeWeek ratio, quest `checkin_full`, CheckinGap,
  edition "KERES" (< 8 of 14 days), WeekendGap, Lélek ring (+20), Napzárás chip, orb.
- *slotTime/createdAt:* CheckinLatency, SlotDrift, RetroLogging; *savedAt:* LoggingGap (48 h).

**Aggregation differs by consumer:** day mean (MetricSeriesService, CharacterSignalReads), raw rows
(AcuteBadDay), in-band median (EnergyDip), latest ever (snapshot), last before meal (meal coach).
New fields follow the same per-consumer choice.

**Integration points:** flags — 10-step wiring (`FlagRule`, `FlagKey`, `FlagEvaluator:50-65`,
`FlagCatalog`, `AdvicePriority`, `FlagPayloadEnvelope`, `FlagFactRenderer:49-65`, `FlagProperties`,
`application.yml:1319`, check-constraint migration; precedent
`202609062000_mezo-d58h.7.7_flag_key_energy_dip.sql`). Patterns — `application.yml:1699` pairs,
`MetricKey.java`, `MetricSeriesService:126-131, 478-495`. Detectors — `CharacterDetector` +
`@Component` + `@ConditionalOnProperty`, `DetectorInput.CheckinDayPoint:88-92`, experts in
`CharacterExpertCatalog:28-78`. Training — `WorkoutService.getToday:135` (has write side effects;
readiness must be a separate read), `SetRecommendationService.prescribe:264`,
`ProgressionDecider.Lever`, `AdviceActionKey.LIGHTEN_TOMORROW`, muscle groups `MuscleGroup.java:10`,
body map `frontend/src/features/train/components/BodyMap.tsx`; no body-region/joint vocabulary exists.
Sleep — `GoalSleepAdequacyAdapter`, `SleepGoalEntity.targetMinutes` (need is user-set, not derived).
Meal coach — `MealCoachContextReader:40-111`, `MealCoachPrompt:124-135`; no hunger/craving concept
exists. Life goal — `SignalCatalog`, `LifeGoalTriggerRules` (closed set of 3) mirrored in
`LifeGoalProposeLlmAdapter:45`. Ritual — `ReflectionStep.tsx` (prose only, no numeric rating),
`NapomLeadCard`. Liquibase — `1.1.0/1.1.0_master.yml` + `1.1.0/script/`.

**Known inconsistencies to fix on the way:** skip keeps the default (`CheckInSheet.tsx:185`);
ritual/NapHub/others disagree on "next fillable slot" (`openLoops.ts:23` vs `isFillableSlot`);
`NapCheckinPage.tsx:67` energy-only prompt; Lélek ring labelled "Kapcsolat" on `EletjelPage.tsx:45`
(out of scope, noted).

## 10. Prior art (recon, 2026-09-27)

- **Anchor + planned missingness** (Silvia et al. 2013, *Behav Res Methods*): fixed core every prompt,
  rotating items elsewhere; keep missingness planned/random so series stay analyzable. → core 5 +
  slot items + 20 % random in the adaptive slot.
- **Burden** (JMIR 2024 factorial, 32 arms): 15 vs 25 items, 2 vs 4 prompts/day did not change
  compliance; meta-analyses: ~8–10 items/prompt typical, fixed times help. → "max it out" is safe;
  keep each item one tap.
- **No pre-set slider / tap-to-place** (Liu & Conrad 2019; *Behav Res Methods* 2026 VAS vs slider):
  starting position anchors answers; untouched = missing. → no pre-selection, NULL on skip.
- **Mood as valence** (Apple State of Mind, How We Feel / Russell's Affect Grid): valence + energy
  already form the circumplex with two 1-D items. → `mood` as pleasant–unpleasant next to `energy`.
- **Adaptive selection** ("Ask Less, Learn More", IMWUT 2024; Whoop Journal needs ≥ 5 yes and ≥ 5
  no before an insight). → need-driven question of the day, ≥ 5 answers per group before a finding.
- **Item wording:** Consensus Sleep Diary restedness item; Flint et al. 2000 appetite VAS (hunger vs
  desire for sweet/salty/fatty as separate items); athlete wellness questionnaires (Hooper &
  Mackinnon 1995; McLean 2010) separate muscle soreness and pain, pain best as a yes/no gate + where.
