# Boop: backdated capture, the Napló's catch-up, the gym catch-up, and drinks (2026-11-24)

**Issues:** `mezo-r36n9.159` (backdating + the Napló's catch-up), `.160` (drinks), `.161` (the gym catch-up).
**Owner decisions (2026-11-24):** entry point **A** („menjen az A szerintem") — a „Mikor" row on every capture sheet
plus the day's own catch-up buttons in the Napló; gym catch-up **B** („mehet a B") — a past template day can be booked
„Megvolt" with the plan's numbers, the server learns a date. The drink rules below were played back and not contested;
the final OK (2026-11-24, with the spike: „annyi, hogy italhoz is lehessen használni recept vagy kamra itemeket, ne
kelljen mindig nulláról felvenni őket") added one thing: the recipe, shelf and barcode doors stay open in drink mode. **Spike:** branch `spike/boop-visszamenoleg-ital` (throwaway), screenshots in
`docs/superpowers/specs/assets/visszamenoleg-ital/spike/`.

## 1. Intent

The owner's list (2026-11-24, „szükséges újdonságok"): (1) **visszamenőleg logolás** — étel, súly, edzés, alvás, napló,
check-in pótlás, napzárás; (2) **ital logolási opciók** — a drink (fehérje, gombakávé zabtejjel-mézzel) has calories
but must not consume a meal window of the day's plan.

Today every capture but the meal composer is stamped „now" by the phone; the server already accepts a date for all
of them (§6). The gym workout is the one record the server dates itself. A drink today is a meal: the clock picks its
window (10:30 → tízórai), the window counts as eaten, and the drink's score moves the Étel orb's number.

## 2. Goals · non-goals · anti-goals

- **Goals:** one „Mikor" control, the same on every capture sheet, default „Most/Ma", one tap for yesterday, the
  resolved day always readable beside it; the last week's days always present in the Napló with the day's own catch-up
  buttons (check-in moment, gym day, close); a past gym day booked as planned in one tap, offline-first; a sixth
  **Ital** bucket that counts in the day's kcal, macros and curve but never fills a window and never earns or loses
  meal points; the owner's usual drinks one tap away.
- **Non-goals:** editing the date of an entry already saved (a saved meal/weight/sport keeps its day; the Hét/Napló
  lists are not editors here); water and supplements (not asked; water stays today-only, supplements already carry
  `capturedAt`); a drink category for recipes or shelf items (any recipe or shelf item can be logged as a drink, its
  category is irrelevant); caffeine timing from drinks (later, see §9); the Napló place's own
  food list (none exists); a gym catch-up with set-by-set numbers typed in (the plan's numbers go in; one weight per exercise may be
  changed on the sheet before booking, nothing after — a completed instance has no set editor today).
- **Anti-goals:** an entry landing on the wrong day silently (the chosen day is printed on the button's row and the
  app never stays parked on a past day); an invented duration on a backdated workout (no timing rather than a guess);
  a scored drink (a null score, never a snack-share score); a second „Mikor" widget (the composer's `MealTimeRow` is
  the one, lifted into the kit); `async let` fans; SF Symbols in kit chrome; „Mezo" or emoji in copy.

## 3. What the owner sees

### 3.1 The „Mikor" row (kit: `NKWhenRow`)

- Eyebrow + resolved value on one line, chips below: **Ma · Tegnap · Más nap** (day-only form) or
  **Most · Tegnap · Más időpont** (day+time form). Chips are the composer's: on = white 92 % capsule with dark text,
  off = white 8 %. „Más nap/időpont" toggles the compact `DatePicker` (hu_HU, dark, tinted with the room's glow),
  bounded `earliest…now`.
- The resolved value: „ma", „tegnap", „nov. 22. · szombat" (day form); „most", „tegnap · 21:40",
  „nov. 22. · 08:15" (time form). A „Tegnap" tap in the time form = yesterday at the current time, with the picker
  opened so the time can be moved in one more tap.
- **Window: today and the previous six days** („Egy hétre visszamenőleg tudsz rögzíteni." under the picker when
  the owner reaches the edge). This is the composer's existing cap and sits inside every server window (meal,
  check-in, close: 7 days; weight/sleep/sport/journal: none; the outbox's own age rule: 7 days by date). Never the
  future.
- The row's eyebrow names the thing: MIKOR ETTED · MIKOR ITTAD · MELYIK NAP (súly, naplósor) · MELYIK REGGEL ÉBREDTÉL
  (alvás) · MIKOR SPORTOLTÁL.

### 3.2 The quick sheets (`.159`)

- **Súly:** MELYIK NAP, day form. Payload `date` = the chosen day. Copy fix: the server appends, it never overwrites —
  the hint says „Egy napra a legutóbb beírt mérés számít." (today the sheet promises an overwrite the server does not
  do). If the app mirrors weigh-ins to Apple Health, the sample's date is the chosen day.
- **Alvás:** MELYIK REGGEL ÉBREDTÉL, chips **Ma · Tegnap · Más nap**; `date` = that morning. Note under the row when a
  past day is chosen: „Ha az órád már mérte ezt az éjszakát, csak a minősítésed kerül mellé." (the server keeps the
  sensor's times, `SleepNightMerge`).
- **Sport:** MIKOR SPORTOLTÁL, time form; `date` + `time` from the chosen moment.
- **Napló (one line):** MELYIK NAP, day form; `occurredOn` = the chosen day. It joins that day's chain in the outbox
  (after the day's close if one is queued).
- Víz and Kiegészítők: unchanged.
- Every sheet's success toast names the day when it is not today: „Súly 81,4 kg rögzítve · tegnap".

### 3.3 The meal composer

- The existing MIKOR ETTED row gains a **Tegnap** chip between „2 órája" and „Más időpont" (= yesterday, same time,
  picker open). The row is replaced by the kit's `NKWhenRow` with the same behaviour (`setTime` clamp, the draft's day
  and window follow the time). Nothing else moves.

### 3.4 Napló: the last week is always there, and a past day carries its catch-ups (`.159`)

- **A NAPOK** lists **today and the previous six days always** — a day with nothing shows the date and one line:
  „Erről a napról még nincs semmi." Older days (up to the 14-day span) appear only with content, as today.
- A **day's sheet** gets a **PÓTLÁS** block above the day's content, shown only for the items that are missing and
  only inside the week window. On **today's** sheet it offers only the moments already passed and not done (reggel
  after 10:00, dél after 14:30) — the most frequent case („a reggeli check-int elfelejtettem, 11 óra van"); today's
  close and today's workout stay with the Este flow and the player. On a **past day** all three:
  - **Check-in:** the three moments as a row — reggel ✓ · dél – · délután ✓ — and one button per missing moment:
    „Check-in pótlása: dél". A done moment is not re-offered here (the day's own re-do stays in the moment's flow).
  - **Edzés:** „Edzés pótlása: Pull Day" when that weekday has a template day in the running block and no completed
    instance on that date (§3.6). Not shown on rest days, not shown when a live workout is open on the phone.
  - **Zárás:** „Lezárom a napot" when the day has no close; a closed day keeps its card with the existing „Módosítom"
    (re-close replaces).
- After any catch-up is saved the sheet closes; the Napló row updates from the ledger (pending glyph until sent). The
  app never stays on the past day.
- **A NAP SORAI** on the day's sheet: the day's journal lines (the ledger's pending ones and the server's,
  `listJournalEntries` for that day), so a line written for a past day is visible where it was put. (Today the Napló
  shows only the close-linked line; a backdated quick line would otherwise vanish on the phone.)
- No „utólag" tag in this slice (§9): the server keeps one instant per check-in and close, and a catch-up uses the
  moment's own time (§3.5), so there is nothing to derive it from without a server field.

### 3.5 Check-in catch-up and day-close catch-up (`.159`)

- **Check-in:** `CheckinFlow(env:date:moment:)` — for a catch-up the day and the moment are **fixed** (the „save
  re-decides from the clock" rule is today's flow only); **`capturedAt` = the moment's own time on that day** (the
  slot's configured time: reggel 06:30 · dél 10:00 · délután 14:00). The server keeps one instant per check-in
  (`savedAt`) and the phone draws the energy dot and reads the Health snapshot around it — a catch-up written at 21:40
  must not land at 21:40 on yesterday's curve with today's pulse and steps. `SnapshotBuilder.snapshot(at:)` reads
  Health around the given instant. Eyebrow „PÓTLÁS · TEGNAP · DÉL"; one line
  above the first question: „Ahogy akkor voltál." The question set is that day's and moment's (the server's plan is
  stable per date + slot; the ledger caches it). Saved like any check-in: ledger row for that day, outbox
  `checkIn` with `date` + `slotTime`; Boop's line after it comes from the server as today.
- **Day close:** `EsteFlow(env:brief:date:)` — for a catch-up `date` is the Napló's day; the day's goal comes from
  the ledger (fetched with `fetchDay` when the phone has none), Boop's plan goals from **that day's brief**
  (`getBoopBrief(date)`; a past date is judged as of 23:59). **`capturedAt` = that day at 21:00** (the merged 20:00
  check-in's instant and the close's `closedAt` follow it, so the evening energy dot sits in the evening). The journal
  line goes to that day. The phase rule („before 04:00 the evening is yesterday") applies only to the evening's own
  flow.

### 3.6 Gym catch-up — „Megvolt" with the plan's numbers (`.161`)

- The sheet (`WorkoutAsPlannedSheet`): eyebrow „EDZÉS PÓTLÁSA · TEGNAP", the template day's title, its exercises as
  rows with the prescribed sets — „3 × 8 · 60 kg" (the Progresszió prescription **as of today**, what
  `getTodayWorkout(templateSessionId:)` shows; a tap on the weight opens a number field, **one weight per exercise**;
  an exercise with no prescription yet shows „3 × 10 · – kg · írd be" and is **skipped** in the booking unless a
  weight is typed) — the MIKOR row (day fixed to the Napló's day, shown; time chips **a terv ideje · Más időpont**,
  default = the day's planned session time, else 18:00), one line: „A terv számaival könyvelem; a súlyt gyakorlatonként
  itt átírhatod, utána már nem." Button **Megvolt**.
- Offline-first: one outbox item `workoutAsPlanned` (order group `workout|<id>`), ledger-less (the Edzés store marks
  the template day done on the phone from the item, and again when the server answers). Toast „Edzés könyvelve ·
  tegnap".
- Server answers: 409 live workout open → „Előbb fejezd be a futó edzést."; 409 that template day already completed
  in that date's Mon–Sun week → the row says „Ezen a héten már megvolt." and the button does not come back; 400
  outside the window → „Egy hétre visszamenőleg tudsz pótolni." (the sheet prevents it).
- The booked instance: `completed`, dated the chosen day, `startedAt` = the chosen moment, sets = the prescribed
  ones (with the sheet's weight overrides) marked done, unprescribed exercises without a weight skipped, closing note
  empty, **no derived timing** (duration stays empty rather than invented). It shows in Előzmények and the week's
  volume like any completed workout; nothing re-judges a week review already written (§9).
- Entry points: the Napló's past-day sheet (primary, §3.4). Secondary, builder's call: a „Pótlom" link on a past,
  missed day row of this week in Edzés › Blokk › Napok, only if that list already knows the day's done state.

### 3.7 Drinks (`.160`)

- **Entrances:** „Ital" joins the meal chips on the „Mit rögzítesz?" sheet (Fotó · Szöveg · Vonalkód · Recept ·
  Kamra · **Ital**) and the Étel room's „+" menu. The home screen's five doors do not change.
- **The composer in drink mode** (`MealStart.Entrance.drink`): eyebrow ITAL, the room's glow; first **SZOKÁSOS
  ITALAID** as chips — the server's usual meals ranked for the `drink` bucket (name + kcal; Boop learns them from what
  was logged, keeps their lines, so the second time the exact amounts come back) — then the free text („gombakávé
  zabtejjel mézzel"), the photo door, **the same no-describing doors as a meal — Recept · Kamra · Vonalkód** (a shake
  recipe, the protein powder on the shelf, a bottled drink by its barcode log as a drink without typing; owner
  2026-11-24), the MIKOR ITTAD row, Boop's estimate as an editable draft exactly as for a meal, and **Mentem**.
  Whatever comes through any door is saved with `slot = "drink"`. A drink with zero calories (fekete kávé, tea) is a
  drink too.
- **Étel room · Ma:** under the day's windows a new **ITALOK** group: one row per drink — title · kcal · time, no score
  ring. The day's kcal, macros, remaining and the energy curve include drinks (the server already sums every meal of
  the day). „étkezés a tervből N / 5" counts meals only. The windows never claim a drink.
- **Étel room · Hét:** the day sheet lists drinks with an „ital" pill and no ring; the day's score mean skips them.
- **The Étel orb and the Hét per-day score:** unchanged formulas; a drink has no score, so it never enters the mean.
- **Water:** only water counts as water; a drink never moves the water counter.

## 4. Approaches considered

- **Backdating entry point.** A) a „Mikor" row on every capture sheet + the day's own catch-up buttons in the Napló
  (chosen); B) one „Pótlás" door that parks the app on a chosen day and routes every capture there. A keeps the common
  case („tegnap esti vacsora", „reggeli mérés délben") on the sheet the owner is already on, and keeps day-shaped
  actions on the day's page; B is one screen but carries MyFitnessPal's known trap (forgetting you are on yesterday).
- **Gym.** A) only the Sport door backdates, the gym catch-up later; B) a „Megvolt" booking with the plan's numbers and
  a server endpoint that accepts a date (chosen). A would leave the plan's day falsely empty. B as one server
  endpoint (not start + sets + finish from the phone) because the three-call chain is not idempotent midway and the
  server already owns the prescription.
- **Drinks.** 1) a slot value `drink` that no window claims and the scorer skips (chosen) — the cheapest seam that
  already exists (`MealSlots.of` unknown → no window, `FuelDayService` sums regardless of slot); 2) a separate
  `drink_log` table — a second write path, a second list, no usual-meal learning; 3) MacroFactor's slot-free timeline
  — would re-derive the meal points from clock windows and change every day card. Rejected: 2 and 3.

## 5. Prior art (researcher, 2026-11-24)

- **„When?" on the capture sheet, default now, picker on demand** — MacroFactor (calendar icon beside „Log Items",
  date-time picker, „Log to Date and Time"; backfilled days re-enter the model, first-class):
  https://help.macrofactorapp.com/en/articles/228-log-food-to-previous-days; Hevy's save screen (editable start
  date/time): https://www.hevyapp.com/features/workout-log/. Adopted for the five item captures.
- **Navigate to the day, then act** — Cronometer/MFP diary day header: https://forums.cronometer.com/discussion/comment/4399.
  Adopted for the day-shaped actions (check-in, close, gym day) via the Napló's day sheet; MFP's wrong-day trap
  avoided by never staying parked on a past day.
- **Today / Yesterday / Other day with the resolved date shown** — Daylio's „+", and the preset-shortcut guidance
  https://uxpatterns.dev/patterns/forms/date-picker. Adopted as the chip row.
- **Two timestamps and a „manually entered" mark** — Apple Health (`HKMetadataKeyWasUserEntered`, source ranking):
  https://support.apple.com/en-us/108779. Adopted as the quiet „utólag" tag where the server already keeps both
  moments; full score value (Daylio/MacroFactor: no penalty).
- **Drinks as a non-scored diary group that still counts in the totals** — Cronometer's diary groups (custom „Drinks"):
  https://cronometer.com/blog/how-to-use-diary-groups. Adopted as the `drink` bucket with a learned usual list;
  MacroFactor's slot-free timeline rejected (§4). Bearable's rigid midnight day as a cautionary note:
  https://bearable.app/support/common-questions/change-when-my-day-begins-and-ends/.

## 6. Codebase terrain (investigator, 2026-11-24)

- **Dates already on the wire.** Meal `capturedAt` (7 days back, +5 min; its offset's local day is the record's day,
  `CapturedAtWindow`); water `date`/`capturedAt`; weight `date` (no window, appends); sleep `date` (one live night per
  date, `SleepNightMerge` keeps sensor times); sport `date`+`time` (no window, no `clientRef`); journal `occurredOn`
  (no window, `clientRef`); check-in `saveCheckIn {date, slotTime, capturedAt}` (today−7…today+1, no slot-vs-time
  rule — a past slot is postable); day close `PUT /api/day-close/{date}` (today−7…today+1, idempotent, re-close
  replaces, no lock on the day). **Gym workouts:** `WorkoutService.startWorkout` sets `date = now`, `startedAt = now`;
  `finishWorkout` `finishedAt = now`; `WorkoutStartRequest` has no date; `completedThisWeek` uses `LocalDate.now()`.
- **Day aggregation keyed by the record's date,** not server now: `FuelDayService.getDay` sums every meal of the
  `meal_date` (slot-agnostic); `DayPlanService.assign` — a meal claims a window of its own `SlotKey`, `MealSlots.of`
  null → no window, still counted; `BoopScores.fuel` kcal-only; `AdherenceService` computed on read; the brief's
  cache hash includes the meal count (a backfilled day regenerates). Not recomputed: the nightly `DailySummary`.
- **Slot is load-bearing in six places:** `ck_meal_slot` DB CHECK (breakfast|lunch|dinner|snack); contract patterns
  `MealRequest.slot` (`meal.yml:426`), `MealAiDraftResponse.slot` (:479), usuals query enum + `UsualMeal.slot`
  (`fuel-plan.yml:38,69`), `PlanWindow.slot` (:124); `SlotShares.of` default → snack share; `MealScoringService` NPEs
  on a null slot; `UsualMealRanker` drops meals whose `MealSlots.of` is null; `BoopDayAssembler.meals` lists every
  logged meal for Boop's rules; iOS `etelSlotLabel`, `etelDayPoints` (mean of scored meals, nil-skipping),
  `FoodClient.slot(at:)` (clock → slot).
- **The „when" control exists:** `Composer.swift:1050` `MealTimeRow` (chips + compact hu_HU `DatePicker`, bounded
  `earliestTime…now`, `setTime` clamp, the draft's day and slot follow). Other pickers: Pénz practice sheets
  („Mikor", „Melyik napé"). „tegnap" wording: `NaploDate.label`, `LevelModel`.
- **Write path:** ledger first → `Outbox` (item = `clientRef`, `date`, `capturedAt`, order groups `chain|<date>`,
  `weight|id`, `sleep|id`, `sport|id`, `workout|groupRef`) → `RitmusClient.send` / `TrainClient`; age rule 7 days by
  `item.date`. Phone day = `Calendar.current`; server day = owner zone (Europe/Budapest) or JVM zone defaults.
- **Flows:** `CheckinFlow.init(env:)` fixes `date`/`moment` from the clock at open and re-decides at save;
  `EsteFlow.init(env:brief:)` with `eveningDay` (before 04:00 → yesterday), `use(brief)` for the plan goals;
  `NaploView` lists `NaploDays.rows` (a day with neither close nor check-ins is absent), `NaploDayDetail(env:date:)`
  with the close card and photo meals; `-previewOpen naploDay` opens yesterday.
- **Kit:** `NKSheetFrame(hue:eyebrow:title:closable:)`, `NKMono`, `nkGlass`, `NKScale`, `NKInlineStepper`,
  `QuickFoot`; drawn glyphs only (`NKGlyph.outlined`).
- **Traps:** `.refreshable` leaks into sheets; offline is an answer (water is the one quick door that is not
  offline-first — left as is); two „today"s (phone calendar vs owner zone); weight appends (the sheet's copy is wrong);
  sleep merge keeps sensor times; ArchUnit (controllers implement generated `*Api`, feature slices cycle-free, no raw
  `RuntimeException`); Liquibase changesets under `db/changelog/1.1.0/` + `ResetDatabase`; contract-first (`api/` →
  generate → generator filter → `sync-openapi.sh` → `check-ios-contract.mjs`).

## 7. Server changes

- **Meal slot `drink`** (`.160`): Liquibase changeset widening `ck_meal_slot` to include `drink`; `SlotKey.DRINK`
  (wire `drink`; never a recipe category — the recipe contract enum stays four); `MealSlots.of("drink")` → `DRINK`;
  `DayPlanService.assign` — `DRINK` claims no window; `UsualMealRanker` ranks `DRINK` as its own bucket (query
  `slot=drink`); `MealService` — no `applyScore` for `DRINK` (`score` and `breakdown` null, no window, no coach
  note); `BoopDayAssembler.meals` skips `DRINK` (Boop's „next unlogged meal" and „last meal" rules see meals only);
  contract: `MealRequest.slot` pattern, usuals query enum and `UsualMeal.slot` enum gain `drink` (`MealAiDraftResponse`
  unchanged — the phone sets the slot). `FuelDayService` sums as today (drinks count). ITs: a drink is saved unscored,
  counted in the day, claimed by no window, ranked among usuals.
- **`POST /api/train/workouts/as-planned`** (`.161`, operation `completeWorkoutAsPlanned`): body
  `{templateSessionId, date, startedAt, clientRef, overrides: [{exerciseId, weightKg}]}`; `date` in today−7…today
  (owner zone) else 400; `startedAt` ≤ now
  + 5 min else 400; idempotent on `clientRef` (a retry returns the same instance); 409 `TRAIN_WORKOUT_OPEN_ELSEWHERE`
  when a live workout is open, 409 `TRAIN_DAY_DONE_THIS_WEEK` judged in the **given date's** Mon–Sun week. Creates the
  instance from the template exactly as `startWorkout` does but dated `date`, logs the prescribed working sets as done
  (`doneAt = startedAt`; the prescription as of today, an override's weight where given; an exercise with neither a
  prescription nor an override gets the skip marker, never a zero weight), marks it `completed` with `finishedAt = startedAt` and **no derived timing**, publishes the
  same events a finish does. Response: the instance. ITs: window, idempotency, both 409s, the week judged by the date.
- **No change:** check-in, day close, journal, weight, sleep, sport, water, supplements.

## 8. Phone changes (map)

- Kit: `NKWhenRow` (`BoopDesign/Napkelte/When.swift`) + tests of its pure parts (`whenLabel`, clamp) in BoopCore.
- `Capture/QuickSheets.swift`: Súly, Alvás, Sport, Napló sheets take the row; payload dates from it; copy.
- `Etel/Composer.swift`: `MealTimeRow` → `NKWhenRow` with the Tegnap chip; drink mode (entrance, eyebrow, usual
  drinks, MIKOR ITTAD, slot `drink`); `Capture/CaptureSheet.swift` + `Etel/EtelRoom.swift`: the Ital entrance.
- `Etel/EtelLogic.swift` + `EtelHet.swift`: `etelWindowItems` keeps drinks out of the windows and returns them as the
  ITALOK group; „étkezés a tervből" counts meals only; the Hét day sheet's pill.
- `Naplo/NaploView.swift` + `BoopCore/Ritmus/NaploDays.swift`: the week always listed; `NaploDayDetail` PÓTLÁS block;
  the „utólag" tag.
- `Ritmus/CheckinFlow.swift` (`date:moment:` init), `Ritmus/EsteFlow.swift` (`date:`), `RitmusEnvironment` (that day's
  brief and intention), `RitmusRouter` covers carry an optional date.
- `Edzes/WorkoutAsPlanned.swift` (sheet + model), `BoopCore/Train/TrainClient.swift` (`completeWorkoutAsPlanned`),
  `BoopCore/Ritmus/Outbox.swift` (`workoutAsPlanned` kind + group), `RitmusPayloads.swift`, `EdzesStore` (done
  marks). The generator filter gains the operation; `sync-openapi.sh` refreshes the phone's contract copy (`.149`).

## 9. Later (not in this slice)

- Caffeine from drinks feeding the „Utolsó koffein" rule; a drink category on recipes and shelf items (filters);
  editing a saved entry's day from the Hét
  or Napló lists; the nightly DailySummary re-run and a written week review re-judged after a backfill; water and
  supplements with a „Mikor" row; the „utólag" tag (needs a second instant on check-in and close); set edits on a
  completed workout (an Előzmények editor).

## 10. Kész, ha…

- **Owner sees:** each sheet with the row at its default and at „tegnap"; the composer's Tegnap chip; the Napló with
  an empty week day; a past day's sheet with the three catch-ups and with none, today's sheet with a missed morning, the day's
  journal lines; the check-in
  catch-up's eyebrow and line; the close catch-up for a past day with its own goal; the Megvolt sheet with
  prescribed sets, with an edited weight, with „írd be" rows, with the 409 lines; the Ital composer with usual drinks, empty usual list, a recipe and a shelf item logged as a drink, and the
  draft; Étel Ma with the ITALOK group and without; the Hét day sheet with a drink. Offline: every catch-up and drink
  lands on the phone and shows pending; error: the quiet Újra row. iPhone 16e width. Reduced motion: end states.
- **Parity:** every existing control and field on the touched sheets, the composer, the Napló day sheet, Étel Ma/Hét
  and the Edzés room stays; water and supplements untouched; the five home doors untouched.
- **Gates:** backend focused ITs (meal drink, as-planned, ArchitectureTest with `-Dmezo.test.use-testcontainers=true`);
  BoopCore native tests; the app builds for the simulator; `xcodebuild test` for BoopKit and Boop on the Xcode-ready
  Mac (`.150`); `node scripts/check-ios-contract.mjs`; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs`
  0/0.
- **Docs:** `docs/features/boop-ios.md`, `fuel.md`, `train.md`, `me.md`, `journal.md`, `dayclose.md` (date bump);
  handbook: `01-alapok/gyors-rogzites.md`, `03-naplo/{napok-lista,check-in,esti-zaras}.md`, `06-etel/11-italok.md` +
  `02-etkezes-rogzitese.md`, `07-edzes/<pótlás>.md`; `_jegyek.json`, `_dontesek.json` (#103–#105), `_kiadasok.json`,
  `_funkciok.json`; `14-decisions.md`; the handover doc's fourth bundle; `ios/README.md` preview flags.
- **Shipped:** merged to main; `deploy` green and the version live; the phone installed and walked through (`.150`).

## 11. Left to the builder

- The exact `NKWhenRow` API (binding vs model), the picker's placement, and how the sheets read the day for the
  toast.
- Whether the Blokk › Napok secondary „Pótlom" link ships (§3.6) — only if the list already knows done states.
- The as-planned endpoint's internals (reuse of `startWorkout`'s instance builder and the prescription lookup) within
  ArchUnit; whether `finishedAt = startedAt` or null is the cleaner „no timing" (the UI must show no duration).
- The usual-drink chips' count and the empty state's line („Az első italodat írd be — Boop megjegyzi.").
- The journal read for A NAP SORAI (`listJournalEntries` by day, or the day range once per sheet).
