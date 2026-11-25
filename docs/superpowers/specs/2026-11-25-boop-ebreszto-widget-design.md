# Boop — Emlékeztetők + ébresztők, widgetek, edzés a zárolt képernyőn

- **Issue:** `mezo-r36n9.172` (epic `mezo-r36n9`) · session `boop-ebreszto-widget` · branch `feat/boop-ebreszto-widget`
- **Date:** 2026-11-25 · **Status:** builder-checked, D8 answered by the owner; waiting for the owner's OK
- **Takes over:** the workout Live Activity from B5 (`mezo-r36n9.15`, which keeps the watchOS app) and the widget of
  `mezo-r36n9.13.1` (B3's check-in widget, design already approved).

## 1. Intent — what the owner asked for and why

The owner (2026-11-25, in Hungarian) wants four things on the iPhone app:

1. **Reminders he sets himself, ringing like an alarm.** The model is Apple's Reminders app: any title, any time,
   repeat. His own example is taking vitamins. When it is time, the phone takes the whole screen like the Clock app's
   alarm, even with the app closed and the phone locked.
2. **Home Screen widgets**, with what they show designed with him.
3. **The running workout on the Lock Screen**: the current exercise and the rest countdown without unlocking.
4. **A Lock Screen presence while he lives in the app**: the day's next thing, visible without unlocking.

Why: the app is his single daily coach. Today it can only remind him of its own fixed moments (check-ins at
07:30/12:30/16:00, the evening close, bedtime), cannot remind him of anything he chooses, says nothing when a rest
ends on a locked phone, and is invisible outside the app.

## 2. Owner decisions in this brainstorm (2026-11-25)

| # | Decision |
|---|---|
| D1 | A **general reminder list for anything** (Apple Reminders style). **Plus** an "emlékeztess" switch on the supplements that puts an item in the same list; its button is **"Bevettem"** and it logs the intake into the day. |
| D2 | Every reminder has a **strength**: **Ébresztő** (full screen, rings through silent mode and Focus) or **Értesítés** (ordinary notification with sound). **The vitamin reminder is an Ébresztő.** |
| D3 | **All four widgets:** (1) Home small *Következő* — next item + time left; (2) Home medium *Mai nap* — next 3 items + today's reminders, tickable on the widget; (3) Home medium *Napközbeni kérdés* — the approved B3 one-tap check-in; (4) Lock Screen line — next thing / reminder. No 0–100 score on any widget (the score left the home, earlier decision). |
| D4 | **The workout card on the Lock Screen** as sketched: header "EDZÉS · 7 / 16 sorozat", exercise + "3. sorozat a 4-ből", target "80 kg × 8", rest countdown with a bar, buttons **Kész · +15 mp · Tovább**; the countdown small in the Dynamic Island. Other weight/reps → open the app. |
| D5 | **End of rest:** vibration + short sound by default; a setting switches it to **alarm strength**. |
| D6 | **Two steps.** Step 1: reminders and alarms (works on the free team). Step 2: widgets and the workout card. |
| D7 | **The paid Apple developer team is not active and will not be for a while.** Everything is built for the free team. |
| D8 | **Silencing an Ébresztő is only silence.** AlarmKit runs the alarm's stop action on every dismissal (button, swipe, side button), so stop = "Leállítom": the occurrence stays open. The **secondary button is "Kész" / "Bevettem"** and is the only alarm path that ticks. No snooze on the alarm screen (two button slots); he ticks later in the app, on the widget or from MA. Reason (owner): Boop's data must mean it really happened — an accidental "taken" would spoil the later vitamin ↔ sleep/form comparison. |

Item 4 of the request is answered by widget (4): Apple keeps a Live Activity on screen at most 8 h (12 h on the Lock
Screen), so an "all-day" card is a widget; the Live Activity is reserved for the workout (owner accepted this).

## 3. Goals, non-goals, anti-goals

**Goals**
- He can add, edit, pause and delete any reminder; it rings at the right minute with the app killed, the phone
  locked, on silent, in any Focus (Ébresztő) — and survives a reboot and the weekly free-team reinstall.
- The vitamin alarm's "Bevettem" ticks the supplement group exactly as the Étel room's tick does (same server write,
  same idempotency), without him opening the app.
- He never misses the end of a rest on a locked phone.
- He sees the day's next thing and the workout state without unlocking.

**Non-goals**
- Syncing reminders to Apple's Reminders app or iCloud; sharing reminders; location-based reminders; lists/tags/
  sub-tasks; reminders for other people.
- Server storage of the reminders (they live on the phone — see §6.2; revisit if he gets a second device).
- The watchOS app (B5 keeps it). Server push (APNs) — not available on the free team.
- Making the Live Activity an all-day presence.

**Anti-goals (a failure even if it "works")**
- An alarm that silently does not ring (worse than no feature). Every path that can lose an alarm must be closed or
  told to him on screen.
- Alarm fatigue: soft nudges ringing through silent mode. Only reminders he marks Ébresztő do that; Boop's own
  reminders stay notifications.
- A widget showing yesterday's or wrong data without saying so.
- Emoji, "Mezo", or a score on the widgets; anything outside the Napkelte look.

## 4. Constraints

- **Free Apple team** (D7): 7-day signing, ≤ 3 sideloaded apps, ≤ 10 new App IDs a week, no APNs, no paid
  entitlements (Critical Alerts are out anyway — Apple grants them only to medical/safety apps). Step 2's widget
  extension is **one new App ID** (`io.mrkuhne.boop.widgets`).
- **Unverified on the free team: App Groups and a shared Keychain access group.** The B3 spec claimed App Groups are
  unavailable on the free team; recon could not confirm it either way. Step 2 begins with an install probe (§7.1).
- iOS 26 deployment target, Swift 6, iPhone portrait only. The project file is hand-written (one writer at a time).
- Napkelte look (dark glass, painted sky, colour only in sky and orbs, serif headlines, Outfit numbers, mono labels,
  no emoji, no SF Symbols except chevrons/arrows). Widgets and Live Activities are rendered by the system: no glass
  effect, no Metal shaders, fonts must be bundled in the extension → a **widget-safe subset** of the kit.
- Owner gates: this spec → OK; **one simulator spike round covering both steps** → OK; plan → OK; then build without
  further visual rounds.
- Hungarian, quiet copy. No guilt ("elmaradt" never used against him).

## 5. Approaches considered

| Approach | What it is | Trade-off | Verdict |
|---|---|---|---|
| **A. AlarmKit for Ébresztő + local notifications for Értesítés; widget extension with WidgetKit + ActivityKit; reminders stored on the phone** | Apple's iOS 26 alarm API draws the full-screen alarm; ordinary reminders stay `UNUserNotificationCenter`; one extension holds the widgets and the Live Activity | AlarmKit is new (26.x reliability reports) → re-schedule on every launch; the extension needs shared storage (probe) | **Chosen** |
| B. Everything as notifications (time-sensitive) | No full-screen; a banner he can silence | Fails D2 (no full-screen, no ringing through silent/Focus) | Rejected |
| C. Critical Alerts | Rings through everything | Entitlement Apple does not grant to a coaching app; not on a free team | Rejected |
| D. One release for everything | — | Owner chose two steps (D6) so the vitamin alarm does not wait for the extension | Rejected by owner |
| E. All-day Live Activity for item 4 | — | 8 h / 12 h system limit, he can swipe it away, updates only from the app | Rejected → Lock Screen widget |

## 6. Step 1 — reminders and alarms

### 6.1 What he sees

- **Where:** today's reminders appear on the day page (Ma) as a quiet fold **"Emlékeztetők"** — each row: time ·
  title · tick circle; ticked rows drop to the bottom dimmed. "Mind" opens the **Emlékeztetők page**. A new reminder
  starts from the "+" sheet (a new door **"Emlékeztető"**) or from the page's corner action. *(Builder's call refined
  in the spike: exact placement on Ma, whether the fold hides when there are none today — default: hidden.)*
- **Emlékeztetők page** (an `NKAreaSubPage`-style page in a neutral hue): sections **MA** (today's occurrences with
  ticks), **ISMÉTLŐDŐ** (each repeating reminder: title, time, days, strength mark, on/off), **EGYSZERI** (upcoming
  one-offs), **BOOP EMLÉKEZTETŐI** (the built-in ones — check-in ×3, evening close, bedtime — each on/off + time;
  today these are hard-coded and have no settings anywhere).
- **Edit sheet:** title (free text) · time · repeat: *Egyszer* (date) / *Minden nap* / *Ezeken a napokon* (H K Sz Cs
  P Szo V chips) · strength: **Ébresztő** / **Értesítés** · optional note · delete. Supplement-linked reminders show
  the group name as the title, read-only, with "A kiegészítőknél szerkeszted".
- **Supplements** (Étel → Kamra → supplement groups): each daypart group gets **"Emlékeztess"** with a time and the
  strength (default Ébresztő, D2). It creates/updates/removes a linked reminder.
- **When it rings:**
  - *Ébresztő:* the system's alarm with the reminder's title — full screen on a locked phone, a large banner on top
    when the phone is in use (told to the owner). Stop = **"Leállítom"** (silence only, D8); the secondary button =
    **"Kész"** (supplement: **"Bevettem"**) ticks. No snooze button. Rings through silent mode and every Focus.
    AlarmKit requires a system symbol on its buttons: a plain checkmark — the one accepted exception to the
    no-SF-Symbols rule (my call, told to the owner).
  - *Értesítés:* a notification with sound and two actions **"Kész"** / **"10 perc múlva"**; tapping the body opens
    the Emlékeztetők page.
  - "Kész" ticks today's occurrence; "Bevettem" also ticks the supplement group (server intake). Neither opens the
    app. A missed reminder simply stays unticked in MA — no badge, no nagging re-ring.
  - **Ticking early cancels today's ring** (my call, told to the owner): an occurrence ticked before its time — on the
    page, the widget, or, for a supplement reminder, by ticking the group in the Étel room — does not ring that day.
- **Rest end (D5), already in step 1** (needs no extension): Edzés settings get **"Pihenő vége"**: *Rezgés és hang*
  (default) / *Ébresztő*. While a rest runs and the app is not in the foreground, the chosen signal fires at
  `restEndsAt`; it is re-armed on every rest change (+15 s, skip, next set) and cancelled when the workout ends.
- **Permissions:** the alarm permission is asked the first time he saves an Ébresztő (with one Hungarian sentence on
  why). If he denies it, the reminder is saved as Értesítés and the row says "Ébresztő helyett értesítés — engedélyezd
  a Beállításokban" with a button to Settings. Same for notifications.

### 6.2 How it works

- **Model** (pure, in `BoopCore`, new `Reminders/` folder, TDD): `Reminder { id, title, note?, time (hh:mm),
  repeat: .once(date) | .daily | .weekdays(Set), strength: .alarm | .notification, enabled, link: .none |
  .supplement(groupKey) }`; `ReminderDay` done-state per occurrence (`reminderId + yyyy-MM-dd`); built-in Boop
  reminders are settings (`enabled`, `time`) read by the existing planners, not `Reminder` rows.
- **Storage:** one JSON file per user, behind a storage seam that step 2 points at the App Group container (widget
  ticks run in the extension's process and can only reach the App Group; they write a tick queue there that the app
  drains on its next launch/foreground/background wake and then re-arms). Step 1 keeps it in the per-user folder
  (`RitmusEnvironment.directories(for:)`), keyed by `userKey`; sign-out cancels every scheduled alarm/notification of the family (like `WallNotifier.signedOut`).
  Reinstalling over the same bundle id keeps app data, so the weekly free-team reinstall keeps the reminders.
- **Scheduler** (one owner of "what is armed"): on launch, foreground, every edit, sign-in/out and HealthKit
  background wake, it **clears and re-adds** the whole family (the existing `RitmusReminders.refresh` pattern,
  serialised through a task chain). Because an early tick must cancel one day's ring, repeats are **expanded into
  dated one-offs over a rolling window** (not weekly-repeating alarms/triggers): alarm-strength → AlarmKit `.fixed`
  alarms for the next 7 days, notification-strength → dated `UNUserNotificationCenter` requests for the next 3 days
  (the 64 cap). Occurrences already ticked are skipped. Ids prefixed `boop.rem.`. Behind seams with fakes
  (`AlarmScheduling`, the existing `ReminderCenter` — adding methods breaks four fakes; prefer a new protocol).
- **Budget:** the shared 64-pending-notification cap — today up to 28 ritmus + 1 bedtime + ≤ 2 wall rings are
  pending. Reminder notifications get a cap of 24 requests (nearest first); the window shrinks before anything is
  dropped, and the page warns if today's would not fit. The rolling window is refilled at every launch, foreground
  and background wake; a phone untouched for > 3 days loses notification-strength rings first (alarms hold 7 days). AlarmKit alarms are not in that
  cap (the system may refuse with `maximumLimitReached` → shown on the row).
- **Buttons without opening the app:** AlarmKit's stop/secondary buttons and the notification actions run an App
  Intent / the notification delegate **in the app process** (launched in the background). "Kész" writes the done
  state; the notification's "10 perc múlva" schedules a one-off notification 10 min later. "Bevettem" is a **new
  one-way, idempotent supplement-group tick** — the Étel room's `EtelStore.toggle` is a toggle that can undo and has
  no offline path, so it is not reused as is. The new path reuses the server write and its idempotency key
  (`supplementRef(day:daypart:)`), never deletes, records the taken state **per user** (today it is
  `UserDefaults.standard` by day only — moved to a per-user key, the room reads the same), and goes through the
  shared Outbox (a new `OutboxKind`) when offline or when the background launch has no network.
- **Step 1 starts with a one-alarm probe on the phone** (free team, no extension): a `.fixed` AlarmKit alarm with a
  custom secondary intent that does not open the app, rung with the phone locked and the app killed. If the alert or
  the background intent needs the widget extension, the extension (its App ID and the per-target signing fix of §7.1)
  moves into step 1 and the owner is told.
- **Built-in reminders:** `RitmusReminders` and `BedtimeReminder` read their times/on-off from the new settings
  instead of constants; defaults unchanged (07:30 / 12:30 / 16:00, close = bedtime − 75 min, bedtime − 30 min).
- **Reliability (anti-goal 1):** re-arm on every launch (AlarmKit forum reports alarms lost after OS updates);
  after re-arming, compare the system's list with ours and mark rows that could not be armed. AlarmKit fails
  silently if the app is hidden or Face-ID-locked — the page says so in one line under the permission state.
- **Info.plist keys** as `INFOPLIST_KEY_` build settings (Debug + Release): `NSAlarmKitUsageDescription`. This is
  step 1's only project-file change.

## 7. Step 2 — widgets and the workout on the Lock Screen

### 7.1 First task: the free-team install probe

Before any widget code: add an empty widget extension with an App Group (`group.io.mrkuhne.boop`) and a Keychain
access group, install on the phone with `install-on-phone.sh`, and check that (a) it installs and signs, (b) the app
and the extension read the same App Group file, (c) the extension can read the token. Outcomes:

- **All work** → the design below as written.
- **App Group fails** → the workout card still ships (a Live Activity gets its data from the app through ActivityKit,
  no shared storage needed); the widgets wait for the paid team, and the owner is told in Hungarian. *(Fallback the
  builder may try first: widgets fed only by the app's timeline reloads are not possible without shared storage —
  so no widget ships in that case.)*
- **Keychain sharing fails but App Group works** → widgets ship; their buttons queue taps in the App Group and the
  app sends them on its next open / background wake (the widget shows the tap at once).

`install-on-phone.sh` passes `CODE_SIGN_ENTITLEMENTS` on the command line, which would apply the app's entitlements
to the extension — it must move to per-target settings before the extension exists.

### 7.2 The widgets (D3)

All four read one **widget snapshot** the app writes into the App Group on every relevant change (brief loaded,
reminder edited/ticked, meal logged, workout started/ended, check-in saved) followed by
`WidgetCenter.reloadTimelines`: today's and tomorrow's remaining items in clock order (from `DayPlan.rows` +
today's reminders), each reminder's done state, the current check-in question and its index, `writtenAt`. Timelines
carry one entry per item time so "next" advances without a reload; time left uses the system's relative date text.

| Widget | Size | Content | Interaction |
|---|---|---|---|
| Következő | small | mono label "KÖVETKEZŐ", the time large (Outfit), the title (serif), "még 1 ó 20 p" | tap → the item's place in the app |
| Mai nap | medium | next 3 items (time · title) + today's reminders with tick circles | tick a reminder (App Intent in the extension → App Group tick queue, shown ticked at once; the app sends/re-arms on its next wake); "Bevettem" for supplement rows |
| Napközbeni kérdés | medium | the approved B3 design (orb label, "1/6", the question, 1–10 grid) | one tap = one answer (App Intent) |
| Zárolt képernyő | accessory rectangular (+ inline) | "12:30 Ebéd · 8:00 Vitamin" — next item and the next unticked reminder | tap → app |

- Look: painted-sky gradient background in the item's hue (a pre-rendered image, no shader), white type, the bundled
  serif / Outfit / mono fonts; Lock Screen accessories are rendered monochrome by the system.
- Staleness: if `writtenAt` is older than today's first item or the day changed, the widget shows only reminders
  (local truth) and a quiet "Nyisd meg a Boopot a mai tervhez" line — never yesterday's plan as today's.
- Empty: "Mára nincs több teendő" (+ tomorrow's first item).

### 7.3 The workout card (D4) — a Live Activity

- **Start** when a workout starts in the player; **update** on every `WorkoutSession` change (set logged, rest
  started/extended/skipped, exercise switched, technique run); **end** on finish, discard, sign-out; on launch, end
  any leftover activity that has no running `workout.json`. The 8 h limit is ample.
- **Content state** (≤ 4 KB, `Codable & Hashable & Sendable`, in `BoopCore` so app and extension share it): phase
  (set / rest / technique / finish), exercise name, set index / count, overall done / total, target weight × reps,
  `restEndsAt`, `restTotal`.
- **Lock Screen layout** as sketched in D4; the countdown is `Text(timerInterval:countsDown:)` + `ProgressView
  (timerInterval:)` so the system ticks it with no updates; `staleDate = restEndsAt` flips to "Pihenő vége" when it
  runs out.
- **Dynamic Island:** compact = small orb dot + countdown (rest) or "3/4" (set); expanded = the Lock Screen card
  content; minimal = the dot.
- **Buttons** (`LiveActivityIntent`, run in the app process, so they work locked and on the free team): **Kész**
  logs the current set with the planned weight × reps (same path as the player's tick), **+15 mp** extends the rest,
  **Tovább** skips the rest. Each re-arms the rest-end signal (§6.1).
- No other weight/reps entry on the Lock Screen (system limit) — the card says nothing about it; tapping the card
  opens the player.

## 8. Edge cases

- Phone off at alarm time → AlarmKit alarms survive reboot; a one-off whose time passed while off is shown unticked.
- Time zone change → repeats follow local time (`.relative`); one-offs keep their absolute moment.
- Free-team signature expires (7 days) before the reinstall → the app cannot launch, intents cannot run and alarms
  may not ring. A local notification the day before expiry ("Holnap lejár a Boop telepítése — telepítsd újra") plus a
  line on the Emlékeztetők page with the expiry date (the install script knows it; the app stores the build date and
  derives +7 days). Accepted as a known limit beyond that.
- Two reminders at the same minute → both ring; AlarmKit order between apps is not predictable (accepted).
- Supplement group deleted in Étel → its linked reminder is removed, the page says so once.
- "Bevettem" while offline → ticked locally, sent through the Outbox; the Étel room shows it taken at once.
- Workout running across app kill → the Live Activity is updated again when the app relaunches and restores
  `workout.json`; until then the countdown still ticks from `restEndsAt`.
- Sign-out with a workout card showing → ended.
- Rest end in the foreground → no signal (the player is on screen), as today.

## 9. Prior art (recon 2026-11-25)

| Pattern | Source | Adopted? |
|---|---|---|
| AlarmKit: system-drawn full-screen alarm, rings through silent + every Focus, survives reboot/force-quit; stop + secondary buttons as App Intents; `.fixed` vs `.relative` schedules; custom UI only in a Live Activity; `maximumLimitReached`; silent failure for hidden/locked apps | [WWDC25 230 notes](https://wwdcnotes.com/documentation/wwdc25-230-wake-up-to-the-alarmkit-api/), [DTS FAQ](https://developer.apple.com/forums/thread/797158) | **Adopted** for Ébresztő; snooze done by re-scheduling (no countdown UI in step 1) |
| AlarmKit reliability reports (lost after 26.2 update, late fires when packed) | [forum 809398](https://developer.apple.com/forums/thread/809398), [forum 825427](https://developer.apple.com/forums/thread/825427) | **Adopted mitigation:** re-arm on every launch + compare and mark rows |
| Don't use alarms for soft nudges | WWDC25 230 | **Adopted:** strength per reminder, Boop's own reminders stay notifications |
| Live Activity: 8 h / 12 h, 4 KB, local updates, `Text(timerInterval:)` countdown, `staleDate`, `LiveActivityIntent` buttons | [Apple: Displaying live data](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) | **Adopted** for the workout card |
| Hevy: exercise + set, mark set done, rest timer with ±15 s / Skip on the Lock Screen | [Hevy help](https://help.hevyapp.com/hc/en-us/articles/35649846517399) | **Adopted** (Kész · +15 mp · Tovább) |
| AlarmKit countdown as rest timer | [Nil Coalescing](https://nilcoalescing.com/blog/CountdownTimerWithAlarmKit/) | **Partly:** the Ébresztő rest-end option uses a fixed alarm at `restEndsAt`, not a second countdown activity |
| Oura/WHOOP widgets: one number + sleep graph; stale widgets are the top complaint | [Oura widgets](https://support.ouraring.com/hc/en-us/articles/11785597429907-Oura-Widgets) | **Rejected** the score widget (owner: no score on the home); **adopted** the staleness rule |
| All-day presence = Lock Screen widget, Live Activity only for bounded events | ActivityKit doc | **Adopted** (item 4 → widget 4) |

## 10. Codebase terrain (recon 2026-11-25)

- **Notifications today:** all local; seam `ReminderCenter` + `SystemReminderCenter` + the single delegate
  `ReminderPresenter` (`ios/Boop/Nap/BedtimeReminder.swift:11-120`, installed `ios/Boop/BoopApp.swift:11`); no
  categories/actions. `BedtimeReminder` (`:172-251`, `UserDefaults.standard`, not per user). Daily-loop planner
  `ios/Boop/Ritmus/RitmusReminders.swift` (pure `plan` `:108`, hard-coded times `:142-148`, clear-and-re-add family
  `:64-74`, ≤ 28 requests). `WallNotifier` (`ios/Boop/Nap/WallNotifier.swift`, ≤ 2/day, per user, sign-out cancel).
  Refresh points: `ios/Boop/RootView.swift:202`, `ios/Boop/App/BackgroundSyncHost.swift:30-34`. No settings UI.
- **Routing from outside the view tree:** `RitmusRouter.shared` (`ios/Boop/Ritmus/RitmusRouter.swift`).
- **Supplements:** group tick `EtelStore.toggle(group)` (`ios/Boop/Etel/`), groups `SupplementGroups.swift`,
  server keys `wake|breakfast|pre_workout|lunch|post_workout|dinner|evening|bedtime`; taken state also in
  `UserDefaults`; quick sheet `ios/Boop/Capture/QuickSheets.swift`.
- **Workout:** `ios/BoopKit/Sources/BoopCore/Train/WorkoutSession.swift` (Codable, Date-based `restEndsAt`/
  `restTotal` `:194-222`, `step` `:280-289`, rest start `:411-427`, `progress` `:290`); `ios/Boop/Edzes/
  EdzesStore.swift` (persists `workout.json` `:115`, `update`/`endWorkout` `:301-345`, `attach(folder:)` `:105`);
  player cover `ios/Boop/Edzes/EdzesRoom.swift:176-205`, 1 s timer `WorkoutPlayer.swift:90-92`. **Nothing signals a
  rest end when locked.** Gym settings `ios/Boop/Edzes/GymSettings.swift`.
- **Next-thing data:** `DayPlan.rows(brief)` (`BoopCore/Morning/DayPlan.swift:51-96`), `dayMoments`, the wall
  (`Wall.swift`). The brief is in memory only (`MorningClient.swift:60`) → the widget snapshot is new.
- **Storage:** everything (ledger, outbox, `ServerCache`, `workout.json`, flags, Keychain token without access
  group `BoopCore/TokenStore.swift:11-31`) is private to the app container — nothing an extension can read today.
  Do **not** move the outbox; the widget gets its own snapshot file.
- **Project:** two targets (`Boop`, `BoopTests`), hand-written `project.pbxproj`, synchronized groups, iOS 26,
  `GENERATE_INFOPLIST_FILE` + `INFOPLIST_KEY_*` (Debug and Release). No App Group, WidgetKit, ActivityKit or AlarmKit
  anywhere. `install-on-phone.sh:40-45` passes entitlements globally (trap for an extension).
- **Kit:** `BoopDesign` uses `glassEffect`, Metal orbs and runtime font registration — not usable as-is in an
  extension → widget-safe subset.
- **Patterns:** seam + fake per system service; pure "when it rings" logic with an injected clock and
  `en_US_POSIX` Gregorian calendar; per-user keys and sign-out cleanup; DEBUG launch flags documented in
  `ios/README.md`; BoopCore never imports BoopDesign.

## 11. Left to the builder

- Exact placement of the Ma fold and the Emlékeztetők page entry (settled in the spike).
- Whether the widget-safe kit is a new BoopKit target or files in the extension.
- AlarmKit metadata and intent shapes; how the background-launched intent reaches the per-user stores.
- The reminder-notification cap value (24 proposed) and the per-weekday request layout.

## 12. Kész, ha… (seed for the plan)

- Step 1: a reminder rings at its minute with the app killed + phone locked + silent (Ébresztő) and as a notification
  (Értesítés); "Kész", "10 perc múlva", "Bevettem" work without opening the app; the supplement tick reaches the
  server; reminders survive the weekly reinstall; Boop's built-in reminders editable; rest-end signal in both modes;
  permission-denied states; smallest iPhone width; reduced motion; no emoji, no "Mezo".
- Step 2: probe result recorded; the four widgets on the phone with live data, stale and empty states; the workout
  card on the Lock Screen and Dynamic Island with working buttons; leftover activity cleanup.
- Gates: `xcodebuild test` BoopKit + Boop; `node scripts/lint-docs.mjs` 0/0; docs (`boop-ios.md`, `ios/README.md`
  flags, handbook pages, `_jegyek`/`_kiadasok`, Notion `check` exit 0); installed on the phone and walked through.
