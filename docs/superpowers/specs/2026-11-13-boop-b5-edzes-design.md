# Boop B5 — Edzés: the training room on the phone (design)

- **Status:** owner-approved design · **Date:** 2026-11-13 · **Issue:** `mezo-r36n9.15` · **Epic:** `mezo-r36n9`
- **Parent spec:** [`2026-11-11-boop-standalone-design.md`](2026-11-11-boop-standalone-design.md) §3.1 (the Edzés
  room's feature list), §4 (reuse map), §5 (slice B5).
- **Look:** [`2026-11-10-boop-napkelte-design.md`](2026-11-10-boop-napkelte-design.md) +
  [`2026-11-13-boop-kepek-design.md`](2026-11-13-boop-kepek-design.md) (photos).
- **Approved prototype:** the simulator spike `Edzes*.swift`, screenshots
  `docs/design_2.0/prototypes/boop-ios-spike/edzes-1…17-*.png`, commit `a8339460b`. The owner approved it
  unchanged on 2026-11-13 ("Mehet így"). **This spike is the build target; there is no further visual round.**
- **Evidence:** research `docs/superpowers/research/boop-standalone/03-training-sport.md` (the backend and web
  terrain) and `09-wearable-health.md`; the two recon reports summarised in §3 and §4 below.

---

## 1. Intent

Bring the whole training domain into Boop as a native room on the Napkelte spine, so that the owner's running
8-week block is actually *executed* and *logged* — on the phone, in a gym basement, with no signal.

The problem is not that training is unplanned. It is that the plan runs and the sessions do not arrive:

| | |
|---|---|
| Active mesocycle | "Back & Bicep Heavy All Body", 8 weeks from 2026-11-01, week 2, Upper/Lower/Push/Pull/Legs **5×/week** |
| Sessions logged in the first two weeks | **3** (2 in the week of 11-02, 1 in the week of 11-09) |
| Last set | 2026-11-12 |
| Cause, established in B3 | no internet while travelling → logging stopped |

So B5's first duty is not features; it is that **the player works with no network**, and that it never lies
about how fresh its numbers are.

## 2. Owner decisions (2026-11-13) — do not re-litigate

1. **Phone only. The Watch is not in this slice** (`mezo-r36n9.49`). Put to him twice: first on a wrong
   premise of mine ("you have no Apple Watch"), then re-put with the verified facts — he **has** an Apple
   Watch Series 5, wears it, and it is the only source of HRV in production, but his workouts come from a
   Huawei band (30 workouts in 60 days vs 1 from the Watch). He confirmed the deferral on the corrected
   facts. The recorded reason is the honest one: *his watch is a passive HRV source today; making it the
   training device is a slice of its own*, which also needs the paid team and its own look.
2. **The full room, including the block builder.** He overrode the recommended middle path (builder deferred
   to B6). Consequence: **B6 "A Terv" shrinks** — its training-plan half is built here; B6 keeps the diet
   plan, the weight goal, allowed recipes/ingredients, plan rules in AI context, adherence, shopping list and
   effect tracking.
3. **Sport in, running out.** Running has 0 blocks and 0 logs ever, and what it would really need (distance,
   pace) only an Apple Watch gives. It gets its own small slice *with* the watch if running becomes a goal.
4. **The prototype is approved as-is.** Build to match it.

Standing decisions that govern this slice: one voice (Boop), nothing applies without a tap, no emoji, no SF
Symbols except chevrons/arrows, Napkelte look, photo-first per Képek.

## 3. Prior art

External recon (web). Everything below was read as untrusted data and is marked where it is unverified.

**Adopted now**

- **Offline-first is the differentiator, not a nicety.** The one recurring substantive user complaint found
  about strength trackers is *"why not just save them offline?"* — requiring connectivity to log a workout.
  That matches the owner's own history exactly.
- **A locally-updated Live Activity beats a push-updated one for a gym** (ActivityKit field notes,
  https://alicinaroglu.dev/live-activities-and-dynamic-island-lessons-from-2-production-apps/): push needs
  signal; local updates do not. Also: after ~4–8 minutes without an update the system marks an activity
  **stale** and visibly degrades it, so a rest timer should use `Text(timerInterval:)` rather than pushed
  ticks. **Deferred with the watch slice** (a Live Activity is a widget-extension target, i.e. a new App ID
  on a team we do not have yet) — recorded here so B5/b does not re-research it.

**Rejected or deferred, with the reason**

- **Mirrored `HKWorkoutSession` (watch owns the session, phone mirrors it)** — Apple's sanctioned structure
  (WWDC23 §10023, https://developer.apple.com/videos/play/wwdc2023/10023/). The right spine for a watch
  slice, not for this one. Its sharp edges are recorded for `mezo-r36n9.49`: the start/end order deadlocks if
  `finishWorkout()` is awaited before `end()`
  (https://sasq.ca/blog/2025/3/2/building-a-workout-app-for-apple-watch); `sendToRemoteWorkoutSession` fails
  with "Remote session delegate is not set up" unless `prepare()` ran first, and still fails intermittently
  (https://nonstrict.eu/blog/2024/hkworkoutsession-remote-delegate-not-setup-error/); `handleActiveWorkoutRecovery()`
  must re-attach delegates *and* re-start mirroring; HealthKit authorization is **per-device**.
- **WatchConnectivity channel choice** — `transferUserInfo` (queued, persisted, FIFO) is the only one that
  guarantees delivery; `sendMessage` requires reachability and `updateApplicationContext` coalesces, which
  would lose sets (https://alexanderweiss.dev/blog/2023-01-18-three-ways-to-communicate-via-watchconnectivity).
  For B5/b, not B5.
- **Per-set HR has no published prior art.** The implied pattern — buffer `(timestamp, bpm)` from
  `didCollectDataOf` and snapshot min/avg/max over `[setStart, setEnd]`, never re-query HealthKit, never use
  `builder.statistics(for:)` (cumulative) — is recorded for B5/b. Also flagged: `HKLiveWorkoutBuilder`
  reports **wrong active energy for `.traditionalStrengthTraining`** while HR is fine
  (https://developer.apple.com/forums/thread/792607).
- **Watch-app UX prior art is genuinely thin** — no engineering write-ups from Hevy/Strong/Fitbod surfaced,
  only store listings. Treat this item as *not researched*; B5/b should do its own sweep.

## 4. Codebase terrain

Internal recon. Anchors are `path:line` at the time of writing.

**What already exists and must be used, not rebuilt**

- **The room skeleton with inner tabs is in the kit and was reserved for this slice.**
  `BoopDesign/Napkelte/Drill.swift:8` `NKDrillPage(hue:crumb:eyebrow:headline:sentence:level:tabs:selectedTab:headPhoto:onBack:content:)`
  renders `NKCapsuleTabs` under the verdict block (`:56`). B5 is its first user. The caller switches `content`
  on the selected tab itself — there is **no paging container, no per-tab scroll position, no lazy tab state**;
  B5 adds what it needs.
- **The Képek kit landed with B4**: `BoopDesign/Napkelte/Etel.swift` carries `NKPhoto`, `nkPhotoTone()`,
  `NKPhotoSky`, `NKOrbScrim`, `NKCardPhoto`, `NKThumb`, `NKCapsuleTabs` — all generic despite the file name,
  and its own comment says "Edzés reuses them with its own mood photo". **No photo-head work is needed**;
  only the Mozgás mood photo asset.
- **The B3 offline spine** is the pattern for every write:
  `BoopCore/Ritmus/Outbox.swift:5` (`OutboxKind`, raw values persisted in `queue.json` — **never rename a
  case**), `:189` `group(of:) -> (key, waits)`, `:9` (`OutboxItem.id` **is** the `clientRef`), `:207`
  (`maxAgeDays = 7` — a workout logged offline on a long trip can expire unsent);
  `BoopCore/Ritmus/RitmusClient.swift:53` the send switch, `:90` the status map, `:133` the
  "replay the idempotent add to learn the server id" trick — **directly relevant**, because `startWorkout`
  returns a server id that set logging needs; `ios/Boop/Ritmus/RitmusEnvironment.swift:102` the delivery hook,
  `:207` `relinkIfNeeded`, `:287` `capture(_:payload:kind:date:)`, `:235` the per-user storage folder.
- **Skip and kímélő are already wired and shared with Étel.** The generator filter already carries
  `upsertPlannedSkip`, `listPlannedSkips`, `undoPlannedSkip`, `getRecovery`, `upsertRecovery`,
  `deleteRecovery`, `recoveryCheckIn`; one backend policy (`PlannedSkipPolicy`) judges GYM/SPORT/RUN/MEAL.
  A Swift wrapper exists in `BoopCore/Etel/FoodClient.swift` (`recovery()` :670, `startKimelo(_:)` :685).
- **Workout reconciliation already exists server-side**: `WorkoutReconciler` in `feature/wearable`
  (overlap ≥ 50 %, `LoggedSessionReadPort` implemented in `train`). B5 extends it rather than inventing it.
- **The whole `/api/train/*` surface is callable as-is** (61 endpoints). The server computes prescriptions,
  warmups, the rationale, the volume ramp, the comeback ramp and the reports; the Swift client is a stepper
  UI, a rest timer and an outbox.

**What has to change**

- `BoopAPI/openapi-generator-config.yaml` — ~20 train operations appended to the filter (shared hot spot;
  B4's block is already on main and B5 appends). Filtering pulls in transitive schemas, so expect a large
  generated-type growth and a longer build; `ios/scripts/sync-openapi.sh --check` must stay clean.
- **`clientRef` does not exist on `/api/train/*` writes.** Either add it to the contract (as B3 did for goals
  and journal entries) or use natural keys (workout id + exercise + set index). Decided in the plan.
- `DayLedger` is not a workout shape, and changing it also changes `ServerDay` (`RitmusClient.swift:16`) and
  every persisted day file → **a separate per-workout store**, not a `DayLedger` field.

**Traps carried into the plan**

- **Presentations must sit at page level and the page must read the flag in its body** (`boop-ios.md`
  §9). The player is a **full-screen cover at page level** (the B3 `RitmusRouter`/`RitmusCover` pattern),
  never a push inside the room, because the spine bar hiding is keyed off `setRoomOpen`. The spike also hit
  the related trap that **a presentation whose binding is already true on first render does not fire**.
- **`@SceneStorage("tab")`** restores the last place on relaunch; an in-progress workout needs its own
  restoration state — nothing exists today.
- **The LuLu firewall blocks the simulator's network**, so `PreviewTransport` is the only thing the simulator
  ever sees — and it **asserts on an unanswered operation**. Every new train operation must be answered there.
- `orbPalette` must pad to exactly four colours; a `LivingOrb` inside a tap target swallows the tap;
  `contextMenu` does not open on glass (use `Menu(primaryAction:)`).
- **Entry points that today say "hamarosan" and must become real:** the `+` sheet tile "Edzés indítása"
  (`ios/Boop/Capture/CaptureSheet.swift:37`), the Mozgás lens pill menu (`ios/Boop/Nap/LensActionRow.swift:19`),
  and the Mozgás room's week/days sections (`MaDrill.swift:50`, `:150`).
- `docs/features/boop-ios.md` §7 ("How to extend it") is **stale** — it still names `LagyTabPage`/`LagyFlowFrame`.
  Fix it in this slice's doc update.

## 5. What gets built

### 5.1 The room

`Edzés` opens from the Mozgás orb, the `+` sheet and a timeline row, on `NKDrillPage` with the hue's photo
head and four capsule tabs **`Ma · Blokk · Gyakorlatok · Előzmények`**, exactly as the approved spike.

| Tab | Content |
|---|---|
| **Ma** | today's session card (photo, time, counts, **Kezdjük el** / Könnyítés / Ma kihagyom); **Az eligazítás** — what the engine changed since the last same-day and why, plus the readiness read; the week's five days with what is done; **Mit tehetsz** — Boop's proposal card with *miért?*, sport logging, kímélő mode. |
| **Blokk** | the running block (8 weeks as a bar row, where you are, what each week asks), per-muscle weekly volume against MEV/MAV/MRV, muscle priorities, the weekly clock, and **Újat kezdenék** — the four-step block builder, rerun, a one-off custom workout, saved templates. |
| **Gyakorlatok** | records (e1RM, best working weight, most reps), the searchable 166-row catalog with photos, an exercise page (your numbers, the progress arc, your durable note), add a new exercise. |
| **Előzmények** | what happened (sessions and sport, newest first), the four-week load with the skipped week explained, and the deeper reads: the block report with Boop's evaluation, comparing two blocks, the muscle map. |

### 5.2 The player

A full-screen cover at page level, five states, exactly as the spike: **briefing → set → rest → debrief →
close**.

- **Set**: three big ± steppers (weight 2.5 kg, reps 1, RIR 1), the engine's own rationale sentence, last
  week's reference, the durable exercise note, **Megvan**, swap/skip links, and the sets already in the bag.
- **Rest**: the orb drains as the clock runs (Napkelte has no progress rings — a circle is a real clock
  only), what is next, **Kezdem** / **+30 mp**.
- **Debrief**: pump / joint pain / workload, each one tap, skippable.
- **Close**: totals, new records, one sentence to yourself, and — offline — the plain promise that the sets
  are on the phone and will go up by themselves.
- Mid-workout: **swap an exercise** (this session or the rest of the block) and **skip an exercise**.

### 5.3 Offline is a first-class state

This is the part the slice exists for.

- **Writes** go through B3's `Outbox`: new kinds for workout start / set / set edit / finish / feedback /
  note, ordered in a **group keyed by the workout id, not the date** (the first non-date group in the queue —
  training is strictly ordered: start → sets → finish).
- **Reads** go through a new **last-known-good read cache** (`mezo-vxjj9`), designed jointly with the B4
  session and built here because the player cannot exist without it:
  1. a **sibling** of `Outbox` and `DayLedger` in `BoopCore`, never inside `DayLedger` — `DayLedger` is what
     the *owner did* (write-side truth); the cache is what the *server last said* (derived, perishable). One
     store would let a stale server answer render with the owner's own confidence;
  2. keyed by **endpoint + date**, with the **fetch instant stored beside the payload**;
  3. **read-only**: never a write path, never merged into an outbox item, never the source of anything sent
     to the server;
  4. **every screen rendered from it shows its age visibly** — on a prescription this is loud, because a set
     logged against a two-day-old target is a real training decision made on stale data;
  5. **age-evicted**; past its useful age it reads „nincs friss adat" rather than pretending to be current;
  6. it answers "what did the server last say"; the UI composes it with `DayLedger` ("what I have done
     since"), never the other way round.
  It is built **general** (nothing train-specific), so B4's day plan and budget become a one-screen follow-up.

### 5.4 Reconciliation — an owner choice, put to him

He wears both an Apple Watch and a Huawei band. An overlap check across sources returns **zero rows today**,
so duplicate workouts are not a live bug; the pattern (Huawei workouts stop 2026-11-02, one Watch workout
2026-11-12) reads as a switch in progress. The choice — pre-empt it now, or wait for the first collision and
accept one messy day — was put to him and is carried into the plan as an open item, not assumed.

## 6. Non-goals

- No watchOS app, no Live Activity, no per-set HR storage (`mezo-r36n9.49`).
- No running: no blocks, no run logging, no distance or pace.
- No XP, levels, medal ceremony or the `activity` life-skill log (parent spec §3.1 "not ported").
- No change to how the engine decides load. Pump / joint pain / workload still do **not** feed next week's
  prescription; whether they should is an open question in research `03` §7.3 and is not decided here.
- The web app keeps working; nothing in it is changed for Boop's sake.

## 7. Risks and open points

| Risk | Handling |
|---|---|
| The generator filter grows the build a lot (train has the biggest schema surface) | measure before and after; if the build time becomes unreasonable, trim the operation list to what the room actually calls |
| `clientRef` missing on `/api/train/*` | decided in the plan: contract change vs natural keys |
| The outbox fails items older than **7 days** unsent, and the server window is today−7…today+1 | a workout logged on a long trip can expire — surface it as a refusal the owner can see and retry, never a silent drop |
| The simulator cannot reach the network (LuLu) | every new operation answered in `PreviewTransport`; live calls verified on the phone |
| An in-progress workout survives a relaunch | the player needs its own restoration state; `@SceneStorage("tab")` alone restores the wrong place |
| The Mozgás world has no mood photo | `aura-hegy.jpg` ships as the stand-in, which the owner saw and accepted; `mezo-r36n9.44` tracks the real one |
| B6's scope shrinks | update `mezo-r36n9.16` when this ships |
