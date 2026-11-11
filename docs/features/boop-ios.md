---
title: Boop — native iOS app
type: feature-domain
status: in-progress
updated: 2026-11-11
tags: [ios, b1-adatalap, health-samples, apns, swiftui, boop, napkelte, lagy, auth, onboarding, healthkit, eventkit, wearable, morning-brief, energy-curve, voice]
key_files:
  - ios/Boop
  - ios/BoopKit/Sources/BoopCore
  - ios/Boop/Nap
  - backend/src/main/java/io/mrkuhne/mezo/feature/wearable
  - api/feature/wearable/wearable.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/boop
  - api/feature/boop/boop.yml
  - ios/BoopKit/Sources/BoopCore/Morning
  - api/feature/device/device.yml
related: [proactive, _platform-auth-security, _platform-api-backend, me, today]
---

# Boop — native iOS app — Feature Documentation

> **Re-planned 2026-11-11 (`mezo-r36n9.9`):** S4 is cancelled; Boop continues as a standalone app in slices
> **B0–B8** (repair → data foundation → new spine Ma · Terv · Napló · Boop → daily loop → food → training + Watch →
> the Plan → day capacity → one AI) — spec [`2026-11-11-boop-standalone-design.md`](../superpowers/specs/2026-11-11-boop-standalone-design.md),
> research [`boop-standalone/`](../superpowers/research/boop-standalone/13-synthesis.md). **B2 Gerinc (the new shell) shipped 2026-11-11** (`mezo-r36n9.12`, §2 "The spine"); the older S1–S3 shell text below is superseded where it names the five-domain bar.

> One-line: the native SwiftUI iPhone app that replaces the web app once complete (epic `mezo-r36n9`).
> Design canon **Napkelte** since S2.5 (dark glass, painted sky, the orb rising as the sun — spec
> [`2026-11-10-boop-napkelte-design.md`](../superpowers/specs/2026-11-10-boop-napkelte-design.md); Lágy before), companion named **Boop**, same backend with a new account. Slice **S1** (the frame)
> is shipped: project, Lágy kit, sign-in / register with invite, onboarding (profile + first weight),
> the five-domain shell, a one-command weekly install. Slice **S2** (data) adds Apple Health (60-day
> backfill, then refresh on every open) and today's + tomorrow's calendar into new `wearable` endpoints;
> plan [`2026-11-09-boop-s2-adatok.md`](../superpowers/plans/2026-11-09-boop-s2-adatok.md). Spec:
> [`2026-11-09-boop-ios-v1-design.md`](../superpowers/specs/2026-11-09-boop-ios-v1-design.md) · plan:
> [`2026-11-09-boop-ios-v1.md`](../superpowers/plans/2026-11-09-boop-ios-v1.md) · approved look:
> [`boop-ios-spike`](../design_2.0/prototypes/boop-ios-spike/README.md) (`Aura*.swift`). Slice **S2.5** (the look) moved
> every shipped screen onto the Napkelte kit; plan [`2026-11-10-boop-napkelte-kit.md`](../superpowers/plans/2026-11-10-boop-napkelte-kit.md).
> Slice **S3** (reggel, shipped 2026-11-10) adds the real **Nap · Mai**: a new backend `boop` feature (the morning brief: five scores,
> an energy curve, Hungarian verdicts, today's day data) and the SwiftUI morning built on it; plan
> [`2026-11-10-boop-s3-reggel.md`](../superpowers/plans/2026-11-10-boop-s3-reggel.md).

## 1. Summary

Boop is built in four slices (spec §, plan "Slice map"): **S1 Alap**, **S2 Adatok** (Apple Health +
calendar ingestion), **S2.5 Napkelte** (the look) and **S3 Reggel** (the morning brief: five orbs, Boop's voice,
energy curve, paths) are this doc's base state; **B2 Gerinc** (2026-11-11) then replaced the five-domain shell with the
spine Ma · Terv · Napló · Boop + "+" (S4 is cancelled; B3–B8 follow). The web PWA keeps running until Boop covers it.

## 2. User-facing behavior

- **The look (S2.5, Napkelte):** near-black ground that keeps the page's hue all the way down, a painted landscape
  backdrop per page, white type on glass cards, colour only in the sky and the orbs. Bottom bar = five icons, no
  labels. Sign-in/register, offline, onboarding (profile, first weight, "Szia, Boop vagyok"), Health + calendar
  connect and backfill, the four web-only tabs and Nap · Mai all use it. **Nap · Mai** without a brief still shows
  one state: not connected ("Összekötöm" opens the connect flow), syncing, learning (< 14 nights:
  a still "még tanulom" orb with "9 / 14 éjszaka", no score), no calendar, offline, ready. With a brief loaded the
  real Mai (below) stays through syncing / failed / offline / no-calendar (no flip back on every foreground sync).
  Bell / "+" / avatar, Beszélgetés and Rutin answer "hamarosan" until S4.

- **Nap · Mai (S3, `MaiView`)** — Boop's morning, built from the server's brief:
  - **Hero:** title row, tabs (a dot on "A napom" 05–12 h), a row of **five mini orbs** — Forma (the old "készenlét"),
    Alvás, Mozgás, Fuel, Pulzus — and one big rising orb for the selected one (score or `display`: "7ó 12p", "3 240",
    Pulzus shows bpm), name in caps, serif headline, one–two sentences in Boop's voice. A missing or learning
    score reads "–" with "még tanulom", never 0. Tapping a mini orb re-colours the whole page (sky, ground, lights);
    the selected orb is the **lens**: the white pill under the text morphs to that orb's action (Forma: check-in,
    Alvás: bedtime reminder, Mozgás: today's workout / run / walk menu, Fuel: photo + quick chips, Pulzus: one-minute
    breathing with haptics) and a small voice circle. S4 actions toast "<név> · hamarosan". When Forma's current
    check-in is already done the pill is "Boop elmondja".
  - **Boop voice:** `Boop elmondja` reads the brief aloud in Hungarian (best hu-HU voice, plays with the silent
    switch on and ducks other audio) and types it word by word; the voice circle (long press) mutes, un-mutes and
    replays ("Mondd újra"); reduced motion = the text appears at once and the orbs stay still, but Boop still speaks
    (unless muted) — reduced motion is about movement, not sound.
  - **Below the hero, per orb:** tiles (Forma, Alvás: mély, elalvás; Mozgás: steps, active kcal vs 500; Fuel: kcal,
    macros, víz "–"; Pulzus: resting HR, today min·átl·max), a short **path** of stations ("most" first, then what
    belongs to that orb: check-ins, szándék, hypnogram + bedtime, dip walk + session strip, meals, breath before the
    densest meeting block, the meeting ribbon) and, on Forma, the **Boop mondja** card whose coloured phrases open the
    sleep / pulse / day sheets. Tiles without data are dropped, not shown as 0 (no wearable day → no Mozgás tiles; a night
    logged without bedtime/wakeup keeps its length tile, the times show "–", and the path skips its night stations).
  - **Boop észrevette:** up to three observation cards (the companion's proposed patterns); swipe right = Igaz
    (`decidePattern` confirm), left = Nem rólam szól (reject), with a thank-you toast after the last.
  - **Move today's session:** the session strip shows a conflict hint when the last meeting ends too close to the
    start; "Áttolom 18:30-ra" moves the session, the conflict card disappears, a toast + an inline "Vissza 17:30-ra"
    pill undo it (`PUT`/`DELETE session-time`). Nothing in the training plan itself changes.
  - **Sheets** (medium + large): Az éjszakád (tiles, hypnogram with legend, deep sleep ×7), A pulzusod (weekly resting
    HR bars, today min·átl·max; no per-night line, no HRV), A napod (energy curve with a press-and-drag **magnifier**:
    time · energy % · what is on, soft haptic per hour, busy ribbon with the training slot, hour anchors, the
    conflict card with Áttolom / Marad így).
  - **A napom** tab: the strict chronological full day as one path; meetings are a single "Megbeszélések · n esemény"
    station.
  - **Evening** (local hour ≥ 18): the whole Nap page takes the dusk (Pulzus) sky, Forma's pill is "Esti check-in"
    (hamarosan), Alvás's is "Esti levezetés", evening breath and fuel stations replace the morning ones.
    **Kímélő mód** (the brief's `recovery`): a calm grey-blue sky, a banner "Kímélő mód · N. nap · ok" with "Kilépek"
    (hamarosan), no session, walk / water / early-bed stations. Kímélő wins over evening; one sky per mode for the
    whole page (orb taps then re-colour only orbs and lights).
  - **Bedtime reminder:** the Alvás pill (and the bedtime card's "Emlékeztess") asks notification permission on the
    first tap, then a nightly local notification at **bedtime target − 30 min** ("Emlékeztetlek HH:mm-kor"); tap
    again to cancel; a changed target moves it; denied permission stays off with a gentle line pointing at Beállítások.
  - **Place switch (since B2: Ma · Terv · Napló · Boop):** the places share **one painted landscape** (`NKBackdropPanorama`, three
    screens wide, no seams): switching pans left/right by bar order with the sky cross-fading (0.95 s), a sliding
    nav pill and a sequenced content fade (owner OK 2026-11-10).

- **The spine (B2 Gerinc, 2026-11-11, `mezo-r36n9.12`):** one home, four places. `ShellView` hosts a glass bar
  (`NKSpineBar`) **Ma · Terv · Napló · Boop** with icons only (names are accessibility labels; Boop's icon is a small
  `StillOrb`) and the **"+"** as its own glass circle beside it. The shipped backdrop motion is kept: switching places slides the
  painted landscape (`NKBackdropPanorama`) toward the tapped place while the two skies blend (reduced motion = cross-fade),
  and a mini-orb tap still cross-fades the page sky. While a room is open the bar slides away.
  - **Ma** (`Nap/NapView` → `MaiView`) is **one scroll**: the S3 hero (orb, verdict, five mini orbs, lens strip) plus a
    **phase strip** Reggel · Napközben · Este that scrolls to its section; the Reggel plan card collapses once accepted (Napközben stays open). The phase follows the clock
    (`BoopCore/Morning/DayPhase`): Reggel 04:00–10:00, Napközben 10:00–18:00, Este 18:00–04:00 (wakes at 04:00, 10:00, 18:00).
    - **Reggel:** the plan card (`DayPlan`: the day's rows from the brief) with **"Elfogadom a napot"**, stored per day, and **Boop mondja**
      (tappable phrases, the meetings phrase opens the detail sheet).
    - **Napközben:** the whole day as one quiet path in clock order; proposals hang inline at **MOST** (never a pinned queue).
    - **Este:** the close-out frame; **"Lezárom" still answers "hamarosan"** until B3 (evening close).
  - **Proposals** (`BoopCore/Morning/Proposals`, `Boop/Nap/ProposalDesk`, kit `NKProposalCard`): B2's one live source is the brief's
    meeting conflict, which becomes a **move-session** proposal. **Elfogadom** = `moveSession` with an undo toast (the "Vissza ..." button lives on
    the Mozgás room's session card; the settled proposal row just says "Elfogadtad"); **Most nem** hides it for that day only (dismissed keys under `dismissedProposals` in UserDefaults); **miért?** opens a
    page-level sheet with the facts plus only the expert lines the brief carries — Közérzet / Szkeptikus lines arrive with B8. Cap **3 per day**.
    Nothing changes without the tap. Ma and the rooms share one desk, so accepting in a room shows on Ma.
  - **Rooms** (`Nap/MaDrill`, kit `NKDrillPage`): a tap on an orb (lens strip row, the big orb, a timeline station) pushes the orb's room
    (Forma, Alvás, Mozgás, Fuel, Pulzus) in a `NavigationStack` inside Ma. Four sections: **1 A szint** (number, caption, Alvás hypnogram,
    the orb's tiles, detail-sheet row), **2** the week (deep-sleep / resting-HR bars, Forma's energy line, else an honest "hamarosan" line),
    **3 A napok mögötte** (the days behind the week, today on top), **4 Mit tehetsz** (the orb's proposal plus the S3 orb path cards re-homed). A kept conflict ("Marad így") hides the proposal too, for the rest of the day.
    `NKDrillPage` takes an optional inner tab row (unused in B2; B4 Étel / B5 Edzés will use it). Swipe-back via `Nap/RoomSwipeBack.swift`, scoped to the room: it stands in as the pop gesture's delegate only while a room is on screen and restores the original on exit.
  - **"+" capture sheet** (`Capture/CaptureSheet`): the frame only — every item (étel, edzés, súly, ...) says "hamarosan" until B3/B4.
  - **Account sheet** (`Shell/AccountSheet`, opened from the avatar on Ma's title row, accessibility label "Fiók"): the account card with the confirmed sign-out
    (the old Én account section, `EnAccountSection`).
  - **Placeholders:** Terv, Napló and Boop (`Terv/TervView`, `Naplo/NaploView`, `BoopChat/BoopTabView`) are honest frames with their own sky until B6 / B3 / B3+B8.
  - **Presentations stay at page level** (§9): the detail sheet and miért? hang outside the room stack, so they reach Ma and every room.
  - **DEBUG flags:** `-previewTab`, `-previewOpen`, `-previewSwitch`, `-previewPhase`, `-previewDrill`, `-previewWhy` — see `ios/README.md`.
  - **Known gaps:** between 00:00 and 04:00 Este still shows on the *day* sky (`isEvening` is hour ≥ 18); the Alvás room shows the hypnogram
    twice (section 1 and the night card) pending an owner look decision.

- **Sign-in** (`SignInView`): e-mail + password; Hungarian problems under each field, cleared on edit;
  server errors in a peach card (wrong password, offline after 20 s, server error). "Van meghívókódom"
  → **Register** (`RegisterView`): invite code, name, e-mail, password (8–72); used invite and taken
  e-mail show under their own field.
- **Onboarding** (`OnboardingFlow`): Pár adat rólad (sex, height ruler, birth date wheel) → Mennyi ma?
  (weight ruler, 0,1 kg) → "Szia, Boop vagyok" → shell. Resumes at the right step after an interruption.
- **Shell** (`ShellView`): superseded by B2 — see **The spine (B2 Gerinc)** above.
- **Connect Health + calendar** (`ConnectFlow`, S2): after the first weigh-in, and from Nap's
  "Kössük össze az Egészséget és a naptárat" row. *Kössük össze* lists Apple Egészség and Naptár, hints to
  pick the full data range on the iPhone's Health sheet (iOS 26 offers "last 30 days" vs "all"), then asks
  Health (read: sleep, steps, active energy, heart rate, resting HR, workouts) and calendar (full access,
  read-only). *Behúzom az elmúlt 60 napot* fills Boop's orb with the progress and the live counts, then says
  "Megvan: *58 éjszaka*, 60 nap mozgás és 21 edzés." No Health data → a peach card with where to switch
  it on (Egészség app › Megosztás › Appok › Boop); calendar refused → a line with Beállítások › Boop ›
  Naptárak; the other source still syncs; "Most kihagyom" always leaves.
- **Nap card** once connected: "Beérkezett adatok" with the counts chip — everything synced so far
  (`HealthSync.totals`: distinct night dates / day dates / workout ids kept per user, so re-sent records
  count once; a phone synced before totals existed re-reads the 60 days once, `mezo-r36n9.5`) — and one status chip
  (frissítem… · nem sikerült frissíteni · naptár: nincs engedély · frissítve HH:mm); tapping refreshes.
- **Refresh on open**: every return to the foreground re-syncs (10-minute debounce); a calendar change
  re-sends today + tomorrow. **B1:** the code also wakes on new Health data in the background (`HKObserverQuery` +
  background delivery) — present but **unverified on a device** (the free team accepts the entitlement; verification is the paid-team follow-up `mezo-r36n9.19`).

## 3. Architecture & data flow

- **B1 · Adatalap (shipped 2026-11-11 on the FREE Apple team, `mezo-r36n9.11`; plan [`2026-11-11-boop-b1-adatalap.md`](../superpowers/plans/2026-11-11-boop-b1-adatalap.md))** — the data foundation:
  - **Hybrid storage.** `daily_metric` is widened for day rollups (distance, basal kcal, exercise min, HRV, respiratory rate, SpO2, wrist temperature, VO2max, walking HR, mindful min, daylight min) and the new per-sample table `health_sample` holds discrete samples (metric code, start/end, value, unit, source name/bundle, device, user-entered). **Heart rate is stored as 5-minute buckets** (avg/min/max in one row, key `hr-<bucket start epoch>`; HR backfill 14 days, everything else 60).
  - **23 HealthKit read types** (`HealthKitReader`), read with **anchored queries** (`HealthReader` + `HealthChange`); an anchor is saved only **after the server acknowledged** the batch, so an interrupted run re-sends and never loses. Cumulative day rollups use HealthKit statistics (Apple de-duplicates by the user's source order).
  - **Background delivery** (`HealthBackground`, `BoopAppDelegate`, `BackgroundSyncHost`): one `HKObserverQuery` + `enableBackgroundDelivery` per observed type from `didFinishLaunching`; each wake runs one coalesced incremental sync and always calls the completion handler. Code is in and the free team accepts the entitlement, but **delivery is unverified on a device** (→ `mezo-r36n9.19`).
  - **Nights.** Source priority per night: Apple Watch → ring apps (Oura/Ultrahuman/RingConn) → Sleep Cycle → any other app → (tie-break) the session with the most staged minutes. The phone computes **sleeping HR** over the winning session's asleep intervals and sends `sourceApp`. **One live night per date** (`uq_sleep_log_owner_date_live`, partial unique): the Health writer and the web/manual writer both go through `SleepNightMerge` — sensor fields (times, duration, stages, hypnogram, in-bed, sleeping HR, source app) come from Health, subjective ones (quality, awakenings, notes) are kept from the manual row; an insert race retries the merge once. A night the user **deleted stays deleted** (a re-send does not revive it). When the phone sends `windowFrom/windowTo`, Health nights inside the window that are missing from the payload are soft-deleted (this is how a deleted Health sleep propagates).
  - **Deletions.** Deleted workout/sample uuids from the anchored queries go to `POST /api/wearable/deletions` (soft delete, `WearableDeletionService`).
  - **Weight from Health.** `bodyMass` upserts into `weight_log` (`source` manual|apple_health, `external_id`) through a dedicated path — **one** goal recompute and **one** companion event per batch, only for a new weigh-in from today/yesterday (a 60-day backfill never floods).
  - **Workout reconciliation** (read-time, `WorkoutReconciler` in `wearable`; logged sessions via `LoggedSessionReadPort`, implemented in `train`): a Health workout matching a logged gym session or sport session (overlap ≥ 50 % of the shorter one) is counted once. `BoopDayAssembler`'s *yesterday load* now counts logged gym/sport sessions (matched Health workouts dropped, lending kcal/min) so Forma reflects real training even without Health.
  - **Calendar history.** `calendar_event.external_id` (EventKit external id + occurrence), unique per `(created_by, external_id, date)`; for each sent day, live rows missing from the payload are soft-deleted (cancelled event); first sync backfills 60 past days; past days are not touched again.
  - **APNs registration.** `PushRegistrar` (BoopCore) registers the device token with `PUT /api/devices/apns` (`apns_device`, `notification` feature; a token registered by another account is moved). The environment is **hard-coded to sandbox**; the backend does **not send** pushes yet.
  - **Account merge.** `scripts/ops/boop-b1-merge-accounts.sql` (+ rollback, [README](../../scripts/ops/README-boop-b1-merge.md)) moves the Boop account's Health data into the original account; dry-run unless `-v apply`, rehearsed in `BoopB1MergeScriptIT`. **The production run needs the owner's OK and has not been done.**

- **S3 — the morning brief, end to end** (backend feature `boop`, `io.mrkuhne.mezo.feature.boop`, a leaf: nothing imports it back):
  1. The phone sends **its local date** (`GET /api/boop/brief?date=YYYY-MM-DD`); the server never calls `LocalDate.now()` for the day.
  2. `BoopDayAssembler.assemble(user, date)` — read-only (no `@Transactional`; never `WorkoutService.getToday`, which writes) —
     gathers last night + 60-night window, 7-day deep-sleep / resting-HR series, 14-day baselines, today's wearable day, planned
     session (override time else gym-schedule time), yesterday's wearable workout minutes, meals + targets, check-in plan and
     answers, intention, up to 3 proposed patterns (observations), calendar → 72 busy slots, sleep-goal bedtime, recovery, weight.
  3. `BoopScores.compute` → five scores + state; `EnergyCurveModel.hourly` → 19 values (06:00…24:00).
  4. `BoopVerdictWriter.write` — one cheap-tier LLM call (`LlmCallContext("boop_brief", "verdicts")`) turns the computed numbers into
     Hungarian headline + sentence per metric, the spoken brief (segments with links `sleep|heart|day`), tonight and next-meal tips.
     The model never scores and never decides the session conflict (rule-detected in `RuleVerdicts`). Any failure — no LLM bean, a
     thrown call, a call slower than `mezo.boop.llm-timeout` (8 s; run on `applicationTaskExecutor` with the llm-log context and
     actor re-bound inside the task), no JSON, a missing field — falls back **per field** to `RuleVerdicts`, same schema; the brief
     never fails on the LLM. The prompt carries the calendar as count, time spans and busy minutes only — **never event titles**.
  5. `BoopBriefService` caches one `boop_brief` row per user + local day: an **input hash** (`v2|`: night id + content, calendar
     events, meal and logged-meal count, weight, session title + time, recovery, the sorted pending observation ids, each check-in's
     slot + done flag, the intention creed + foci, and a **time-of-day bucket** of the owner zone — reggel < 12:00, délután 12–18,
     este ≥ 18, a past day always este) equal to the stored one returns the stored payload with no scoring and no LLM call. So a
     decided pattern, a check-in done on the web or a changed intention regenerates on the next GET, and time-dependent sentences
     ("a nap nagy része még előtted") refresh at most three times a day. Steps, HR and the exact clock are not hashed. A changed
     hash regenerates. iOS keeps an observation it judged out of the brief locally until a brief arrives without it, so a stale
     brief can never bring it back to be decided twice. `POST …/regenerate` always
     regenerates, at most 3 per day (`regen_count`, atomic capped UPDATE; the 4th is 409 `BOOP_REGENERATE_LIMIT_REACHED`, refused before the LLM).
     Generation runs outside any transaction; only `BoopBriefStore.upsert` is transactional. Two racing first requests both
     generate, the loser's INSERT hits `uq_boop_brief_user_date`, re-reads and returns the winner's brief (never a 500).
  6. A past date is judged as of 23:59 of that day; a date after today in the owner zone is a **400**.
  7. iOS: `MorningClient`/`MorningStore` (`BoopCore/Morning`) loads the brief, with a generation guard so an older load never
     overwrites a newer one; on a 400 for a future date (phone day ahead of the owner zone) it falls back to yesterday. Pure
     builders `PathBuilder.steps(for:…)` and `Lens.action(for:…)` (BoopCore, keyed by `MetricKey`) make stations and the pill;
     the app maps them to the kit's `PathStation` / `Hue` and `MaiView`/`MaiBelow` render. **Reload triggers:** every return to the
     foreground, a change of day, and right after a Health sync finishes (so the brief refreshes by itself after the morning sync).
     Move/undo of the session refetch the brief after success.

- `ios/Boop.xcodeproj` — app target `Boop` (bundle `io.mrkuhne.boop`, iOS 26) + `BoopTests`; screens
  under `ios/Boop/{Auth,Onboarding,Shell}`; `RootView` switches on `Session.State`
  (`loading · signedOut · offline · needsOnboarding · ready`).
- `ios/BoopKit` (local Swift package):
  - `BoopAPI` — client generated by swift-openapi-generator from `openapi.yaml`, a copy of
    `api/openapi.yml` made by `ios/scripts/sync-openapi.sh` (it rewrites the 3.1-style numeric
    `exclusiveMinimum` the generator rejects); operations filtered in `openapi-generator-config.yaml`.
  - `BoopCore` — `Session` (token + state), `KeychainTokenStore`, `makeClient`/`makeTransport`
    (Bearer middleware, ephemeral URLSession, 20 s request limit), `AuthError` + Hungarian texts,
    `OnboardingModel`, `localDay`; S2: `Health/` (`HealthReader` protocol + `HealthKitReader`,
    `buildNights` — sessions split at > 90 min gaps, 14–18 h wake = nap dropped, per wake day the
    session with most staged minutes wins, 5-min hypnogram letters D/R/L/A ≤ 200 — `mapDays`,
    `mapWorkout`, `HealthSync`) and `Calendar/` (`CalendarReader` + `CalendarKitReader`,
    `buildCalendarDays` → exactly today + tomorrow); S3: `Morning/` (`Brief`, `MorningClient` + `MorningStore`, `PathBuilder`, `Lens`, `BoopVoice`).
  - `HealthSync` (`@MainActor @Observable`): window = 60 days on first run, afterwards from the
    synced-through day − 2; sends nights (30/batch) → days (60) → workouts (100) → calendar; the
    synced-through mark (`boop.health.syncedThrough.<userId>`) moves only after a fully successful run, so
    an interrupted backfill re-reads the window (the server upserts are idempotent). 401 → sign-out.
    Sleep is read from 18 h before the window and nights waking before it are not re-sent (otherwise
    the window's first night would be overwritten by its after-midnight half). A run that read nothing
    does not move the mark (the 60-day backfill stays available once Health is switched on). The
    calendar is its own step: its failure sets `calendarFailed` and never undoes the Health upload;
    titles are sent as 1…200 UTF-16 units, blank → "(cím nélkül)".
  - `BoopDesign/Napkelte/` (S2.5) — the live kit: `Tokens` (`NK`, `Hue` ×5: sky, orb, glow), `Landscape`
    (`PaintedLandscape`, `MirroredLand`), `Orbs` (`orbPalette`, `riseFraction`, `OrbMotion`, `LivingOrb`, `StillOrb`,
    `RisingOrb`, `MiniOrbRow`), `Glass` (`nkGlass`, `NKPill`, `NKMono`, `Trend`, `NKGlyph`, `nkToast`, `NKBoopCard`,
    `NKField`, `NKSkyScreen`, `NKTag`, `NKRow`), `Frames` (`NKTitleRow`, `NKTabStrip`, `NKTabPage`, `NKFlowFrame`,
    `NKSheetFrame`, `FloatingLights`, `NKGround`), `Charts`, `Tiles`, `DayPath`.
  - S3 additions to the kit: `NKSky` (`.hue` or `.calm`), `NKBackdropPanorama` (the shared landscape and the domain-switch pan), `nkToast(_:action:onAction:)`,
    `WeekBars` with optional days, `RisingOrb(orbScale:)`.
  - `BoopDesign` (legacy) — what is left of the Lágy kit: tokens, Outfit + Manrope (bundled), glyph assets
    (generated by `ios/tools/genglyphs.mjs` from the Lágy prototype's `G()` table), photos, components,
    page frames (`LagyTabPage`, `LagyFlowFrame`), `BoopFigure` (the Metal orb).

## 4. Data model & API

**S2 — feature `wearable`** (contract tag `Wearable`, `api/feature/wearable/wearable.yml`):

| Operation | Endpoint | Stores |
|---|---|---|
| `ingestSleepNights` | `POST /api/wearable/sleep-nights` → `IngestResult{inserted,updated}` | `sleep_log` upsert by `(created_by, external_id)`, `source = 'apple_health'`, stages + hypnogram |
| `ingestDailyMetrics` | `POST /api/wearable/daily-metrics` | `daily_metric` upsert by `(created_by, date)` — steps, active kcal, resting/avg/min/max HR |
| `ingestWorkouts` | `POST /api/wearable/workouts` | `wearable_workout` upsert by `(created_by, external_id)`; date = local start day (Europe/Budapest) |
| `replaceCalendarDays` | `PUT /api/wearable/calendar-days` → 204 | `calendar_event`: each sent day's rows hard-deleted and replaced |

**B1 additions** (same tag, plus `Device`): `ingestHealthSamples` `POST /api/wearable/health-samples` (upsert into `health_sample` by `(created_by, external_id)`), `deleteHealthRecords` `POST /api/wearable/deletions` (soft delete workouts/samples/weights by external id), `SleepNightBatchRequest.windowFrom/windowTo` (window deletion above), widened `DailyMetricIn`/`WorkoutIn` (distance, max HR, source bundle) and `SleepNightIn` (`sourceApp`, `sleepingHr`), calendar days carry an `externalId` per event, `registerApnsDevice` `PUT /api/devices/apns` → 204 and `unregisterApnsDevice` `DELETE /api/devices/apns/{deviceId}` → 204 (contract `api/feature/device/device.yml`).

Caps (`mezo.wearable`): 100 nights, 120 days, 300 workouts, 3 calendar days × 150 events per request →
`WEARABLE_BATCH_TOO_LARGE`. Sleep: one `SleepLogSavedEvent` per batch at most — only for the newest night,
only when newly inserted and dated today or yesterday (a 60-night backfill never floods Boop's messages).
Wearable workouts are display + AI context only (no calorie-target effect). Changesets
`202611092300_mezo-r36n9.2_sleep_log_apple_health.sql`, `202611092310_mezo-r36n9.2_wearable_tables.sql`.

**S3 — feature `boop`** (contract tag `Boop`, `api/feature/boop/boop.yml`; the web app gets no new feed kind):

| Operation | Endpoint | Notes |
|---|---|---|
| `getBoopBrief` | `GET /api/boop/brief?date=YYYY-MM-DD` → `BoopBrief` | cached per user + local day in `boop_brief`; 400 on an impossible or future date |
| `regenerateBoopBrief` | `POST /api/boop/brief/regenerate?date=` → `BoopBrief` | 409 `BOOP_REGENERATE_LIMIT_REACHED` after 3 per day |
| `setSessionTime` | `PUT /api/boop/session-time` `{date, time HH:mm}` → `SessionTime{date,time,plannedTime}` | upsert into `workout_time_override`, last write wins; 404 `BOOP_NO_PLANNED_SESSION`; 400 on a bad time |
| `clearSessionTime` | `DELETE /api/boop/session-time?date=` → 204 | soft-deletes the override; the planned time is back |

iOS also uses the existing `decidePattern` for the observation swipes. `BoopBrief` carries `date`, `generatedAt`, `state`
(`good|okay|tired|learning`), `nightsKnown`, `metrics[5]` (`forma|alvas|mozgas|fuel|pulzus`: nullable `score`, `display`, `caption`,
`headline`, `sentence`, `trendUp`), `brief[]` (text + link), `energy{hourly[19], dipHour}`, `tonightTip`, `nextMealTip`, `conflict`,
and `day` (sleep + hypnogram stages 0 awake · 1 REM · 2 light · 3 deep, week series, `hrToday{min,avg,max}`, steps, session, meals,
check-ins, intention, observations, calendar `busySlots[72]` = 06:00–24:00 in 15-minute slots, weight, recovery). Nullable by design:
session minutes/time/plannedTime, sleep stage minutes, sleep `bedtime`/`wakeup` (a night may be logged without times) and `day.steps` /
`day.activeKcal` (null without a wearable day, never a fake 0).

**B1 tables** (changesets `202611111000…202611111130_mezo-r36n9.11_*.sql` in `1.1.0/script/`): `health_sample` (`created_by`, `external_id`, `metric`, start/end, value, unit, source name/bundle, device, user-entered; unique `(created_by, external_id)`, index `(created_by, metric, start_at)`); `daily_metric`, `wearable_workout` widened; `sleep_log` + `source_app`, `sleeping_hr`, `source` now `varchar(16)` (`manual|screenshot|apple_health`), generic dedup then `uq_sleep_log_owner_date_live`; `calendar_event` + `external_id`; `weight_log` + `source`, `external_id`; `apns_device` (device id, token, environment `sandbox|production`, bundle id, app version, last seen, invalidated at).

Tables (changeset `202611101300_mezo-r36n9.7_boop_brief.sql`, both soft-delete, partial unique indexes `where is_deleted = false`):

| Table | Columns | Unique |
|---|---|---|
| `boop_brief` | `created_by`, `date`, `payload jsonb` (the `BoopBrief` as JSON), `input_hash varchar(64)`, `regen_count int ≥ 0` (`ck_boop_brief_regen_count`), `generated_at` | `uq_boop_brief_user_date (created_by, date)` |
| `workout_time_override` | `created_by`, `date`, `time` | `uq_workout_time_override_user_date (created_by, date)` |

Tunables (`mezo.boop`, `BoopProperties`): `steps-goal` 9000, `regen-per-day` 3, `nights-needed` 14, `llm-timeout` 8s.

### Formulas (S3 — product calls; the code is the truth: `BoopScores`, `EnergyCurveModel`)

All scores are integers 0–100 (`clamp(round(x))`), computed from the assembled `BoopDay` and the owner-local "now".

- **alvás** = `round(100 × (0.7 × min(1, totalMin / targetMin) + 0.3 × clamp01((quality − 1) / 9)))`; with no quality, `min(1, totalMin / targetMin)` alone.
  Mirrors the sleep dimension of `DayEvaluationEngine` (private there, so duplicated). `null` without a night or with a non-positive target.
- **pulzus** = `clamp(round(70 + (baselineRestingHr − restingHr) × 6))`; `baselineRestingHr` = average resting HR of the 14 days before the date;
  display = today's bpm. `null` if either is missing.
- **mozgás** = `clamp(round(steps × 100 / stepsGoal))`; **steps null → mozgás null** (never a fake 0); non-positive goal → null.
- **fuel** = `clamp(round(kcalSoFar / (kcalTarget × share) × 100))` with `share = min(1, minutesSince07:00 / 840)` (linear 07:00 → 21:00). **null while
  `share < 0.05`** (before about 07:42, otherwise any breakfast reads 100 %), when `now` is not after 07:00, or the kcal target is not positive.
- **forma** = `round(0.45 × alvás + 0.35 × p + 0.20 × load)` with `load = 100 − min(60, yesterdayWorkoutMinutes / 2)` (unrounded) and `p` = pulzus,
  **neutral 70 when resting HR is missing** (a missing watch reading must not blank the hero); only the final forma is rounded.
  `null` when `nightsKnown < 14` (60-day window) or alvás is null.
- **state** (the **forma thresholds**): `≥ 70` good · `50–69` okay · `< 50` tired · forma null → learning (still orb, "még tanulom", no rise).
- **Energy curve** — 19 hourly points, index 0 = 06:00 … 18 = 24:00. Template by linear interpolation between anchors
  (06: 0.35, 10: 0.82, 11: 0.82, 14: 0.38, 15: 0.38, 17: 0.66, 18: 0.66, 24: 0.20), × `scale = 0.6 + 0.4 × forma / 100` (0.8 when forma is null).
  Then: first logged meal between 11:00 and 15:00 later than 13:30 → −0.05 at 14:00 and 15:00; a session at hour *h* → +0.06 at *h*, −0.08 at *h*+1 and *h*+2.
  A model, not a measurement. The mapper clamps each value to 0..1 (3 decimals); `dipHour` = the lowest point between 12:00 and 18:00 inclusive.
- **Session conflict** (rule only, `RuleVerdicts.conflict`): the latest-ending timed meeting that started before the session; if it ends less than 45 min
  before the session start (or is still running) → suggest meeting end + 60 min rounded up to :00/:30; past 24:00, all-day or overnight → no conflict.

S1 operations used: `login`, `register`, `me`, `completeOnboarding`,
`getBiometricProfile` (always 200; all-null fields = no profile), `upsertBiometricProfile`,
`listWeightLogs`, `logWeight` (201), `getWeightTrend`. JWT lasts 30 days, no refresh: a 401 signs out.

## 5. Integrations

Production API `https://46.225.112.172.sslip.io/api`. Plans (training, meals, calorie target, weight
goal) are set up in the web app with the Boop account (spec §8.1).

## 6. How to use it (consume)

Build/test commands and launch arguments: [`ios/README.md`](../../ios/README.md). Weekly install on the
owner's phone: `ios/scripts/install-on-phone.sh` (team id from `$BOOP_TEAM` or `~/.config/boop/team`;
exit 2 no team, 3 no phone, 4 build, 5 install). Until the paid Apple team is active (~2026-11-25) it signs with the **free
Personal Team** (weekly reinstall, `Boop.entitlements`: HealthKit + background-delivery, no push). When the paid team is active, `touch ~/.config/boop/paid`: the script then builds with
`CODE_SIGN_ENTITLEMENTS=Boop-Paid.entitlements` (adds `aps-environment`; the free team refuses the Push capability). Moving to the paid team is `mezo-r36n9.19` (label `paid-team`): subscribe, re-register the bundle id once, then verify background delivery, APNs and HealthKit deletions on the device.

## 7. How to extend it

New API call: add the operationId to the generator config, run `sync-openapi.sh`, wrap it in a
`BoopCore` model with a stub-transport test (`StubTransport` in `BoopCoreTests`). New screen: reuse
`LagyTabPage` / `LagyFlowFrame` and the kit; copy look and copy from the spike's `Lagy*.swift`.

## 8. Testing

- S2.5 kit tests: `NapkelteTokensTests`, `NapkelteRenderTests` (landscape per hue, glass, pills and tabs at
  accessibility sizes, frames, nav labels), `NapkelteOrbTests` (palette padding, rise clamp, learning state,
  reduced motion), `NapkelteChartTests`, `NapkeltePathTests`; core `NapEmptyStateTests`; app `ShellTests`,
  `AuthCopyTests`, `NapCopyTests`.

- `BoopKit-Package` (simulator): generated-client decoding, session states (no token, 401, offline,
  sign-in), error mapping + copy, onboarding order/resume/local day, design kit (fonts, glyph catalog,
  photos, tokens, `hu1`).
- `Boop` app tests: `AuthForm` rules, greeting by time of day, connect copy (`summaryLine`, `countsChip`).
- S2 kit tests: `HealthBuildersTests` (nights across midnight, naps, two sources, hypnogram, workouts, days),
  `CalendarSnapshotTests`, `HealthSyncTests` (60-day first window, 2-day overlap, batching + progress,
  interrupted backfill, idempotent re-send, calendar denied/granted, 401 stops).
- **B1:** backend `HealthSchemaIT`, `HealthSampleServiceIT`, `SleepLogDedupMigrationIT`, `SleepNightMergeTest`, `WorkoutReconcilerTest`, `ApnsDeviceContractIT`, `BoopB1MergeScriptIT`; BoopKit `HealthSyncTests` (anchors, deletions), `HealthBackgroundTests`, `PushRegistrarTests`, `HealthBuildersTests`.
- Backend: `WearableSleepServiceIT`, `WearableServiceIT`, `WearableContractIT` (+ existing sleep ITs).
- **S3 backend** (`-Dmezo.test.use-testcontainers=true`, brief ITs need `@ActiveProfiles("companion-fake")`):
  `BoopRepositoriesIT`, `BoopDayAssemblerIT` (owner scoping, 00:30 local picks the new day under a UTC server), `BoopScoresTest` + `EnergyCurveModelTest`
  (plain unit, value-pinning), `BoopVerdictWriterIT` (valid JSON used, junk falls back, learning headline), `BoopBriefServiceIT`, `BoopBriefConcurrencyIT`,
  `BoopContractIT`, `SessionTimeIT`, plus `ArchitectureTest`. Run e.g.
  `./mvnw test -Dtest='Boop*,SessionTimeIT,EnergyCurveModelTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true`; the full suite
  (7314 green before the last fix rounds) with `./mvnw clean test -Dmezo.test.use-testcontainers=true`.
- **S3 BoopKit** (`BoopKit-Package`): `MorningClientTests` (local date on the wire, gregorian dates on any device calendar, 409 → limit, move/undo,
  unauthorized sign-out, future-date fallback, load guard), `PathBuilderTests` (ordered id/title/time sequences per orb, after-midnight, 24:00),
  `PathFixtures`, `LensTests`, `BoopVoiceTests`; kit `NapkelteChartTests` (week bars with missing days).
- **S3 app** (`Boop` scheme): `MaiCopyTests`, `MaiBelowTests` (tile mapper, swipe mapping, -ra/-re suffix), `SheetsTests` (routing, magnifier index, weeks),
  `MaiModeTests` (evening, kímélő, sky choice, reminder target), `BedtimeReminderTests` (trigger = target − 30 min, crosses midnight).
  Last recorded counts: app 73, BoopKit 106 + 48. Commands: [`ios/README.md`](../../ios/README.md).
- Not in CI (`ci.yml` does not build `ios/`); run locally.

## 9. Decisions, gotchas & deferred

- **Napkelte traps (S2.5):** the orb shader needs exactly four colours (`orbPalette` pads — three crashed it);
  a `LivingOrb` inside a tap target swallows the tap (`allowsHitTesting(false)` on the orb, tap on the column);
  four Lágy glyphs (check, clock, camera, book) blob when tinted white, so `NKGlyph` draws them as outlines;
  the simulator's network is blocked by the Mac's firewall, so DEBUG `-previewStep profile|weight|hello|connect`
  shows onboarding steps without the server.

- Free Personal Team: 7-day profiles, ≤ 3 sideloaded apps, ≤ 10 App IDs per week — never rename the
  bundle id; the team id is never committed.
- The Debug configuration must carry `SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG` (hand-written
  project); the `-preview onboarding|shell` launch switch is DEBUG-only.
- On the owner's Mac the **LuLu** firewall blocks network calls from the ad-hoc-signed simulator app
  (Safari in the simulator and host processes are fine); allow "Boop" in LuLu to test live calls.
- `confirmationDialog` attached inside scroll content did not present — attach it at page level.
- Presentations: attach sheets/covers/dialogs at page level and let the page read the flag in its body
  (`NapEmptyView` + `connectCover`); reading `scenePhase` on `RootView` itself stopped every presentation,
  so the foreground/calendar triggers live in the invisible `SyncTriggers` view (S2).
- HealthKit: the simulator has no Health data, so the walk-through ends on the no-data card; the
  `-preview` switch uses a DEBUG-only `PreviewTransport` that answers the Wearable endpoints locally.

- **S3 rulings** (ledger `.superpowers/sdd/2026-11-10-boop-s3-reggel/progress.md`):
  - P1: `day.hrToday {min, avg, max}` added to the contract and assembler — the pulse sheet shows daily min/avg/max (spec §9.3).
  - P2: `day.observations` are the patterns awaiting the owner's decision (what `decidePattern` accepts); swipe right = confirm, left = reject.
  - Error code is `BOOP_REGENERATE_LIMIT_REACHED` (UPPER_SNAKE like the other message codes), not `boop.brief.regenLimit`.
  - Hypnogram stage order 0 awake, 1 REM, 2 light, 3 deep, matching the shipped kit colours.
  - `busySlots` = 72 slots, 06:00–24:00, 15 min each; session minutes/time/plannedTime and sleep stage minutes are nullable (real data has nulls).
  - Observations = proposed patterns, newest 3; lead = title, bold/tail empty; strength from belief → confidence → |r| scaled 0..5.
  - Missing resting HR → forma uses a neutral pulzus 70; sleep score mirrors `DayEvaluationEngine` (no companion refactor), duration only without quality.
  - Conflict "last meeting" = latest-ending timed event that started before the session; a meeting running at the start counts; past 24:00 → none.
  - "≤ 2 sentences per metric" is a prompt instruction, not truncation (cutting Hungarian mid-thought reads worse).
  - Input hash uses night content + weight values (no updated/log id on `BoopDay`); steps, HR and the exact clock excluded — the movement score in a cached brief
    lags until a hashed input changes, the time-of-day bucket turns, or the owner regenerates. The intention is hashed by content (creed + foci), not an id.
  - `BoopCore` cannot import `BoopDesign`: `MetricKey` (string enum) is bridged to `Hue` in the app; `PathBuilder`/`Lens` take `MetricKey` and return BoopCore value types
    (`PathStep`, `LensAction` with a glyph name), mapped to `PathStation` in the app.
  - `Lens.action` is nil when Forma's current check-in is done (app shows "Boop elmondja"); weigh-in is not a station; the session is never marked done
    (the brief has no done flag); recovery adds walk / water / early bed.
  - Audio follows the approved spike (`.playback` + `.spokenAudio` + `.duckOthers`, deactivated with `.notifyOthersOnDeactivation`), not `.ambient`; there is an in-app mute.
  - With a brief loaded Mai stays through sync states; long-press menus use `Menu(primaryAction:)` (`contextMenu` does not open on glass).
  - Tiles without v1 data were adapted: Elalvás = bedtime, Feszültség → Pulzus ma min·átl·max, Víz "–" + hamarosan, kcal bar vs 500, glyphs instead of photos.
  - Pulzus breath targets the next upcoming densest block (an in-progress one loses).
  - A napom = strict chronological full day, meetings as one station (spec §5.2); curve anchors added per spec §10.3.
  - Evening (dusk = Pulzus sky) and kímélő (calm sky) keep one sky for the whole Nap page; orb taps re-colour orbs and lights only.
  - The bedtime reminder repeats nightly at target − 30 and follows a changed target.
  - Implementers run strictly sequentially on one branch (parallel commits mixed files in Task 8/9).
  - Owner OK 2026-11-10 on the domain-switch transition ("Jó, mehet tovább").
- **S3 traps:**
  - Brief ITs need `@ActiveProfiles("companion-fake")` so the LLM is the canned `FakeCompanionLlm` (marker `BOOP_BRIEF_V1`).
  - A future date is a **400**; a phone whose day is ahead of the owner zone falls back to yesterday (`MorningStore`).
  - `NKBackdropPanorama` conforms with `@preconcurrency Animatable` (a plain `Animatable` conformance clashes with the main-actor `View` under strict concurrency); keep the attribute when touching it.
  - DEBUG preview flags (simulator network is blocked): `-preview shell`, `-previewOrb`, `-previewTab ma|terv|naplo|boop` (B2), `-previewSheet sleep|heart|day`, `-previewDetent large`,
    `-previewScrub 15.5`, `-previewEvening` (clock 21:10), `-previewRecovery`, `-previewKept`, `-previewScroll`, `-previewSwitch`; `PreviewTransport` answers every Boop op coherently
    (moved session remembered, judged observations remembered).
  - `PathBuilder` lives in `BoopCore` and speaks `MetricKey`, never `Hue`.
  - A SwiftUI `DragGesture` on the observation card swallowed vertical page scrolls — the stack uses a `UIGestureRecognizerRepresentable` horizontal pan.
  - Reading and writing the observable `brief` in one statement is a Swift "Fatal access conflict" — use locals.
  - Native upsert of the session override relies on column defaults (`id`, `created_at`, `is_deleted`); a `PUT` with no body at all is a 500 from the platform handler (not Boop-specific).
  - Soft delete: derived finders on `daily_metric`/`wearable_workout`/`calendar_event` ignore `is_deleted` (parked minor, S2 tables).
- **B1 known limits / traps:**
  - Free team: no push (the entitlement is only in `Boop-Paid.entitlements`; putting `aps-environment` in `Boop.entitlements` breaks free-team signing). Background delivery is coded but unverified on a device.
  - An **empty sleep window** (the user deleted every night in the 60 days) cannot be sent (contract `minItems 1`), so that deletion is lost.
  - **HR bucket deletions are not propagated** (a deleted Health HR sample leaves its 5-minute bucket).
  - A **user-deleted night blocks its external id** permanently (a revived Health night with the same id stays deleted).
  - A cross-midnight logged session vs a Health workout dated on the other day can **double count** in the day load.
  - APNs environment is hard-coded to sandbox (a TestFlight/production build needs it switched); the register call goes out twice per launch; a keychain write failure mints a new device id.
  - `daily_metric` upsert overwrites every column, so the phone must send the full day; a Sleep Cycle rewrite re-builds the 60-day window (budget).
  - Deleting a Health weight does not recompute the goal; body-mass bounds are unvalidated (500 not 400).
  - The merge script is a production write — dry run first, owner OK with counts + rollback; never commit the user ids.
- **Parked minors (bd under `mezo-r36n9`):** payload versioning, `trendUp` on equal values, reload supersedes an in-flight regenerate, swallowed `setActive(false)`, real synthesizer adapter only verified on a device.
- Deferred (now B3/B4): the five morning steps (check-in, szándék, weigh-in, meal capture, quick food log, "+" sheet, notification list, settings), widgets, Beszélgetés and Rutin tabs.

## 10. Key files

`ios/Boop/RootView.swift` · `ios/Boop/Auth/AuthFlow.swift` · `ios/Boop/Onboarding/OnboardingFlow.swift` ·
`ios/Boop/Shell/ShellView.swift` · `ios/BoopKit/Sources/BoopCore/Session.swift` ·
`ios/BoopKit/Sources/BoopCore/OnboardingModel.swift` · `ios/BoopKit/Sources/BoopDesign/Pages.swift` ·
`ios/scripts/install-on-phone.sh` · `ios/scripts/sync-openapi.sh` · S2: `ios/Boop/Connect/*` ·
`ios/BoopKit/Sources/BoopCore/Health/HealthSync.swift` · `…/Health/SleepNightBuilder.swift` ·
`…/Calendar/CalendarSnapshotBuilder.swift` · `backend/…/feature/wearable/service/WearableSleepService.java` ·
`backend/…/feature/wearable/controller/WearableController.java` ·
S3: `api/feature/boop/boop.yml` · `backend/…/feature/boop/service/{BoopDayAssembler,BoopScores,EnergyCurveModel,BoopVerdictWriter,RuleVerdicts,BoopPrompts,BoopBriefService,BoopBriefStore,SessionTimeService}.java` ·
`…/feature/boop/controller/BoopController.java` · `…/feature/boop/config/BoopProperties.java` · `backend/src/main/resources/db/changelog/1.1.0/script/202611101300_mezo-r36n9.7_boop_brief.sql` ·
`ios/BoopKit/Sources/BoopCore/Morning/{Brief,MorningClient,PathBuilder,Lens,BoopVoice}.swift` · `ios/Boop/Nap/{MaiView,MaiTiles,MaiPath,LensActionRow,ObservationStack,SessionMove,MaiMode,BedtimeReminder,DetailSheet,SleepSheet,PulseSheet,DaySheet,ANapomView,NapView}.swift` ·
`ios/Boop/Shell/ShellView.swift` · `ios/BoopKit/Sources/BoopDesign/Napkelte/Frames.swift` (`NKBackdropPanorama`) ·
B2: `ios/Boop/Shell/{ShellView,PlacePage,AccountSheet}.swift` · `ios/Boop/Capture/CaptureSheet.swift` · `ios/Boop/{Terv,Naplo,BoopChat}/*` ·
`ios/Boop/Nap/{MaPhases,MaDrill,ProposalDesk,RoomSwipeBack}.swift` · `ios/BoopKit/Sources/BoopCore/Morning/{DayPhase,DayPlan,Proposals}.swift` ·
`ios/BoopKit/Sources/BoopDesign/Napkelte/{SpineBar,Proposal,Drill}.swift` ·
B1: `ios/BoopKit/Sources/BoopCore/Health/{HealthKitReader,HealthReader,HealthSync,HealthBackground,SleepNightBuilder,WorkoutMapper}.swift` · `…/Push/PushRegistrar.swift` · `ios/Boop/App/{BoopAppDelegate,BackgroundSyncHost}.swift` · `ios/Boop.entitlements` · `ios/Boop-Paid.entitlements` · `backend/…/feature/wearable/service/{HealthSampleService,WearableDeletionService,WorkoutReconciler}.java` · `backend/…/feature/biometrics/sleep/service/SleepNightMerge.java` · `api/feature/device/device.yml` · `scripts/ops/boop-b1-merge-accounts*.sql`
