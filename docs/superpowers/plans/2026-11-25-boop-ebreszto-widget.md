# Boop — Emlékeztetők + ébresztők, widgetek, edzés a zárolt képernyőn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In-app reminders that ring as AlarmKit alarms or notifications (step 1), then four widgets and the workout Live Activity (step 2), all on the free Apple team.

**Architecture:** Pure models and planners in `BoopCore` (TDD with fakes); system services behind seams in the app (`AlarmKit`, `UNUserNotificationCenter`, `ActivityKit`, `WidgetCenter`); one scheduler that clears and re-arms the `boop.rem.` family. Step 2 adds one widget extension (`BoopWidgets`) and a dependency-free BoopKit target `BoopShared` for what the app and the extension both read.

**Tech Stack:** Swift 6, SwiftUI, iOS 26, AlarmKit, App Intents, ActivityKit, WidgetKit, Swift Testing (`@Test`/`#expect`, as the repo's tests use).

**Spec:** [`docs/superpowers/specs/2026-11-25-boop-ebreszto-widget-design.md`](../specs/2026-11-25-boop-ebreszto-widget-design.md) (decisions D1–D8). Spike shots: `docs/design_2.0/prototypes/boop-ios-spike/ebreszto-01…11-*.jpg`; the throwaway spike code is `ios/Boop/EbresztoSpike/` (deleted in Task 1, never merged).

## Global Constraints

- Free Apple team only (D7): no APNs, no paid entitlements; step 2 adds exactly one App ID `io.mrkuhne.boop.widgets`. Never touch `~/.config/boop/paid`.
- iOS 26.0 deployment target, Swift 6 strict concurrency; ActivityKit/AlarmKit metadata types are `Codable & Hashable & Sendable`.
- Info.plist keys only as `INFOPLIST_KEY_*` build settings, in **both** Debug and Release blocks of `ios/Boop.xcodeproj/project.pbxproj`.
- Ids: reminders `boop.rem.<reminderId>.<yyyy-MM-dd>`, snooze `boop.rem.snooze.<reminderId>`, rest end `boop.rest`, install expiry `boop.expiry`.
- Copy: Hungarian, quiet, no guilt, never emoji, never "Mezo". Exact strings: alarm stop **„Leállítom”**, secondary **„Kész”** / supplement **„Bevettem”**; notification actions **„Kész”**, **„10 perc múlva”**; strength names **„Ébresztő”** / **„Értesítés”**; rest setting **„Pihenő vége”** with **„Rezgés és rövid hang”** (default) / **„Ébresztő”**; workout buttons **„Kész”**, **„+15 mp”**, **„Tovább”**.
- Look: Napkelte kit (`BoopDesign/Napkelte/`), as the approved spike shots; the AlarmKit button symbol `checkmark` is the one accepted SF Symbol exception (D8 note). Widgets/Live Activity: no `glassEffect`, no Metal, Outfit bundled in the extension.
- Silencing an alarm never ticks (D8). An early tick cancels that day's ring. Boop's built-in reminders stay notification strength.
- Per-user: every store keyed by `userKey`; sign-out cancels every `boop.rem.`/`boop.rest` request and alarm and ends the Live Activity.
- Shared hot spots: `ios/Boop.xcodeproj/**` (Tasks 1, 11, 13), `ios/BoopKit/Package.swift` (Task 12). Before touching them, `bd list --parent mezo-r36n9 --status in_progress` and read the Owns lists; `ios/Boop/Edzes/EdzesRoom.swift` is co-edited by `mezo-r36n9.113` (presentation only) — keep this plan's edits to new call sites and rebase before merge.
- Gates per step: `xcodebuild test` BoopKit + Boop with `-skipPackagePluginValidation` (`ios/README.md`), own simulator `Boop · mezo-r36n9.172` (`D503B185-C184-47BD-A7EB-37BAE7AFF2F9`); `node scripts/lint-docs.mjs` 0/0; `node scripts/gen-codemap.mjs` after the merge.

## Review Focus

1. **The phone was untouched for days** (no launch, no background wake) → notification-strength rings beyond 3 days are gone; alarm-strength hold 7 days. Expect the page to say how far ahead it is armed. *Pinned in Task 2 (window boundaries) and Task 8 (the "armed until" line).*
2. **Day boundaries**: a reminder at 00:10, a tick at 23:59 vs 00:01, DST change week (last Sunday of March/October, Europe/Budapest) — the occurrence key must be the local day of the ring, and a `.weekdays` repeat must not double or skip on the DST day. *Pinned in Task 2.*
3. **Background launch with no UI** (app killed, phone locked) running „Bevettem”, „Kész” on the workout card, or a widget tick — must work from files alone, never assume `RootView` built the environment. *Pinned in Tasks 6, 7, 13.*
4. **Permission revoked later** in Settings (alarm or notifications) → the next refresh falls back and the row says so; nothing pretends to be armed. *Pinned in Task 5.*
5. **Sign-out / account switch** while alarms, a snooze, a rest end or the workout card are pending → all gone, and the next user's reminders are not shown or armed. *Pinned in Tasks 5, 9, 13.*

---

# STEP 1 — reminders and alarms

### Task 1: Phone probe — does AlarmKit work on the free team without an extension?

**Files:**
- Delete: `ios/Boop/EbresztoSpike/` and the DEBUG `ebrSpike` switch in `ios/Boop/BoopApp.swift` (restore `body` to `WindowGroup { RootView()… }`)
- Modify: `ios/Boop.xcodeproj/project.pbxproj` — app target, Debug + Release: `INFOPLIST_KEY_NSAlarmKitUsageDescription = "A Boop az általad beállított ébresztőket így tudja megszólaltatni, akkor is, ha le van zárva a telefon.";`
- Create: `ios/Boop/Emlekeztetok/AlarmProbe.swift` (DEBUG only)

- [ ] **Step 1:** Implement `AlarmProbe.run()` behind launch flag `-probeAlarm YES`: request AlarmKit authorization, schedule one `.fixed` alarm 2 minutes ahead titled „Próba-ébresztő” with stop „Leállítom” and a `.custom` secondary „Kész” whose `LiveActivityIntent` `ProbeDoneIntent` (`openAppWhenRun = false`) writes `Date()` to `UserDefaults` key `probe.doneAt`. On launch with the flag, also print the stored `probe.doneAt`.
- [ ] **Step 2:** Build for the simulator (must compile with the key and intent). Run: the `xcodebuild … build` from Global Constraints. Expected: `BUILD SUCCEEDED`.
- [ ] **Step 3:** Tell the owner (Hungarian) that this session will install on his phone now (install is exclusive), then `ios/scripts/install-on-phone.sh` with the flag set in the scheme's launch args for that run only. With him: lock the phone, wait, confirm (a) the locked full-screen alert appears and rings on silent, (b) „Kész” without unlocking leaves a `probe.doneAt` (check on next launch), (c) „Leállítom” silences.
- [ ] **Step 4:** Record the result as a bd comment on `mezo-r36n9.172`. **If (a) or (b) fails:** stop step 1, move Task 11's extension setup (target, App ID, per-target signing) before Task 5, add an alarm Live Activity to the extension, tell the owner in Hungarian, and continue.
- [ ] **Step 5:** Commit `feat(boop): AlarmKit usage key + DEBUG alarm probe (mezo-r36n9.172)`.

### Task 2: Reminder model and occurrence planner (BoopCore, pure)

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Reminders/Reminder.swift`, `ReminderPlanner.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/ReminderPlannerTests.swift`

**Interfaces — Produces:**
```swift
public struct Reminder: Codable, Equatable, Identifiable, Sendable {
    public var id: UUID; public var title: String; public var note: String?
    public var hour: Int; public var minute: Int
    public var repeats: ReminderRepeat; public var strength: ReminderStrength
    public var enabled: Bool; public var link: ReminderLink
}
public enum ReminderRepeat: Codable, Equatable, Sendable { case once(String /*yyyy-MM-dd*/), daily, weekdays(Set<Int> /*1=Mon…7=Sun*/) }
public enum ReminderStrength: String, Codable, Sendable { case alarm, notification }
public enum ReminderLink: Codable, Equatable, Sendable { case none, supplement(daypart: String) }
public struct ReminderOccurrence: Equatable, Sendable { public let reminderId: UUID; public let day: String; public let fireAt: Date
    public var key: String { "\(reminderId.uuidString)|\(day)" } }
public struct ReminderPlan: Equatable, Sendable { public var alarms: [ReminderOccurrence]; public var notifications: [ReminderOccurrence]; public var todayOverflow: Bool }
public enum ReminderPlanner {
    public static func plan(_ reminders: [Reminder], done: Set<String>, now: Date, calendar: Calendar,
                            alarmDays: Int = 7, notificationDays: Int = 3, notificationCap: Int = 24,
                            alarmsAllowed: Bool) -> ReminderPlan
    public static func occurrences(on day: String, _ reminders: [Reminder], calendar: Calendar) -> [ReminderOccurrence]
}
```
Calendar: Gregorian, `en_US_POSIX`, device zone, injected (as `RitmusReminders.swift:52-58`).

- [ ] **Step 1: Write the failing tests** (`calendar` = Europe/Budapest):
  - `dailyExpandsSevenDaysOfAlarms`: one daily 08:00 alarm, now = Wed 07:00 → 7 alarms, first `day` = today, `fireAt` 08:00 local.
  - `pastTodayIsSkipped`: now = 08:01 → first alarm is tomorrow.
  - `doneOccurrenceIsSkipped`: `done` contains today's key → today absent, tomorrow present.
  - `weekdaysOnlyOnChosenDays`: `.weekdays([1,3])` over 7 days → only Mon/Wed.
  - `onceInPastIsDropped`, `disabledIsDropped`.
  - `notificationWindowIsThreeDaysAndCapped`: 10 daily notification reminders → ≤ 24, nearest first, `todayOverflow == false`; 30 at the same time today → `todayOverflow == true`.
  - `alarmsFallBackToNotificationsWhenNotAllowed`: `alarmsAllowed: false` → alarm-strength occurrences land in `notifications` (3-day window).
  - `dstWeekKeepsLocalTime`: daily 08:00 across 2027-03-28 → every `fireAt` is 08:00 local, 7 distinct days.
  - `midnightReminderBelongsToItsOwnDay`: 00:10 daily, now = 23:59 → next occurrence `day` = tomorrow's date.
- [ ] **Step 2:** Run `cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package -destination 'id=D503B185-C184-47BD-A7EB-37BAE7AFF2F9' -skipPackagePluginValidation -only-testing:BoopCoreTests/ReminderPlannerTests`. Expected: FAIL (types missing).
- [ ] **Step 3:** Implement the types and `plan` (expand per day, filter, split by strength, sort by `fireAt`, cap notifications).
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(boop): reminder model + occurrence planner (mezo-r36n9.172)`.

### Task 3: ReminderStore — per-user persistence, done state, built-in settings

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Reminders/ReminderStore.swift`, `BoopReminderSettings.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/ReminderStoreTests.swift`

**Interfaces — Produces:**
```swift
public struct BoopReminderSettings: Codable, Equatable, Sendable {
    public struct Slot: Codable, Equatable, Sendable { public var enabled: Bool; public var hour: Int; public var minute: Int }
    public var morning = Slot(enabled: true, hour: 7, minute: 30); public var noon = Slot(enabled: true, hour: 12, minute: 30)
    public var afternoon = Slot(enabled: true, hour: 16, minute: 0)
    public var closeEnabled = true; public var closeMinutesBeforeBed = 75
    public var bedtimeEnabled = true; public var bedtimeMinutesBefore = 30
}
public struct ReminderFile: Codable, Equatable, Sendable { public var reminders: [Reminder]; public var done: Set<String>; public var builtIn: BoopReminderSettings }
@MainActor @Observable public final class ReminderStore {
    public init(fileURL: URL, clock: @escaping @Sendable () -> Date = Date.init)
    public private(set) var file: ReminderFile
    public func upsert(_ r: Reminder); public func delete(_ id: UUID)
    public func tick(_ key: String); public func untick(_ key: String)
    public func setBuiltIn(_ s: BoopReminderSettings)
    public func reminder(linkedTo daypart: String) -> Reminder?
    public func reload()            // re-read the file (another process — Task 15 — may have written ticks)
    public var changes: Int { get } // bumped on every write; the scheduler observes it
}
```
`done` keys older than 14 days are pruned on every write. Writes are atomic, `.completeFileProtectionUntilFirstUserAuthentication` (readable while locked after first unlock, like `workout.json`). File: `<per-user folder>/reminders.json` from `RitmusEnvironment.directories(for:)`; Task 15 points `fileURL` at the App Group.

- [ ] **Step 1:** Failing tests: `roundTripsThroughTheFile`, `tickIsIdempotent`, `oldDoneKeysArePruned` (15-day-old key gone after a write), `missingFileStartsEmptyWithDefaults` (built-in defaults equal 07:30/12:30/16:00, 75, 30), `reloadSeesAnotherWriter`, `twoUsersNeverShareAFile` (two URLs, independent state).
- [ ] **Step 2:** Run with `-only-testing:BoopCoreTests/ReminderStoreTests`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(boop): per-user reminder store (mezo-r36n9.172)`.

### Task 4: Built-in reminders read their settings

**Files:**
- Modify: `ios/Boop/Ritmus/RitmusReminders.swift` (`plan(ledger:bedtimeTarget:)` at `:108`, hard-coded times `:142-148`), `ios/Boop/Nap/BedtimeReminder.swift` (`BedtimeReminder` `:172-251`)
- Test: `ios/BoopTests/RitmusRemindersTests.swift`, `ios/BoopTests/BedtimeReminderTests.swift`

**Interfaces — Consumes:** `BoopReminderSettings`. **Produces:** `RitmusReminders.plan(ledger:bedtimeTarget:settings:)`; `BedtimeReminder` reads `settings.bedtimeEnabled`/`bedtimeMinutesBefore` (the existing on/off toggle on Ma writes `bedtimeEnabled` through the store).

- [ ] **Step 1:** Failing tests: `defaultsPlanAsBefore` (default settings = today's exact output — keep the existing assertions green), `disabledSlotIsNotPlanned`, `movedSlotRingsAtNewTime` (morning 08:15), `closeOffDropsTheClose`, `bedtimeOffCancelsBoopBedtime`.
- [ ] **Step 2:** Run `cd ios && xcodebuild test -project Boop.xcodeproj -scheme Boop -destination 'id=D503B185-C184-47BD-A7EB-37BAE7AFF2F9' -skipPackagePluginValidation -only-testing:BoopTests/RitmusRemindersTests -only-testing:BoopTests/BedtimeReminderTests`. Expected: FAIL.
- [ ] **Step 3:** Thread `settings` through; migrate `bedtimeReminder.on` from `UserDefaults.standard` into the store once (read old key, write `bedtimeEnabled`, remove old key).
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(boop): Boop's own reminders follow their settings (mezo-r36n9.172)`.

### Task 5: ReminderScheduler — arm alarms and notifications

**Files:**
- Create: `ios/Boop/Emlekeztetok/ReminderScheduler.swift`, `AlarmScheduling.swift` (protocol + `SystemAlarmScheduler` over `AlarmManager.shared`)
- Modify: `ios/Boop/RootView.swift:202` (refresh with the other reminders), `ios/Boop/App/BackgroundSyncHost.swift:30-34` (wake refresh), `ios/Boop/RootView.swift:88` (sign-out cancel, next to `WallNotifier.signedOut`)
- Test: `ios/BoopTests/ReminderSchedulerTests.swift`

**Interfaces — Produces:**
```swift
protocol AlarmScheduling: Sendable {
    func authorization() async -> AlarmAuth            // .allowed / .denied / .notDetermined
    func requestAuthorization() async -> AlarmAuth
    func schedule(_ o: ReminderOccurrence, title: String, secondaryTitle: String) async throws   // throws AlarmArmError.limit / .other
    func cancelAll(prefix: String) async
    func scheduledIds() async -> Set<String>
}
enum ArmState: Equatable { case armed(until: Date?), fellBackToNotification, failed(String), notificationsDenied }
@MainActor @Observable final class ReminderScheduler {
    init(store: ReminderStore, alarms: AlarmScheduling, center: ReminderCenter, clock: @escaping @Sendable () -> Date)
    func refresh(askPermission: Bool) async     // serialized task chain, like RitmusReminders.refresh :64-74
    func signedOut() async
    private(set) var state: [UUID: ArmState]    // per reminder, read by the page
}
```
Notification requests reuse `ReminderCenter.scheduleOnce` (add **no** methods to `ReminderCenter` — four fakes would break); category id `boop.rem` is set via the `userInfo`/request in Task 6. AlarmKit `.fixed` schedule; id = `UUID` derived from the occurrence key (stable, SHA-256 like `supplementRef`) so `scheduledIds` can be compared.

- [ ] **Step 1:** Failing tests with `FakeAlarms` + the existing `FakeCenter` pattern: `refreshClearsAndReaddsTheFamily`, `alarmPermissionAskedOnlyWhenAskPermission`, `deniedAlarmsFallBackAndSayIt` (state `.fellBackToNotification`, center got the requests), `limitErrorMarksTheRow` (`.failed`), `tickedTodayIsNotArmed`, `signOutCancelsEverything` (alarms `cancelAll("boop.rem.")` + center ids with prefix removed), `refreshesNeverOverlap` (two concurrent calls → one consistent final set), `revokedLaterFallsBackOnNextRefresh`.
- [ ] **Step 2:** Run `-only-testing:BoopTests/ReminderSchedulerTests`. Expected: FAIL.
- [ ] **Step 3:** Implement; wire refresh points (launch, foreground via `SyncTriggers`, store `changes`, background wake, sign-in/out).
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(boop): reminder scheduler over AlarmKit and notifications (mezo-r36n9.172)`.

### Task 6: One-way supplement tick, offline, per user

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Etel/SupplementTick.swift` (payload, `supplementRef` moved here from `ios/Boop/Etel/EtelLogic.swift:218`, `SupplementTakenStore`)
- Modify: `ios/BoopKit/Sources/BoopCore/Ritmus/Outbox.swift` (new case `supplementTick` — **append, never rename**; order group `("supplement|\(date)|\(daypart)", false)`), `ios/BoopKit/Sources/BoopCore/Ritmus/RitmusClient.swift` (`send` → `FoodClient(client:).tickGroupIntakes(daypart:clientRef:capturedAt:)`), `ios/Boop/Etel/EtelRoom.swift` (`syncTaken`/`persistTaken` `:128-133`, `:506-508` read/write `SupplementTakenStore`), `ios/Boop/Ritmus/RitmusEnvironment.swift` (`captureSupplementTick(daypart:at:)` next to `captureWeight` `:225`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/SupplementTickTests.swift`, `ios/BoopTests/EtelStoreTests.swift`

**Interfaces — Produces:**
```swift
public struct SupplementTickPayload: Codable, Equatable, Sendable { public let day: String; public let daypart: String }
public func supplementRef(day: String, daypart: String) -> UUID      // unchanged derivation
public final class SupplementTakenStore: Sendable {                   // file-backed, per user: <folder>/supplements-taken.json
    public init(fileURL: URL)
    public func taken(day: String) -> [String: [UUID]]                  // daypart → intake ids ([] = sent/queued, ids unknown)
    public func markTaken(day: String, daypart: String, ids: [UUID]?)   // nil = queued; never removes
    public func undo(day: String, daypart: String)                      // only the room's explicit undo calls this
}
```
The room's undo of a group whose ids are still unknown answers „Még küldöm — utána visszavonhatod” and changes nothing. One-time migration: read `UserDefaults` `etel.takenIds.<today>` into the current user's file, then remove it. A tick (any source) also calls `ReminderStore.tick` for today's linked occurrence, so the alarm does not ring (early-tick rule).

- [ ] **Step 1:** Failing tests: `refIsStableAcrossCalls` (same as the old function's output for a fixed input), `queuedTickIsTakenAtOnce`, `markTakenNeverUntakes`, `senderSendsWithTheDerivedRef` (fake transport asserts `clientRef`), `offlineStaysQueued` (`.offline` result → item kept), `migrationReadsTheOldKeyOnce`, `roomUndoOfUnknownIdsSaysStillSending`, `roomTickAlsoTicksTheLinkedReminder`.
- [ ] **Step 2:** Run both test files. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(boop): one-way offline supplement tick shared by the room and the alarm (mezo-r36n9.172)`.

### Task 7: Buttons that work without opening the app

**Files:**
- Create: `ios/Boop/Emlekeztetok/ReminderIntents.swift` (`ReminderDoneIntent`, `ReminderSilenceIntent`), `ios/Boop/Emlekeztetok/HeadlessContext.swift`
- Modify: `ios/Boop/Nap/BedtimeReminder.swift` `ReminderPresenter` (`:95-120`): register category `boop.rem` with actions `done` („Kész”) and `snooze` („10 perc múlva”), handle them in `didReceive`
- Test: `ios/BoopTests/ReminderActionsTests.swift`

**Interfaces — Produces:**
```swift
@MainActor enum HeadlessContext {
    /// The signed-in user's stores, built from files when no UI exists (BackgroundSyncHost.lastUserId + RitmusEnvironment.directories(for:)).
    static func reminderStore() -> ReminderStore?
    static func outbox() -> Outbox?      // the same per-user Outbox the UI uses; nil when signed out
}
@MainActor enum ReminderActions {
    static func done(key: String, store: ReminderStore) async          // tick, then supplement tick if linked (Task 6), then scheduler refresh
    static func snooze(reminderId: UUID, center: ReminderCenter, now: Date) async   // one-off notification boop.rem.snooze.<id> at now+600 s
}
```
AlarmKit config per occurrence: `stopIntent = ReminderSilenceIntent` (does nothing but log — D8), `secondaryIntent = ReminderDoneIntent(key:)` with `secondaryButtonBehavior = .custom`, secondary title „Bevettem” when `link == .supplement`, else „Kész”; symbol `checkmark`. Intents prefer the live UI stores (`BackgroundSyncHost.ritmus` / a `ReminderStore` registered by `RootView`) and fall back to `HeadlessContext`.

- [ ] **Step 1:** Failing tests: `doneTicksTheOccurrence`, `doneOnLinkedReminderAlsoQueuesTheSupplementTick` (fake outbox sees `.supplementTick`), `silenceNeverTicks`, `snoozeSchedulesTenMinutesLater` (center got `boop.rem.snooze.<id>` at +600 s), `headlessWithNoUserDoesNothing`.
- [ ] **Step 2:** Run `-only-testing:BoopTests/ReminderActionsTests`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(boop): Kész / Bevettem / 10 perc múlva without opening the app (mezo-r36n9.172)`.

### Task 8: The screens

**Files:**
- Create: `ios/Boop/Emlekeztetok/{EmlekeztetokPage,ReminderEditSheet,MaReminders,ReminderRows}.swift`, `ios/Boop/Emlekeztetok/ReminderPresentation.swift` (pure builders), `ios/Boop/Emlekeztetok/InstallExpiry.swift`
- Modify: `ios/Boop/Nap/MaiView.swift` (the fold under the wall), `ios/Boop/Capture/CaptureSheet.swift` (`doors` `:110`: append `("bell-cream", "Emlékeztető", "bármire", .reminder)`; new `CapturePick.reminder`; shell opens the edit sheet), `ios/Boop/Etel/SupplementGroups.swift` (per group: „Emlékeztess” toggle + time + strength, default Ébresztő — creates/updates/deletes the linked `Reminder`)
- Test: `ios/BoopTests/ReminderPresentationTests.swift`

Screens as spike shots 01–04: Ma fold „Emlékeztetők” (hidden when nothing today; ticked rows sink, dimmed; „Mind” → page), page sections MA · ISMÉTLŐDŐ · EGYSZERI · BOOP EMLÉKEZTETŐI, `ArmState` line under a row („Ébresztő helyett értesítés — engedélyezd a Beállításokban” + Settings button; „Nem sikerült beállítani”), the footer lines (alarms ring through silent; „A telepítés <dátum>-án lejár — előtte egy nappal szólok.”; „Előre beállítva: <dátum>-ig”). Edit sheet: title, wheel time, Egyszer / Minden nap / Ezeken a napokon + H K Sz Cs P Szo V, strength cards, note, Mentem, Törlöm; linked reminders show the group name read-only + „A kiegészítőknél szerkeszted”. First Ébresztő save asks the alarm permission with one sentence.

**Interfaces — Produces:**
```swift
struct ReminderSections: Equatable { var today: [TodayRow]; var repeating: [Reminder]; var once: [Reminder] }
func reminderSections(_ file: ReminderFile, now: Date, calendar: Calendar) -> ReminderSections   // today sorted: open by time, then done by time
func repeatLabel(_ r: ReminderRepeat) -> String         // "minden nap", "H K Sz Cs P", "dec. 2., kedd"
enum InstallExpiry { static func date(bundle: Bundle) -> Date?  /* ExpirationDate from embedded.mobileprovision; nil on simulator */ }
```
`InstallExpiry`: schedule `boop.expiry` the day before at 10:00 via `ReminderCenter.scheduleOnce`: title „Holnap lejár a Boop telepítése”, body „Telepítsd újra, különben az ébresztők sem szólnak.”

- [ ] **Step 1:** Failing tests: `todayOpenFirstDoneLast`, `repeatLabelsInHungarian` (`.weekdays([1,2,3,4,5])` → "H K Sz Cs P"; `.daily` → "minden nap"), `onceSectionOnlyFuture`, `foldHiddenWhenNothingToday`, `expiryParsedFromProfilePlist` (fixture plist data → date).
- [ ] **Step 2:** Run `-only-testing:BoopTests/ReminderPresentationTests`. Expected: FAIL.
- [ ] **Step 3:** Implement builders and views; DEBUG flags `-reminders page|edit|edit-linked|denied` and `-previewMaReminders YES` (document in `ios/README.md`).
- [ ] **Step 4:** Re-run; screenshot each flag on the own simulator at 440 pt and at the smallest width (`iPhone SE (3rd generation)` or 375 pt), with reduced motion on. Compare to spike shots 01–04.
- [ ] **Step 5:** Commit `feat(boop): Emlékeztetők page, edit sheet, Ma fold, + door, supplement switch (mezo-r36n9.172)`.

### Task 9: Rest-end signal

**Files:**
- Create: `ios/Boop/Edzes/RestEndSignal.swift`
- Modify: `ios/Boop/Edzes/EdzesStore.swift` (`update` `:302`, `endWorkout` `:330`: call the signal), the Edzés settings entry next to the gym sheet in `ios/Boop/Edzes/EdzesRoom.swift` (row „Pihenő vége” → sheet as spike shot 11), `ios/Boop/Nap/BedtimeReminder.swift` `ReminderPresenter.willPresent` (suppress `boop.rest` in the foreground)
- Test: `ios/BoopTests/RestEndSignalTests.swift`

**Interfaces — Produces:**
```swift
enum RestEndMode: String, Codable { case vibrate, alarm }           // stored per user, default .vibrate
@MainActor final class RestEndSignal {
    init(alarms: AlarmScheduling, center: ReminderCenter, mode: @escaping () -> RestEndMode)
    func sessionChanged(_ s: WorkoutSession?, now: Date) async   // arm at restEndsAt (or technique.restEndsAt), cancel when nil/past
    func foregroundChanged(_ inForeground: Bool) async          // alarm mode: cancel in foreground, re-arm in background
    func signedOut() async
}
```
Vibrate mode = one-off notification `boop.rest`, title „Lejárt a pihenő”, body = next exercise + set („Fekvenyomás · 3. sorozat”), default sound. Alarm mode = AlarmKit `.fixed` at `restEndsAt`, title „Lejárt a pihenő”, stop „Leállítom”, no secondary.

- [ ] **Step 1:** Failing tests: `restStartArmsAtRestEnd`, `addRestRearms` (+15 s moves the fire date), `skipRestCancels`, `endWorkoutCancels`, `alarmModeCancelsInForegroundAndRearmsInBackground`, `pastRestEndArmsNothing`, `signOutCancels`.
- [ ] **Step 2:** Run `-only-testing:BoopTests/RestEndSignalTests`. Expected: FAIL.
- [ ] **Step 3:** Implement and wire.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(boop): rest end rings on a locked phone — vibrate or alarm (mezo-r36n9.172)`.

### Task 10: Step 1 ship

- [ ] **Step 1:** Full gates: BoopKit and Boop `xcodebuild test` (see Global Constraints) — all green; record counts.
- [ ] **Step 2:** Docs: `docs/features/boop-ios.md` (new section *Emlékeztetők és ébresztők* — model, scheduler, ids, the 64-cap budget, AlarmKit, D8, rest end; §9 traps), `ios/README.md` flags, handbook page `docs/boop-handbook/<terület>/emlekeztetok.md` (format per that folder's README), `_dontesek.json` rows for D1–D8, `_kiadasok.json` row after merge.
- [ ] **Step 3:** Fresh-context review on the most capable model over the step-1 diff; fix Critical/Important test-first; file minors under `mezo-r36n9`.
- [ ] **Step 4:** `git fetch && git rebase origin/main`, local `--no-ff` merge from detached HEAD, `git push origin HEAD:main`, `node scripts/gen-codemap.mjs`, fast-forward the primary checkout (boop skill §3).
- [ ] **Step 5:** Announce and run `ios/scripts/install-on-phone.sh`; walk through with the owner: a 2-minute Ébresztő with the app killed + locked + silent; „Bevettem” from the alarm reaches Étel; Értesítés with Kész / 10 perc múlva; an early tick cancels; a rest end in both modes. Then `node scripts/boop-notion-sync.mjs plan` → apply → `check` exit 0; commit `_notion-state.json`; Hungarian report.

# STEP 2 — widgets and the workout card

### Task 11: Extension skeleton + free-team probe

**Files:**
- Modify: `ios/Boop.xcodeproj/project.pbxproj` — new `PBXNativeTarget` `BoopWidgets` (app-extension, `io.mrkuhne.boop.widgets`, iOS 26, its own synchronized group `ios/BoopWidgets/`), "Embed Foundation Extensions" phase + dependency on the app target; app target `INFOPLIST_KEY_NSSupportsLiveActivities = YES`
- Create: `ios/BoopWidgets/BoopWidgetsBundle.swift`, `ios/BoopWidgets/BoopWidgets.entitlements`, `ios/BoopWidgets/Info.plist` (`NSExtensionPointIdentifier = com.apple.widgetkit-extension`)
- Modify: `ios/Boop.entitlements`, `ios/Boop-Paid.entitlements` (App Group `group.io.mrkuhne.boop`, keychain group `$(AppIdentifierPrefix)io.mrkuhne.boop.shared`), `ios/scripts/install-on-phone.sh:40-45` (entitlements per target via each target's `CODE_SIGN_ENTITLEMENTS` build setting, not a global command-line override)

- [ ] **Step 1:** A probe widget (DEBUG text) that reads `probe.txt` from the App Group and a keychain item written by the app under the shared group.
- [ ] **Step 2:** Build. Expected: `BUILD SUCCEEDED`, `git grep DEVELOPMENT_TEAM ios/` empty.
- [ ] **Step 3:** Announce the install, run the script, add the widget on the phone. Record in bd: (a) signs + installs, (b) App Group shared, (c) keychain shared.
- [ ] **Step 4:** Branch per spec §7.1: all good → continue; App Group fails → do Tasks 12–13 only (Live Activity), skip 14–15, tell the owner the widgets wait for the paid team, file the bd follow-up; keychain fails → Task 15 uses the tick queue only.
- [ ] **Step 5:** Commit `feat(boop): widget extension skeleton + App Group probe (mezo-r36n9.172)`.

### Task 12: `BoopShared` target — what app and extension both read

**Files:**
- Modify: `ios/BoopKit/Package.swift` (new library target `BoopShared`, no dependencies; `BoopCore` depends on it; the extension links only `BoopShared`)
- Create: `ios/BoopKit/Sources/BoopShared/{WidgetSnapshot,WorkoutActivity,WidgetTickQueue,SharedContainer}.swift`, Outfit font copied into `ios/BoopWidgets/Fonts/` and registered with `UIAppFonts` in the extension Info.plist
- Test: `ios/BoopKit/Tests/BoopSharedTests/*.swift` (new test target)

**Interfaces — Produces:**
```swift
public struct WidgetSnapshot: Codable, Equatable, Sendable {
    public struct Item: Codable, Equatable, Sendable { public let at: Date; public let title: String; public let hue: String; public let deepLink: String }
    public struct ReminderRow: Codable, Equatable, Sendable { public let key: String; public let at: Date; public let title: String; public let done: Bool; public let supplementDaypart: String? }
    public struct Checkin: Codable, Equatable, Sendable { public let label: String; public let question: String; public let index: Int; public let count: Int; public let moment: String }
    public let writtenAt: Date; public let day: String
    public let items: [Item]            // today's and tomorrow's remaining plan rows, clock order
    public let reminders: [ReminderRow] // today's occurrences
    public let checkin: Checkin?
}
public struct WorkoutActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable, Sendable {
        public enum Phase: String, Codable, Sendable { case set, rest, technique, finish }
        public let phase: Phase; public let exercise: String; public let setIndex: Int; public let setCount: Int
        public let done: Int; public let total: Int; public let targetKg: Double?; public let targetReps: Int?
        public let restEndsAt: Date?; public let restTotal: TimeInterval?
    }
    public let dayName: String
}
public enum WidgetTick: Codable, Equatable, Sendable { case reminder(key: String), supplement(day: String, daypart: String), checkin(moment: String, index: Int, value: Int) }
public enum WidgetTickQueue { public static func append(_ t: WidgetTick, at url: URL) throws; public static func drain(at url: URL) throws -> [WidgetTick] }
public enum SharedContainer { public static let group = "group.io.mrkuhne.boop"; public static func url(userKey: String) -> URL? }
```
- [ ] **Step 1:** Failing tests: `snapshotRoundTrips`, `contentStateUnderFourKB` (worst-case 60-char exercise name encoded < 4096 bytes), `queueAppendThenDrainEmpties`, `drainIsAtomicUnderTwoWriters`.
- [ ] **Step 2:** Run `-only-testing:BoopSharedTests`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(boop): BoopShared — widget snapshot, workout activity, tick queue (mezo-r36n9.172)`.

### Task 13: The workout card (Live Activity)

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Train/WorkoutActivityState.swift`, `ios/BoopKit/Sources/BoopCore/Train/WorkoutSetItem.swift` (extracted from `EdzesRoom.enqueueSet` `:708-722`), `ios/Boop/Edzes/WorkoutActivityController.swift`, `ios/Boop/Edzes/WorkoutLiveIntents.swift`, `ios/BoopWidgets/WorkoutLiveActivity.swift`
- Modify: `ios/Boop/Edzes/EdzesRoom.swift` (`enqueueSet` calls the extracted builder; start/update/end through the controller at `:570`, `:610`), `ios/Boop/Edzes/EdzesStore.swift` (`update`/`endWorkout`/`attach` notify the controller), `ios/Boop/RootView.swift` (launch: `endLeftovers`; sign-out: `endAll`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/WorkoutActivityStateTests.swift`, `ios/BoopTests/WorkoutLiveIntentsTests.swift`

**Interfaces — Produces:**
```swift
public func workoutActivityState(_ s: WorkoutSession, now: Date) -> WorkoutActivityAttributes.ContentState?   // nil = nothing to show
public func workoutSetItem(session: WorkoutSession, exerciseId: UUID, set: SessionSet, date: String) -> OutboxItem?
@MainActor final class WorkoutActivityController {
    func sessionChanged(_ s: WorkoutSession?, dayName: String) async   // start / update / end; staleDate = restEndsAt
    func endLeftovers(running: Bool) async
    func endAll() async
}
@MainActor enum LiveWorkoutBridge {   // the room registers while alive; else the intents work on workout.json + the per-user Outbox
    static var live: ((inout WorkoutSession) -> Void) -> Void
}
struct LogPlannedSetIntent: LiveActivityIntent   // „Kész”: session.log(kg: prefill.kg, reps: prefill.reps, rir: prefill.rir) + enqueue workoutSetItem
struct AddRestIntent: LiveActivityIntent         // „+15 mp”: session.addRest(15)
struct SkipRestIntent: LiveActivityIntent        // „Tovább”: session.skipRest()
```
Each intent saves the session, updates the activity and calls `RestEndSignal.sessionChanged`. Views per spike shot 10: lock screen card (header mono „EDZÉS · 7 / 16 SOROZAT”, serif exercise, „3. sorozat a 4-ből”, Outfit „80 kg × 8”, `Text(timerInterval:countsDown:)` + `ProgressView(timerInterval:)` in the Mozgás glow), Dynamic Island compact (dot + countdown or „3/4”), expanded = card, minimal = dot; `isStale` → „Lejárt a pihenő”. The set phase shows one button „Kész · 80 kg × 8”; rest shows „+15 mp” / „Tovább”.

- [ ] **Step 1:** Failing tests: `setPhaseCarriesTarget`, `restPhaseCarriesRestEnd`, `debriefShowsSetPhaseOfNextExercise` (or `.set` of current with done counts — pin whichever the player shows), `finishedSessionIsNil`, `setItemMatchesTheRoomsOldPayload` (byte-equal to the payload `enqueueSet` built before), `killedAppIntentLogsFromTheFile` (no live bridge → `workout.json` updated + outbox item), `liveBridgeIsPreferred`, `addRestRearmsTheSignal`, `signOutEndsTheActivity`.
- [ ] **Step 2:** Run both files. Expected: FAIL.
- [ ] **Step 3:** Implement controller, intents, extension views.
- [ ] **Step 4:** Re-run; simulator check of the Lock Screen and Dynamic Island with a running workout (`-preview shell` + start a workout), screenshot vs spike shot 10.
- [ ] **Step 5:** Commit `feat(boop): the workout on the Lock Screen and Dynamic Island (mezo-r36n9.172)`.

### Task 14: Widget snapshot writer (app)

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Morning/WidgetSnapshotBuilder.swift`, `ios/Boop/Emlekeztetok/WidgetSnapshotWriter.swift`
- Modify: trigger points — `MorningStore` brief loaded, `ReminderStore.changes`, meal logged, workout started/ended, check-in saved (`RitmusEnvironment`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/WidgetSnapshotBuilderTests.swift`

**Interfaces — Produces:** `public func widgetSnapshot(rows: [DayPlanRow], tomorrow: [DayPlanRow], reminders: ReminderFile, checkin: WidgetSnapshot.Checkin?, now: Date, calendar: Calendar) -> WidgetSnapshot` (consumes `DayPlan.rows(brief)` — `BoopCore/Morning/DayPlan.swift:51-96`); writer writes `<SharedContainer.url(userKey:)>/widget.json` atomically then `WidgetCenter.shared.reloadAllTimelines()`.

- [ ] **Step 1:** Failing tests: `pastRowsDropped`, `tomorrowFirstAppendedWhenTodayEmpty`, `remindersCarryDoneState`, `supplementRowCarriesDaypart`.
- [ ] **Step 2–4:** Run (FAIL) → implement → run (PASS).
- [ ] **Step 5:** Commit `feat(boop): widget snapshot written on every relevant change (mezo-r36n9.172)`.

### Task 15: The four widgets + the tick queue

**Files:**
- Create: `ios/BoopWidgets/{Provider,NextWidget,DayWidget,CheckinWidget,LockWidget,WidgetFaces,WidgetIntents}.swift`, `ios/Boop/Emlekeztetok/WidgetTickDrain.swift`
- Modify: `ReminderStore` file URL → `SharedContainer.url(userKey:)/reminders.json` with a one-time move from the per-user folder (Task 3 seam); drain on launch, foreground and background wake (`BackgroundSyncHost`)
- Test: `ios/BoopKit/Tests/BoopSharedTests/TimelineTests.swift`, `ios/BoopTests/WidgetTickDrainTests.swift`

**Interfaces — Produces:**
```swift
public func timelineDates(_ s: WidgetSnapshot, now: Date) -> [Date]          // now + every item/reminder time today, then midnight
public func widgetView(_ s: WidgetSnapshot?, at: Date, calendar: Calendar) -> WidgetContent   // .normal / .stale(remindersOnly) / .empty(tomorrowFirst)
@MainActor enum WidgetTickDrain { static func run(queue: URL, reminders: ReminderStore, env: RitmusEnvironment?) async }   // reminder → tick; supplement → captureSupplementTick; checkin → the existing check-in capture
```
Staleness (spec §7.2): snapshot `day` ≠ today, or `writtenAt` older than today's first item → reminders only + „Nyisd meg a Boopot a mai tervhez”. Empty → „Mára nincs több teendő” + tomorrow's first item. Widget intents (`ToggleReminderIntent`, `TakeSupplementIntent`, `AnswerCheckinIntent`) run in the extension: append to the queue, rewrite the snapshot row as done/answered, reload timelines. Faces per spike shot 08–09 (sky gradient image per hue, Outfit numbers, serif titles, mono labels; the lock-screen accessory rectangular „BOOP · KÖVETKEZŐ” + inline).

- [ ] **Step 1:** Failing tests: `timelineHasAnEntryPerItem`, `staleSnapshotShowsRemindersOnly`, `yesterdaySnapshotIsStale`, `emptyDayShowsTomorrowFirst`, `drainTicksReminderAndQueuesSupplement`, `drainIsIdempotent` (same tick twice → one tick, one outbox item), `drainSkipsOtherUsersQueue`.
- [ ] **Step 2–4:** Run (FAIL) → implement → run (PASS); simulator: add each widget, screenshot vs spike shots 08–09, also stale/empty.
- [ ] **Step 5:** Commit `feat(boop): Következő, Mai nap, napközbeni kérdés and Lock Screen widgets (mezo-r36n9.172)`.

### Task 16: Step 2 ship

Same as Task 10 (gates → docs incl. `boop-ios.md` *Widgetek és edzéskártya*, handbook pages, `_funkciok.json` if a server feature reaches the app (none expected), decisions/releases → review → rebase + merge + push + codemap + ff primary → install → walk-through: all four widgets live, a stale morning, a widget tick sent after the app opens, the workout card with Kész / +15 mp / Tovább locked, a killed-app Kész, leftover cleanup → Notion `check` 0 → Hungarian report). Then delete the own simulator (`xcrun simctl delete D503B185-C184-47BD-A7EB-37BAE7AFF2F9`) and close `mezo-r36n9.172`.

## Kész, ha…

- [ ] **Probe (Task 1):** the alarm rang on the locked, silenced phone; „Kész” worked without unlocking — recorded in bd.
- [ ] **Owner sees (step 1):** spike shots 01–04 and 11 match; Ma fold hidden when empty; permission-denied, limit and expiry lines shown; smallest width + reduced motion checked; no emoji, no "Mezo".
- [ ] **Alarms:** Ébresztő rings with the app killed, locked, silent; „Leállítom” leaves it open; „Bevettem” reaches Étel and the server (one intake row, no duplicate on replay); early tick cancels; survives a reinstall.
- [ ] **Notifications:** Értesítés with „Kész” / „10 perc múlva”; Boop's built-in reminders editable, defaults unchanged.
- [ ] **Rest end:** both modes on a locked phone; nothing in the foreground.
- [ ] **Step 2 probe:** App Group / keychain result recorded; branch taken as §7.1 says.
- [ ] **Owner sees (step 2):** four widgets as shots 08–09 with live data, stale and empty states; workout card + Dynamic Island as shot 10 with working buttons, also from a killed app; no leftover card after finish/sign-out.
- [ ] **Parity:** Étel supplement tick, Ma, the player, the "+" sheet and the existing reminders behave as before apart from the spec.
- [ ] **Gates:** BoopKit + Boop `xcodebuild test` green; `lint-docs` 0/0; codemap regenerated after each merge.
- [ ] **Docs:** `boop-ios.md`, `ios/README.md`, handbook pages, decisions D1–D8, releases; Notion `check` exits 0.
- [ ] **Shipped:** both steps merged to main and installed on the phone and walked through with the owner.
