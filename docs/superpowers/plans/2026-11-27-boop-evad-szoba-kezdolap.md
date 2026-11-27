# Boop: barless home ring + Évad room — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The home loses its bottom bar (ten orbs incl. a violet Évad orb, centre → Boop chat, Nap room Ma · Napok, one floating „+"), then Évad becomes a ring room (Most · Hét · Terv · Kísérlet) with a guided Sunday review, and the weekly menu + list move into Étel.

**Architecture:** Two releases on one spec. Step 1 replaces the spine (`ShellTab`, `NKSpineBar`, the panorama) with one `BoopDestination` routed through `RitmusRouter` into the existing `KezdolapView` zoom; every `openPlace` caller becomes `openDestination`. Step 2 builds `EvadRoom` on `NKAreaPage` from pure BoopCore builders (week score, day dots, review window, reminder plan, wall targets, season weeks, year bracket) over data the app already reads (`EvadClient.adherence`, `KapacitasStore`, `YearPlanModel`, `EvadMenuStore`); old Évad tab code is deleted. No backend change.

**Tech Stack:** Swift 6.2, SwiftUI (iOS 26), Swift Testing, BoopKit (BoopCore · BoopDesign), `ServerCache`, local notifications (`ReminderCenter`).

**Spec:** `docs/superpowers/specs/2026-11-27-boop-evad-szoba-kezdolap-design.md` (decisions #124–#130 in `docs/superpowers/research/boop-standalone/14-decisions.md`). Spike (visual direction, throwaway): branch `spike/boop-evad-szoba` @ `58e2d7126` — `ios/Boop/Spike/EvadSpike*.swift`, glyph drawings in its `BoopDesign/Napkelte/Glass.swift`, screenshots `docs/superpowers/specs/assets/evad-szoba/spike/*.png`.

**Issue:** `mezo-r36n9.196`. Step 1 branch `feat/boop-evad-szoba` (this worktree); step 2 branch `feat/boop-evad-szoba-2` cut from `origin/main` after step 1 lands. Simulators: create your own (`xcrun simctl create "Boop · r36n9.196" "iPhone 17 Pro Max"` and `"Boop · r36n9.196 SE" "iPhone SE (3rd generation)"`), delete them at the end.

## Open points (read before Task 1)

1. **No backend change is needed.** Every read exists: `EvadClient.adherence(from:to:)` (per-day + summary), `overview()`, `KapacitasStore.loadWeek/season`, `PlanClient.activeYearPlan()` via `YearPlanModel`, `EvadMenuStore.recipes()/putRecipes`. The review's done state stays on the phone (spec §11.4).
2. **Recipe toggle writes a full set.** `putRecipes(id:recipeIds:)` replaces the season's whole allowed set, so a per-recipe toggle is a read-modify-write; Task 10 serialises it in `EvadMenuStore`. Étel `Recipe.id` is a `UUID`, `EvadRecipeOption.id` a `String` — match on `uuidString.lowercased()` (verify against the preview transport and one live row before Task 16).
3. **„Respects the existing notification settings"** (spec §4.3): there is no weekly-review switch today; this plan arms the Sunday notification only when notification permission is already granted (never prompts) and adds no new setting. If the owner wants an off switch, it is a follow-up.
4. Decisions #124–#130 are already rows in `docs/boop-handbook/_dontesek.json` (keys `d-2026-11-27-evad-szoba`, `-menu-etelbe`, `-kezdolap-sav-nelkul`, `-naplo-nap-szobaba`, `-ev-az-evadban`, `-menu-recept-jeloles`, `-evad-szoba-proba`) and the ticket row is in `_jegyek.json`; Task 6 only checks them.

## Global Constraints

- Hungarian, jargon-free visible strings; never emoji; never "Mezo" in a visible string.
- New glyphs are drawn in `NKGlyph` (`Canvas`, 64-unit box, the kit stroke) — no SF Symbols for new glyphs (chevrons on existing back buttons stay as they are).
- No pull-to-refresh anywhere (owner rule `mezo-r36n9.191`); the head's „Frissítés" action reloads.
- Sheets and full-screen covers are presented at page level (`docs/features/boop-ios.md` §9), never inside scroll content; no `async let` fans — sequential awaits or `Task {}` handles.
- A number is never invented: no season, nothing judged, or no data → „–" (orb, hero), never 0.
- `Hue.evad` is appended **last** (rawValue 8) and every rawValue-indexed array (`name`, `glow`, `top`) grows with it. Exact values (decision #130): name `"Évad"`, sky `0x2A1242 · 0x8A4FB8 · 0xF4B48E`, orb `0x2E0F3E · 0x9440AE · 0xF4B48E · 0xE7A2E6`, glow `0xC77DE0`, top `0x2A1242`. `.forma` must never identify the Évad room again (`let evadHue: Hue = .evad`).
- Ring order (clockwise from top): `nap, alvas, etel, edzes, energia, evad, suly, forma, penz, level`. Ring side `min(w − 6, h × (w < 380 ? 0.60 : 0.56))`; orb size `side < 360 ? 44 : side < 400 ? 50 : 54`; centre orb `side < 360 ? 104 : 122` (spike values).
- Floating „+": 58 pt glass circle, `plus-ink` 22 pt, a11y „Rögzítés", trailing 20, bottom 18 on the ring / 78 in a room (above the room bar's right end); a room page's end spacer grows by 64 pt while the „+" floats so row ends can scroll clear of it (decision #130 fix). Opens the existing „Mit rögzítesz?" sheet unchanged. Hidden on the Boop chat.
- Évad bar: **Most · Hét · Terv · Kísérlet** + Boop; glyphs `most-ink`, `het-ink`, `terv-ink`, `kiserlet-ink`; room glyph `evad-ink`; Nap room bar **Ma · Napok** + Boop, Napok glyph `napok-ink`; review glyph `atnezes-ink`.
- Sunday review window: **Sunday 18:00 – Monday 23:59, device time zone**; notification at Sunday 18:00 local, one per week, only while a season exists.
- Szabályok page and the recipe toggle keep today's look (decision #130).

## Review Focus

1. **Nothing to judge yet** (Monday morning, a fresh season, no season at all) → the Évad orb and the Most hero show „–" and the early sentence, never „0" — Task 2 `weekScoreIsNilWhenNothingIsJudged`, `mondayMorningHasNoRange`; Task 3 `evadOrbWithoutSeasonIsDash`.
2. **Window edges and time zone**: Sun 17:59 / 18:00, Mon 23:59, Tue 00:00, and a DST-change Sunday → only the in-window instants open the review, keyed by the right Monday — Task 9 `windowEdges`, `windowAcrossDST`.
3. **„Később" half-way changes nothing**: leaving on any page never marks the week done and never sends an accept — Task 9 `leavingNeverMarksDone`; Task 15 asserts page 3 calls only `KapacitasStore.accept/decline` on an explicit tap.
4. **Two quick recipe toggles, or a toggle offline** → both changes survive (the second write carries the first), offline leaves the set unchanged with „Ehhez internet kell." — Task 10 `twoTogglesKeepBoth`, `offlineToggleChangesNothing`.
5. **An old stored place or a notification tap while a room is open** → lands in the right room (Napló → Nap › Napok, Boop → chat, terv → Évad), never an empty home or two presentations at once — Task 5 `restoredOldPlacesMapToRooms`, `reviewRouteOpensTheFlow`.

---

# Step 1 — the barless home

### Task 1: The Évad world, the new glyphs, the floating „+" (BoopDesign)

**Files:**
- Modify: `ios/BoopKit/Sources/BoopDesign/Napkelte/Tokens.swift:67-134` (`Hue.evad`)
- Modify: `ios/BoopKit/Sources/BoopDesign/Napkelte/Glass.swift` (`NKGlyph`: `evad-ink most-ink het-ink terv-ink kiserlet-ink napok-ink atnezes-ink`, added to `outlined`; drawings from the spike commit's `Glass.swift`)
- Modify: `ios/BoopKit/Sources/BoopDesign/Napkelte/Area.swift:141-150` (`NKAreaTab.glyph: String?`), `:362-385` (`NKAreaBar.glyph` cases `Most`, `Kísérlet`, `Napok`, `Évad`; bar uses `t.glyph ?? Self.glyph(t.name)`), `NKAreaPage` end spacer `+ (floatingPlus ? 64 : 0)`
- Create: `ios/BoopKit/Sources/BoopDesign/Napkelte/FloatingPlus.swift`
- Test: `ios/BoopKit/Tests/BoopDesignTests/NapkelteTokensTests.swift`, `ios/BoopKit/Tests/BoopDesignTests/NapkelteFloatingPlusTests.swift`

**Interfaces:**
- Produces: `Hue.evad`; `NKAreaTab.init(_ name: String, badge: Int = 0, dot: Bool = false, glyph: String? = nil)`; `public struct NKFloatingPlus: View { public init(raised: Bool, action: @escaping @MainActor @Sendable () -> Void) }`; `EnvironmentValues.nkFloatingPlus: Bool` (default `false`, read by `NKAreaPage`).

- [ ] **Step 1: Write the failing tests**

```swift
@Test func hueNamesAndOrder() {   // existing test, last element added
    #expect(Hue.allCases.map(\.name) == ["Forma", "Alvás", "Mozgás", "Fuel", "Pulzus", "Pénz", "Levél", "Súly", "Évad"])
}
@Test func evadWorldIsEveningViolet() {
    #expect(rgb(Hue.evad.glow) == (0xC7, 0x7D, 0xE0))
    #expect(Hue.evad.orb.count == 4 && Hue.evad.sky.count == 3)
    #expect(rgb(Hue.evad.top) == (0x2A, 0x12, 0x42))
}
@Test func tabGlyphOverrideWins() {
    #expect(NKAreaTab("Hét", glyph: "het-ink").glyph == "het-ink")
    #expect(NKAreaBar.glyph("Most") == "most-ink" && NKAreaBar.glyph("Kísérlet") == "kiserlet-ink")
    #expect(NKAreaBar.glyph("Napok") == "napok-ink")
    #expect(NKAreaBar.glyph("Hét") == "chart-deep")   // Étel/Alvás keep theirs
}
@Test func newGlyphsAreDrawn() {
    for g in ["evad-ink", "most-ink", "het-ink", "terv-ink", "kiserlet-ink", "napok-ink", "atnezes-ink"] {
        #expect(NKGlyph.outlined.contains(g))
    }
}
@Test func floatingPlusRenders() { #expect(render(NKFloatingPlus(raised: true) {}, height: 140) != nil) }
```

- [ ] **Step 2: Run to verify it fails**

Run: `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer; cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath ../build/kit -only-testing:BoopDesignTests 2>&1 | tail -20`
Expected: build error `type 'Hue' has no member 'evad'`.

- [ ] **Step 3: Implement** the `Hue` case with the Global Constraints values (`roomSky`/`roomTop` default branch), the seven glyphs (copy the spike drawings verbatim), the `glyph` override, `NKFloatingPlus` (spike `SpikePlus` geometry, a11y „Rögzítés"), and the `nkFloatingPlus` spacer.
- [ ] **Step 4: Run** the same command. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Commit** `feat(boop): the Évad colour world, seven new glyphs and the floating „+" (mezo-r36n9.196)`

### Task 2: This week's adherence and the Évad orb's number (BoopCore)

**Files:**
- Modify: `ios/BoopKit/Sources/BoopCore/Evad/EvadLogic.swift` (pure functions)
- Modify: `ios/BoopKit/Sources/BoopCore/Evad/EvadStore.swift` (the week read + cache)
- Test: `ios/BoopKit/Tests/BoopCoreTests/EvadWeekTests.swift` (`@Suite struct EvadWeekTests`), `ios/BoopKit/Tests/BoopCoreTests/EvadStoreTests.swift`

**Interfaces:**
- Produces:
```swift
/// Equal weight over the parts that have something to judge (food inBand/judged, sessions done/planned, nights ok/judged); nil when none.
public func evadWeekScore(_ a: EvadAdherence) -> Int?
/// Monday → yesterday of `now`'s week (yyyy-MM-dd); nil on Monday (nothing lived yet).
public func evadMostRange(now: Date, calendar: Calendar = .current) -> (from: String, to: String)?
// EvadStore
public private(set) var week: EvadAdherenceResponse?
public private(set) var weekAge: TimeInterval?
public var weekScore: Int? { empty ? nil : week.flatMap { evadWeekScore($0.summary) } }
public func loadWeek(now: Date = Date(), force: Bool = false) async   // cache endpoint "evad/adherence-week", key = from
```

- [ ] **Step 1: Write the failing tests**

```swift
@Test func weekScoreAveragesTheJudgedParts() {
    let a = EvadAdherence(foodInBand: 3, foodJudged: 4, sessionsDone: 1, sessionsPlanned: 2, nightsOk: 4, nightsJudged: 4, excusedDays: 0)
    #expect(evadWeekScore(a) == 75)          // (0.75 + 0.5 + 1.0) / 3
}
@Test func weekScoreLeavesOutAnEmptyPart() {
    let a = EvadAdherence(foodInBand: 2, foodJudged: 2, sessionsDone: 0, sessionsPlanned: 0, nightsOk: 1, nightsJudged: 2, excusedDays: 1)
    #expect(evadWeekScore(a) == 75)          // (1.0 + 0.5) / 2
}
@Test func weekScoreIsNilWhenNothingIsJudged() {
    #expect(evadWeekScore(EvadAdherence(foodInBand: 0, foodJudged: 0, sessionsDone: 0, sessionsPlanned: 0, nightsOk: 0, nightsJudged: 0, excusedDays: 2)) == nil)
}
@Test func mondayMorningHasNoRange() { #expect(evadMostRange(now: date("2026-11-23T08:00"), calendar: budapest) == nil) }
@Test func thursdayRangeIsMondayToWednesday() {
    #expect(evadMostRange(now: date("2026-11-26T10:00"), calendar: budapest)! == ("2026-11-23", "2026-11-25"))
}
// EvadStoreTests
@Test func weekReadIsCachedAndServedOffline()   // first read ok → second throws .offline → same week, weekAge != nil
@Test func weekScoreIsNilWithoutSeason()        // overview 404 (empty) + a week with judged days → weekScore == nil
```

- [ ] **Step 2: Run** `… -only-testing:BoopCoreTests/EvadWeekTests -only-testing:BoopCoreTests/EvadStoreTests` (BoopKit command from Task 1). Expected: FAIL, `cannot find 'evadWeekScore' in scope`.
- [ ] **Step 3: Implement** the two functions and the store read (`client.adherence(from:to:)`, same offline/cache rules as `load`, `maxAge` 14 d; Monday → `week = nil`, no call).
- [ ] **Step 4: Run** again. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Commit** `feat(boop): this week's adherence and the Évad orb's number (mezo-r36n9.196)`

### Task 3: Ten orbs — the Évad orb opens today's Évad page in a room frame

**Files:**
- Modify: `ios/Boop/Kezdolap/Area.swift` (`case evad` between `energia` and `suly`; `name "Évad"`, `world .evad`, `live true`; `ringItem(…, evad: Int? = nil)`)
- Modify: `ios/Boop/Kezdolap/KezdolapView.swift:206-215` (ring side/orb/centre sizes per Global Constraints; `@Environment(EvadStore.self)`; `loadNumbers` adds `await evad?.loadWeek(force: force)` after the Súly read; `-previewHome evad`)
- Modify: `ios/Boop/Nap/NapView.swift:71-90` (drill `hue == .evad → EvadPage()`), `ios/Boop/Nap/AreaRoom.swift:30-85` (`.evad` cases: tabs `["Most","Hét","Terv","Kísérlet"]`, name „Évad", glyph `evad-ink`), `ios/Boop/Nap/MaiView.swift:20` (`metricKey(for:)`: `.evad → .forma`)
- Modify: `ios/Boop/Evad/EvadPage.swift:7` (`let evadHue: Hue = .evad`), `EvadPage.season/waiting/EvadEmpty` pass `onBack: closeRoom` (`@Environment(\.closeRoom)`) — temporary room frame, removed in Task 17
- Test: `ios/BoopTests/KezdolapRingTests.swift`, `ios/BoopTests/MaiCopyTests.swift`

**Interfaces:**
- Consumes: `EvadStore.weekScore` (Task 2), `Hue.evad` (Task 1).
- Produces: `Area.evad`; `func ringItem(_ area: Area, brief: Brief?, foodDay: FoodDay? = nil, penz: PenzAllowance? = nil, suly: Int? = nil, evad: Int? = nil) -> NKRingItem`.

- [ ] **Step 1: Write the failing tests**

```swift
@Test func ringHasTenAreasWithEvadBetweenEnergiaAndSuly() {
    #expect(Area.allCases.map(\.name) == ["Nap", "Alvás", "Étel", "Edzés", "Energia", "Évad", "Súly", "Forma", "Pénz", "Levél"])
    #expect(Area.evad.world == .evad && Area.evad.hue == nil && Area.evad.live)
}
@Test func evadOrbShowsTheWeekScore() {
    let i = ringItem(.evad, brief: nil, evad: 78)
    #expect(i.display == "78" && abs(i.level - 0.78) < 0.001 && i.live)
}
@Test func evadOrbWithoutSeasonIsDash() { #expect(ringItem(.evad, brief: nil).display == "–") }
// MaiCopyTests: Hue.allCases.count == Hue.metrics.count + 4
```

- [ ] **Step 2: Run** `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer; cd ios && xcodebuild test -project Boop.xcodeproj -scheme Boop -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath build/app -only-testing:BoopTests/KezdolapRingTests 2>&1 | tail -20`. Expected: build error `type 'Area' has no member 'evad'`.
- [ ] **Step 3: Implement** per Files.
- [ ] **Step 4: Run** again. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Verify on the simulator**: build, install, `xcrun simctl launch <udid> io.mrkuhne.boop -preview shell` on Pro Max and SE; screenshot `xcrun simctl io <udid> screenshot docs/superpowers/specs/assets/evad-szoba/built/01-ring{,-se}.png`. Ten names never touch a neighbour on SE; `-previewHome evad` opens the Évad page with a back button that returns to the ring.
- [ ] **Step 6: Commit** `feat(boop): the tenth orb — Évad on the ring, this week's adherence (mezo-r36n9.196)`

### Task 4: The Nap room — Ma · Napok

**Files:**
- Create: `ios/Boop/Nap/NapRoom.swift` (`NapTab`, `napRoomHead`, `NapRoomPage`)
- Create: `ios/Boop/Naplo/NapokTab.swift` (the day list body extracted from `NaploView.days(_:)` + empty row; the „MINTÁK" placeholder dropped — it says nothing)
- Modify: `ios/Boop/Nap/MaiView.swift:150-178` (the `NavigationStack` root becomes `NapRoomPage` instead of `NKTabPage`; Ma tab = `KimeloBanner` + `below(ctx)`; Napok = `NapokTab`; the opened day's `NaploDayDetail` sheet hangs at `MaiView` level), `ios/Boop/Nap/NapView.swift` (passes `initialNapTab`)
- Delete: `ios/Boop/Naplo/NaploView.swift` (its `NaploDayDetail` and rows stay where they live)
- Test: `ios/BoopTests/NapRoomTests.swift`

**Interfaces:**
- Produces:
```swift
enum NapTab: String, CaseIterable { case ma = "Ma", napok = "Napok" }
/// Head words: Ma → (kezdolapLine(brief), "A napod N %-a foglalt." or "" without calendar); Napok → ("Két hét visszafelé",
/// "Minden nap egy sor: mit ettél, edzettél, hogy aludtál. Egy napra koppintva megnyílik.")
func napRoomHead(_ brief: Brief?, tab: NapTab) -> (headline: String, sentence: String)
struct NapRoomPage<Ma: View, Napok: View>: View   // NKAreaPage(hue: .alvas, name: "Nap", eyebrow: "Nap · \(dayHeadline(brief.date))" | "Nap · az elmúlt 14 nap",
                                                   // level: dayFullness/100, display, tabs [Ma, Napok(glyph "napok-ink")], onBack, onAsk)
```
- `MaiView.init` gains `initialNapTab: NapTab = .ma`.

- [ ] **Step 1: Write the failing tests** — `napHeadMaSaysHowFullTheDayIs` (brief with 4/10 busy slots → sentence „A napod 40 %-a foglalt."), `napHeadWithoutCalendarHasNoInventedPercent` (no slots → sentence ""), `napHeadNapokIsFixedCopy` (exact strings above), `napTabsAreMaAndNapok` (`NapTab.allCases.map(\.rawValue) == ["Ma", "Napok"]`).
- [ ] **Step 2: Run** `… -only-testing:BoopTests/NapRoomTests` (app command, Task 3). Expected: FAIL, `cannot find 'napRoomHead' in scope`.
- [ ] **Step 3: Implement** per Files; drills pushed from Ma (lens door, timeline stations) still push onto the stack; every `NapView` empty state keeps its `onBack: onHome`.
- [ ] **Step 4: Run** again. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Verify**: `-preview shell -previewHome nap` and `-previewHome napok` (added in Task 5; until then switch the tab by tap) — screenshots `built/03-nap-ma.png`, `built/04-nap-napok.png`; `-previewEmpty YES` shows a back button.
- [ ] **Step 6: Commit** `feat(boop): the Nap room — Ma and Napok tabs (mezo-r36n9.196)`

### Task 5: The spine goes — destinations, centre orb → chat, floating „+"

**Files:**
- Create: `ios/Boop/Shell/BoopDestination.swift`
- Modify: `ios/Boop/Shell/ShellView.swift` (remove `ShellTab`, `shellPanels`, `NKBackdropPanorama`, `select`, `page(_:)`, `homeReset`, `-previewTab`/`-previewSwitch`; body = `KezdolapView` + the page-level sheets/covers unchanged + `NKFloatingPlus` overlay (`raised: roomOpen`, hidden on `.chat`); `OpenPlaceKey` → `OpenDestinationKey`; `handle(.area(hue))` → `router.go(.room(RoomEntry(hue)))`; `@SceneStorage("tab")` read once through `homeDestination(restored:)` then cleared to `""`)
- Modify: `ios/Boop/Ritmus/RitmusRouter.swift` (`room: Hue?` → `destination: BoopDestination?`, `go(_:)`, `takeDestination()`; `review: Bool`, `openReview()` reserved for Task 15)
- Modify: `ios/Boop/Kezdolap/KezdolapView.swift` (`KezdolapRoute` = `.nap(NapTab)`, `.room(RoomEntry)`, `.chat`; centre orb and the line → `.chat` (a11y „Boop · beszélgetés megnyitása"; caption „KÉRDEZD BOOPOT"); Nap orb → `.nap(.ma)`; remove `quickDoors`, `doors`, `kezdolapHomeReset`; observe `router.destination`; `-previewHome nap|napok|chat|evad|…`)
- Modify: `ios/Boop/BoopChat/BoopTabView.swift` (`var onBack: (@MainActor @Sendable () -> Void)? = nil` → back button in `head`; composer bottom padding `typing ? 10 : 24`)
- Delete: `ios/BoopKit/Sources/BoopDesign/Napkelte/SpineBar.swift`, `ios/BoopKit/Tests/BoopDesignTests/NapkelteSpineTests.swift`, `ios/BoopTests/ShellTabTests.swift`, `ios/Boop/Shell/PlacePage.swift` if unused after Task 4
- Modify every `openPlace` caller → `openDestination`: `Edzes/EdzesRoom.swift:132,188,429,842,846,864,954,960`, `Etel/EtelRoom.swift:846,853`, `Penz/PenzRoom.swift:126,257-288`, `Suly/SulyRoom.swift:44-49`, `Level/LevelRoom.swift:52,77,81`, `Nap/MaPhases.swift:444`, `Nap/DaySheet.swift:191`, `Nap/NapView.swift:37`, `Nap/AreaRoom.swift:141-425`, `Nap/MaWall.swift:237`, `Evad/EvadPage.swift`, `Evad/EvadTeher.swift:37` — `.boop → .chat`, `.terv → .room(RoomEntry(.evad))` (the wall keeps setting `evad.pendingSub` first; Task 17 replaces it)
- Test: `ios/BoopTests/BoopDestinationTests.swift`, `ios/BoopTests/CaptureSheetTests.swift`

**Interfaces:**
- Produces:
```swift
struct RoomEntry: Equatable { let hue: Hue; var tab: String? = nil; var sub: String? = nil; init(_ hue: Hue, tab: String? = nil, sub: String? = nil) }
enum BoopDestination: Equatable { case home, nap(NapTab), room(RoomEntry), chat }
/// The pre-barless scene key: "ma"/unknown → .home, "naplo" → .nap(.napok), "boop" → .chat, "terv" → .room(.evad).
func homeDestination(restored raw: String) -> BoopDestination
extension EnvironmentValues { var openDestination: @MainActor @Sendable (BoopDestination) -> Void }
// RitmusRouter
var destination: BoopDestination?; func go(_ d: BoopDestination); func takeDestination() -> BoopDestination?
```
- Rooms receive `RoomEntry.tab/sub` through `NapView(initialRoom:)` → `MaiView` → the `drill` closure (`EtelRoom(tab:)`, later `EvadRoom(entry:)`).

- [ ] **Step 1: Write the failing tests**

```swift
@Test func restoredOldPlacesMapToRooms() {
    #expect(homeDestination(restored: "ma") == .home)
    #expect(homeDestination(restored: "naplo") == .nap(.napok))
    #expect(homeDestination(restored: "boop") == .chat)
    #expect(homeDestination(restored: "terv") == .room(RoomEntry(.evad)))
    for old in ["Nap", "Edzés", "Fuel", "", "x"] { #expect(homeDestination(restored: old) == .home) }
}
@MainActor @Test func routerHandsTheDestinationOnce() {
    let r = RitmusRouter(); r.go(.chat)
    #expect(r.takeDestination() == .chat && r.takeDestination() == nil)
}
// CaptureSheetTests: replace homeDoorsAreTheFiveFrequentOnes with
@Test func everyFormerHomeDoorIsOnTheSheet()   // the five picks .meal(.pick,""), .quick(.water), .quick(.weight), .cover(.checkin), .quick(.journal) are each reachable from CaptureSheet
```

- [ ] **Step 2: Run** `… -only-testing:BoopTests/BoopDestinationTests -only-testing:BoopTests/CaptureSheetTests`. Expected: FAIL, `cannot find 'homeDestination' in scope`.
- [ ] **Step 3: Implement** per Files. A destination asked while a route is up closes it first (existing `openArea` 0.5 s rule, generalised); `.home` closes the route; the „+" sheet's „Edzés indítása" → `.room(RoomEntry(.mozgas))`.
- [ ] **Step 4: Run** the full app suite (Task 3 command without `-only-testing`). Expected: `** TEST SUCCEEDED **`; `git grep -n "openPlace\|ShellTab\|NKSpineBar" ios/` empty.
- [ ] **Step 5: Verify**: `-preview shell` (ring, no bar, „+" bottom-right; tap → „Mit rögzítesz?"), `-previewHome chat` (back returns to the ring, no „+"), `-previewHome etel` („+" raised above the bar's right end; the last card's row end scrolls clear of it), reduced motion on (`xcrun simctl ui <udid> reduce_motion on` or Accessibility settings): screenshots `built/02-home-se.png`, `built/05-chat.png`, `built/06-room-plus.png`.
- [ ] **Step 6: Commit** `feat(boop): the home without a bar — destinations, centre orb opens Boop, floating „+" (mezo-r36n9.196)`

### Task 6: Step 1 docs and mirror

**Files:**
- Modify: `docs/boop-handbook/01-alapok/kezdolap.md` (ten orbs, no bar, centre → Boop, „+"), `01-alapok/navigacio.md` (rooms only, no places), `01-alapok/gyors-rogzites.md` (doors gone, floating „+"), `03-naplo/napok-lista.md` (now Nap › Napok), `_funkciok.json` (Évad betartás note: „a kezdőlap Évad gömbje a heti betartást mutatja")
- Modify: `docs/features/boop-ios.md` (§2 home + Nap room + chat, §9 „one destination type, no spine" gotcha, §10 key files), `ios/README.md` (flags: remove `-previewTab`/`-previewSwitch`; add `-previewHome nap|napok|chat|evad`), `docs/superpowers/specs/2026-11-13-boop-kezdolap-design.md` (one-line superseded note)

- [ ] **Step 1: Write the docs** (Hungarian business language in the handbook; format per `docs/boop-handbook/README.md`).
- [ ] **Step 2: Run** `node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs`. Expected: `0 errors, 0 stale`.
- [ ] **Step 3: Commit** `docs(boop): handbook, decisions #124–#130 and flags for the barless home (mezo-r36n9.196)`

### Task 7: Step 1 — *Kész, ha…*, gates, merge, install, live check

- [ ] **UX/UI bar:** largest Dynamic Type (`xcrun simctl ui <udid> content_size accessibility-extra-extra-extra-large`) on the ring (names still readable or wrapping, never clipped), the Nap room and the chat; VoiceOver labels: every orb reads „<név>, <szám>" or „<név>, nincs adat", centre „Boop · beszélgetés megnyitása", „+" „Rögzítés", the Napok tab; SE width; reduced motion (ring fades, no zoom); offline (`-previewOffline YES`) and empty (`-previewEmpty YES`) Nap states have a back button; no heavy work at launch (the week read joins `loadNumbers`, sequential).
- [ ] **Parity (spec §6, step 1 rows):** Ma place → home; Napló place → Nap › Napok (every day row still opens its day page); Boop place → centre orb; five quick doors → all on the „+" sheet (test from Task 5); every former `openPlace` route lands (Edzés „open season", Súly „Évad", Ma-wall Évad card, every „Kérdezd meg Boopot" row → chat).
- [ ] **Gates:** BoopKit suite (Task 1 command, no filter) `** TEST SUCCEEDED **`; Boop suite (Task 3 command, no filter) `** TEST SUCCEEDED **`; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0/0; `git grep DEVELOPMENT_TEAM ios/` empty.
- [ ] **Review:** one fresh-context review on the most capable model over `git diff origin/main...HEAD`; fix Critical/Important with a failing test first.
- [ ] **Merge (CLAUDE.md git workflow):** `git fetch origin && git rebase origin/main`, then `git checkout --detach origin/main && git merge --no-ff feat/boop-evad-szoba -m "merge: barless home + Évad orb (mezo-r36n9.196)" && node scripts/gen-codemap.mjs && git push origin HEAD:main` (commit a regenerated CODEMAP first if it changed); delete the branch; `gh run list --branch main --limit 1` green.
- [ ] **Mirror:** `_kiadasok.json` row keyed by the merge short sha; `bd label add mezo-r36n9.196 allapot:ellenorzes`; Notion sync through a sonnet `boop-notion-sync` worker → `node scripts/boop-notion-sync.mjs check` exits 0; commit `_notion-state.json`; `node scripts/check-beads-backup.mjs --fix` and commit.
- [ ] **Shipped:** `ios/scripts/install-on-phone.sh`; live walk-through on the phone: ring → each of the ten orbs and back, centre → chat → back, Nap › Napok → a day, „+" on the ring and in a room, Évad orb → today's Évad page → back. Record in a bd comment.

---

# Step 2 — the Évad room

Start: `git fetch origin && git checkout -b feat/boop-evad-szoba-2 origin/main` (in this worktree, never the primary checkout).

### Task 8: The Évad room's pure builders (BoopCore)

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Evad/EvadRoomLogic.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/EvadRoomLogicTests.swift` (`@Suite struct EvadRoomLogicTests`)

**Interfaces:**
- Produces:
```swift
public enum EvadDayState: Equatable, Sendable { case inPlan, out, kimelo, unjudged, today, future }
/// Seven dots H–V for the week of `monday`: date == today → .today, after → .future, excused → .kimelo,
/// judged && foodInBand != false && (sessionPlanned ? sessionDone == true : true) && sleepOk != false → .inPlan,
/// judged otherwise → .out, not judged (nothing logged) → .unjudged.
public func evadDayDots(monday: String, days: [EvadAdherenceDay], today: String) -> [(date: String, letter: String, state: EvadDayState)]
public struct EvadMostBar: Equatable, Sendable { public let key: String /* etel|edzes|alvas */; public let done: Int; public let of: Int; public let label: String }
/// Étel „napon a kereten belül", Edzés „alkalom megvolt", Alvás „éjjel elég" — a part with of == 0 is left out.
public func evadMostBars(_ a: EvadAdherence) -> [EvadMostBar]
/// nil summary/score → "Még nincs mit nézni — a hét most kezdődött"; every ratio ≥ 0.8 → "Jól megy a hét.";
/// exactly one < 0.6 → "Jól megy a hét, csak {az étel|az edzés|az alvás} csúszik."; two or more < 0.6 →
/// "Ezen a héten több minden csúszik — nézd meg, mi."; otherwise "Nagyjából tartod a hetet."
public func evadMostSentence(_ a: EvadAdherence?) -> String
public struct EvadWeekCell: Equatable, Sendable { public let week: Int; public let lighter: Bool; public let reason: String?; public let current: Bool; public let last: Bool }
/// Weeks 1…head.weeks; `upcoming` kind "deload" marks lighter (reason = its text); current = head.week.
public func evadSeasonWeeks(_ o: EvadOverview) -> [EvadWeekCell]
/// The season's span on the year strip as 1-based strip weeks (clamped); nil without a plan or when they do not overlap.
public func evadSeasonBracket(plan: WireYearPlan?, seasonStart: String, seasonEnd: String) -> ClosedRange<Int>?
public enum EvadWallTarget: Equatable, Sendable { case evad(tab: String, sub: String?), etelMenu, review }
/// learned → .evad("Terv", "modositas"); menu → .etelMenu; proposal → .evad("Kísérlet", nil);
/// result → .evad("Kísérlet", "kiserlet:<id>"); season end → .evad("Terv", nil); review → .review; else nil.
public func evadWallTarget(_ id: String) -> EvadWallTarget?
```

- [ ] **Step 1: Write the failing tests** — `dayDotsCoverEveryState` (a week with one of each state, today Thursday → `[.inPlan, .out, .kimelo, .today, .future, .future, .future]` plus a separate unjudged Tuesday case), `dayDotLettersAreHungarian` (`["H","K","Sze","Cs","P","Szo","V"]`), `barsLeaveOutEmptyParts`, `mostSentenceEarly`, `mostSentenceOneLagging` (sleep 1/4, others full → „Jól megy a hét, csak az alvás csúszik."), `mostSentenceAllGood`, `seasonWeeksMarkDeload` (12 weeks, deload at 8 → cell 8 lighter with its reason, week 7 current, 12 last), `bracketCoversTwoBlocks` (season spanning a block boundary → one range across both), `bracketWithoutPlanIsNil`, `wallTargets` (one assertion per id prefix, using `EvadWallID` constants).
- [ ] **Step 2: Run** `… -only-testing:BoopCoreTests/EvadRoomLogicTests` (BoopKit command). Expected: FAIL, `cannot find 'evadDayDots' in scope`.
- [ ] **Step 3: Implement** the functions in `EvadRoomLogic.swift` (dates as `yyyy-MM-dd`, `evadAddDays`/`evadDaysLeft` reused).
- [ ] **Step 4: Run** again. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Commit** `feat(boop): the Évad room's pure builders — day dots, bars, weeks, year bracket, wall targets (mezo-r36n9.196)`

### Task 9: The Sunday review's rules (BoopCore)

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Evad/EvadReview.swift`
- Modify: `ios/BoopKit/Sources/BoopCore/Evad/EvadWall.swift` (`EvadWallID.review = "evad-review-"`, `evadCandidates(…, review: WallCandidate? = nil)` appends it)
- Test: `ios/BoopKit/Tests/BoopCoreTests/EvadReviewTests.swift` (`@Suite struct EvadReviewTests`)

**Interfaces:**
- Produces:
```swift
public struct EvadReviewWindow: Equatable, Sendable { public let weekMonday: String; public let nextMonday: String }
/// Sunday 18:00 … Monday 23:59:59 in `calendar.timeZone`; Sunday → that week's Monday, Monday → the previous Monday.
public func evadReviewWindow(now: Date, calendar: Calendar = .current) -> EvadReviewWindow?
public enum EvadReviewReminder: Equatable, Sendable { case schedule(id: String, fireAt: Date), cancelAll, keep }
/// No season → .cancelAll. Not allowed (permission) → .keep (never prompts). Otherwise the first Sunday 18:00 strictly
/// after `now` whose week is not in `done` → .schedule(id: "boop.heti-atnezes.<weekMonday>", fireAt:).
public func evadReviewReminder(now: Date, hasSeason: Bool, allowed: Bool, done: Set<String>, calendar: Calendar = .current) -> EvadReviewReminder
/// Per-user done log on the phone (UserDefaults key "boop.review.<userKey>").
public final class EvadReviewLog: @unchecked Sendable {
    public init(defaults: UserDefaults, userKey: String)
    public func isDone(_ weekMonday: String) -> Bool
    public func markDone(_ weekMonday: String, takeaway: String)
    public var doneWeeks: Set<String> { get }
    public var last: (week: String, takeaway: String)? { get }
}
/// The flow's position: five pages, „Később" leaves without marking, only finish() on page 5 returns true.
public struct EvadReviewProgress: Equatable, Sendable {
    public static let pageCount = 5
    public private(set) var page: Int   // 1…5
    public mutating func next(); public mutating func back()
    public func canFinish() -> Bool      // page == 5
}
/// The Ma-wall card: in the window, a season, not done → .improves, rank 0.9, text "*Kész a heti átnézés*",
/// sub "Öt rövid lépés: hogy ment, mit tanult Boop, mi jön.", primary "Átnézem", id EvadWallID.review + weekMonday.
public func evadReviewCandidate(window: EvadReviewWindow?, hasSeason: Bool, done: Bool) -> WallCandidate?
```

- [ ] **Step 1: Write the failing tests**

```swift
@Test func windowEdges() {   // Europe/Budapest, week of Mon 2026-11-23
    #expect(evadReviewWindow(now: at("2026-11-29T17:59"), calendar: bud) == nil)
    #expect(evadReviewWindow(now: at("2026-11-29T18:00"), calendar: bud)?.weekMonday == "2026-11-23")
    #expect(evadReviewWindow(now: at("2026-11-30T23:59"), calendar: bud)?.weekMonday == "2026-11-23")
    #expect(evadReviewWindow(now: at("2026-12-01T00:00"), calendar: bud) == nil)
}
@Test func windowAcrossDST()             // Sunday 2026-10-25 (clocks back): 18:00 local opens, weekMonday "2026-10-19"
@Test func reminderNeedsASeason()        // hasSeason false → .cancelAll
@Test func reminderNeverPrompts()        // allowed false → .keep
@Test func reminderSkipsADoneWeek()      // Monday 10:00 in window, this week done → schedule for next Sunday 18:00, id "boop.heti-atnezes.2026-11-30"
@Test func reminderOnWednesdayIsThisSunday()  // Wed → fireAt Sunday 18:00 same week
@Test func leavingNeverMarksDone() {
    var p = EvadReviewProgress(); p.next(); p.next()
    #expect(p.page == 3 && !p.canFinish())
}
@Test func logRemembersDoneWeeksPerUser()  // markDone in user A, isDone false for user B, last == ("2026-11-23", "…")
@Test func reviewCardOnlyInWindow()        // nil outside, nil when done, nil without season; else text/primary as above
```

- [ ] **Step 2: Run** `… -only-testing:BoopCoreTests/EvadReviewTests`. Expected: FAIL, `cannot find 'evadReviewWindow' in scope`.
- [ ] **Step 3: Implement** in `EvadReview.swift` (`Calendar` arithmetic on `weekday == 1` for Sunday; no fixed 86 400 s offsets).
- [ ] **Step 4: Run** again. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Commit** `feat(boop): the Sunday review's window, reminder rule, done log and wall card (mezo-r36n9.196)`

### Task 10: Marking menu recipes on the recipe (BoopCore)

**Files:**
- Modify: `ios/BoopKit/Sources/BoopCore/Evad/EvadMenuStore.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/EvadMenuTests.swift`

**Interfaces:**
- Produces:
```swift
public private(set) var recipeOptions: [EvadRecipeOption]?      // nil until read
public func loadRecipeOptions(force: Bool = false) async
public var allowedIds: Set<String> { get }                       // options where allowed
/// Serialised read-modify-write over putRecipes(seasonId:_:) with the whole set; refuses a !usable recipe;
/// offline → actionProblem "Ehhez internet kell." and nothing changes; success re-reads the options.
public func setAllowed(_ recipeId: String, on: Bool, seasonId: String) async
```

- [ ] **Step 1: Write the failing tests** — `toggleSendsTheWholeSetWithOneChanged` (allowed {a,b}, setAllowed(c,on) → PUT body `["a","b","c"]`), `twoTogglesKeepBoth` (two concurrent `Task`s on c and d → final PUT carries both), `offlineToggleChangesNothing`, `blockedRecipeIsRefused` (usable false → no PUT).
- [ ] **Step 2: Run** `… -only-testing:BoopCoreTests/EvadMenuTests`. Expected: FAIL, `value of type 'EvadMenuStore' has no member 'setAllowed'`.
- [ ] **Step 3: Implement** (a private serial queue of pending changes applied in `run`; `busy` stays the gate).
- [ ] **Step 4: Run** again. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Commit** `feat(boop): toggle one recipe into the season's menu set (mezo-r36n9.196)`

### Task 11: The Évad room frame and Most

**Files:**
- Create: `ios/Boop/Evad/EvadRoom.swift` (`EvadRoomTab`, `EvadRoomSub`, `EvadRoom`, `EvadNoSeason`)
- Create: `ios/Boop/Evad/EvadMost.swift` (hero orb + sentence, three bars, day dots, Ami jön, the Sunday highlight), `ios/Boop/Evad/EvadDaysPage.swift` (day-by-day breakdown sub-page), `ios/Boop/Evad/EvadParts.swift` (`EvadDayDotsView`, `EvadBarRow`, `EvadEmptyIllustration` — from the spike's `SpikeDayDots`, `SpikeBar`, `SpikeEmptyIllustration`)
- Modify: `ios/Boop/Nap/NapView.swift` drill `.evad → EvadRoom(entry:)` (via `MaiView` drill entry), `ios/Boop/Kezdolap/KezdolapView.swift` (`-previewHome evad -evadTab Most|Hét|Terv|Kísérlet`, `-evadMost sunday|early`)
- Test: `ios/BoopTests/EvadRoomTests.swift`

**Interfaces:**
- Consumes: Task 2 `EvadStore.week/loadWeek/weekScore`, Task 8 builders, Task 9 `evadReviewWindow`, `EvadReviewLog`.
- Produces:
```swift
enum EvadRoomTab: String, CaseIterable { case most = "Most", het = "Hét", terv = "Terv", kiserlet = "Kísérlet"
    var glyph: String }   // most-ink, het-ink, terv-ink, kiserlet-ink
enum EvadRoomSub: Identifiable, Equatable { case days, load, learned, map, rules, whatIf, newSeason, atrendezes,
    experiment(String?), newExperiment; var id: String }
/// "modositas" → .whatIf, "szabalyok" → .rules, "uj" → .newSeason, "kiserlet:<id>" → .experiment(id), "atrendezes" → .atrendezes.
func evadRoomSub(_ raw: String?) -> EvadRoomSub?
/// Head per tab: the eyebrow "\(head.title) · \(weeks) hétből a \(week)." and the fixed "what you see" sentence:
/// Most "Egy pillantás a hetedre: mennyire tartod, és mi jön.", Hét "Itt nézed át vasárnap a hetet: a terhelést, a jövő hetet és amit Boop tanult.",
/// Terv "Az évad egészben: hol tartasz az évben, mi a cél, és mi mire hat.", Kísérlet "Egyszerre egy kísérlet fut; Boop őszintén megmondja, hatott-e."
func evadRoomHead(_ o: EvadOverview, tab: EvadRoomTab, week: EvadAdherence?) -> (eyebrow: String, headline: String, sentence: String)
struct EvadRoom: View { init(entry: RoomEntry) }   // NKAreaPage(hue: .evad, name: "Évad", level: weekScore/100, display: weekScore,
                                                   // glyph: "evad-ink", tabs with glyphs, actions [Frissítés], onBack: closeRoom, onAsk: .chat)
```
- All sub-pages are one `.fullScreenCover(item:)` on `EvadRoom` (page level), injecting `EvadStore` + `KapacitasStore`.

- [ ] **Step 1: Write the failing tests** — `subsFromWallStrings` (each mapping above; unknown → nil), `headSentencesAreFixed` (four exact strings), `mostHeadlineIsTheSentence` (`evadRoomHead(o, .most, week:)`.headline == `evadMostSentence(week)`), `tabsAndGlyphs` (`EvadRoomTab.allCases.map(\.rawValue) == ["Most","Hét","Terv","Kísérlet"]`, glyphs as listed).
- [ ] **Step 2: Run** `… -only-testing:BoopTests/EvadRoomTests` (app command). Expected: FAIL, `cannot find 'evadRoomSub' in scope`.
- [ ] **Step 3: Implement** per Files. No season → `EvadNoSeason` (today's „Indítsunk egy évadot" copy + „Megnézem" → `.newSeason`, no bar, orb „–"). Monday/early → hero says the early sentence, bars hidden, dots shown. Offline → `.nkStale` with the week's age; actions read „Ehhez internet kell.". Day dot tap → `openDestination(.nap(.napok))` and the Napok tab opens that day (`NapRoomPage` takes an optional `openDay: String?`). The Sunday highlight (in window, not done): `NKHighlight(label: "Vasárnap", text: "Kész a heti átnézés", actions: ["Átnézem" → router.openReview()])`.
- [ ] **Step 4: Run** again. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Verify**: `-preview shell -previewHome evad -evadTab Most` (+ `-evadMost sunday`, `-evadMost early`, `-evadState empty`, `-evadState offline`) on Pro Max and SE; screenshots `built/10-evad-most*.png`; compare with spike `05`–`10`, `19`.
- [ ] **Step 6: Commit** `feat(boop): the Évad room — frame, Most tab, day breakdown, no-season state (mezo-r36n9.196)`

### Task 12: Hét — load, next week, Boop's card, what Boop learned

**Files:**
- Create: `ios/Boop/Evad/EvadHet.swift` (hero review card, Teher és pihenés card, A jövő heted, Boop javaslata, „Amit Boop tanult" card), `ios/Boop/Evad/EvadHetPages.swift` (`EvadLoadPage` — the chart large + footnote; `EvadLearnedPage` — `kapacitasSeasonStats`, `kapacitasPatternRows`, ≤3 insights)
- Create: `ios/Boop/Kapacitas/KapProposalList.swift` (extracted from `AtrendezesPage.content` „Boop javaslatai" block)
- Modify: `ios/Boop/Kapacitas/AtrendezesPage.swift:67-107` (uses `KapProposalList`)
- Test: `ios/BoopTests/EvadRoomTests.swift`

**Interfaces:**
- Produces:
```swift
struct KapProposalList: View { init(week: KapacitasWeek, monday: String, store: KapacitasStore, more: @escaping (String) -> Void) }
/// "Amit Boop tanult" count = shown stats rows + patterns + min(3, insights).
func evadLearnedCount(season: KapacitasSeasonLoad?, insights: [EvadInsight]) -> Int
/// The hero card's state: .available(window) / .done(takeaway) / .lastWeek(takeaway) / .none
enum EvadReviewCardState: Equatable { case available, done(String), lastWeek(String), none }
func evadReviewCardState(window: EvadReviewWindow?, log: (week: String, takeaway: String)?, doneThisWindow: Bool) -> EvadReviewCardState
```

- [ ] **Step 1: Write the failing tests** — `learnedCountCapsInsightsAtThree`, `reviewCardStates` (in window not done → `.available`; done → `.done(takeaway)`; outside with a log → `.lastWeek`; none → `.none`).
- [ ] **Step 2: Run** `… -only-testing:BoopTests/EvadRoomTests`. Expected: FAIL.
- [ ] **Step 3: Implement**; Átrendezés opens as `.atrendezes` with crumb „Évad"; the lighter-week card keeps rule #121 (one action „Megbeszélem Boop-pal" → `.chat`); load/next-week reads `.task { await kapacitas?.load(); await kapacitas?.loadWeek(monday: next) }` sequentially.
- [ ] **Step 4: Run** the app suite filtered to `EvadRoomTests` and the existing Kapacitas view tests. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Verify**: `-previewHome evad -evadTab Hét` and `-previewKapacitas YES -kapOpen atrendezes` (unchanged look); screenshots `built/11-13-evad-het*.png`.
- [ ] **Step 6: Commit** `feat(boop): Évad › Hét — load, next week, Boop's card, what Boop learned; shared proposal list (mezo-r36n9.196)`

### Task 13: Terv — year strip, season weeks, goal, map, plan rows, rules

**Files:**
- Create: `ios/Boop/Evad/EvadTerv.swift` (hero year strip, Az évad hetei, A cél, Mi mire hat card, Az évad terve rows, Szabályok row, Módosítás · Új évad), `ios/Boop/Evad/EvadYearStrip.swift` (draws `evesStripWeeks(plan)` + `evadSeasonBracket` + „itt tartasz"; plan nil → season only), `ios/Boop/Evad/EvadMapPage.swift` (`EvadSystemMap` + the one-sentence model)
- Move: the Súly block (`weightBlock`, `weightStats`) and `planRows` out of `EvadOverviewTab.swift` into `EvadTerv.swift`
- Modify: `ios/Boop/Evad/EvadRoom.swift` (a `YearPlanModel(client: planClient, cache:)` held in `@State`, loaded on first Terv appearance)
- Test: `ios/BoopTests/EvadRoomTests.swift`

**Interfaces:**
- Consumes: `evadSeasonWeeks`, `evadSeasonBracket` (Task 8), `YearPlanModel.load()/freshPlan`.
- Produces: `func evadPlanRowTarget(_ key: String) -> BoopDestination` — `block → .room(RoomEntry(.mozgas))`, `food → .room(RoomEntry(.fuel))`, `sleep → .room(RoomEntry(.alvas))`, `weight → .room(RoomEntry(.suly))`.
- One-sentence model (exact): „Az Évad mondja meg, mennyit és miért; az Étel, az Edzés és az Alvás szoba azt, mit csinálsz ma; a Súly szoba mutatja, mi lett belőle."

- [ ] **Step 1: Write the failing test** — `planRowsOpenTheirRooms` (the four keys).
- [ ] **Step 2: Run** `… -only-testing:BoopTests/EvadRoomTests`. Expected: FAIL.
- [ ] **Step 3: Implement**; strip tap → `.room(RoomEntry(.mozgas, sub: "evesterv"))` (EdzesRoom opens its `openYearPlan()` when `sub == "evesterv"`); A cél tap → `.room(RoomEntry(.suly))`; strip and dots carry a11y text („Az év 52 hete, az évad a 31–42. hét, most a 37.").
- [ ] **Step 4: Run** again. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Verify**: `-previewHome evad -evadTab Terv` with and without `-previewEvesTerv`-style year fixture (add `-evadYear none`); screenshots `built/14-16-evad-terv*.png`, `built/20-mi-mire-hat.png`.
- [ ] **Step 6: Commit** `feat(boop): Évad › Terv — year strip, season weeks, goal, map page, plan rows, rules (mezo-r36n9.196)`

### Task 14: Kísérlet

**Files:**
- Create: `ios/Boop/Evad/EvadKiserlet.swift` (hero = running experiment's progress or `EvadEmptyIllustration` + „Új kísérlet"; below it today's `EvadEffectTab` body unchanged)
- Modify: `ios/Boop/Evad/EvadEffectTab.swift` (the running-experiment block exposed for the hero; no behaviour change)

- [ ] **Step 1: Implement**; result → `.experiment(id)`, „Új kísérlet" → `.newExperiment`.
- [ ] **Step 2: Build + verify**: `-previewHome evad -evadTab Kísérlet` with `-evadExp empty|noProposal` and default; screenshots `built/17-18-kiserlet*.png`. Existing `EvadExperimentTests` stay green (BoopKit suite).
- [ ] **Step 3: Commit** `feat(boop): Évad › Kísérlet under the new anatomy (mezo-r36n9.196)`

### Task 15: Heti átnézés — the five-page flow, wall card, notification

**Files:**
- Create: `ios/Boop/Evad/Review/WeeklyReviewFlow.swift` (full-screen; progress dots; „Később" top-left; „Tovább"/„Kész" bottom), `Review/WeeklyReviewPages.swift` (pages 1–5), `Review/WeeklyReviewIllustration.swift` (five Canvas illustrations from the spike's `SpikeReviewIllustration`), `Review/WeeklyReviewReminder.swift`
- Modify: `ios/Boop/Ritmus/RitmusRouter.swift` (`review: Bool`, `openReview()`), `ios/Boop/Shell/ShellView.swift` (page-level `.fullScreenCover(isPresented: router.review)`; the same sheet-first rule as `router.cover`), `ios/Boop/Nap/BedtimeReminder.swift:197-201` (`handleTap`: `"boop://heti-atnezes"` → `RitmusRouter.shared.openReview()`), `ios/Boop/Nap/MaWall.swift:65` (passes `evadReviewCandidate`; `act` for `EvadWallID.review` → `router.openReview()`), `ios/Boop/RootView.swift` (`WeeklyReviewTriggers` beside `KapacitasTriggers`: re-arm on `.active`)
- Test: `ios/BoopTests/WeeklyReviewTests.swift`

**Interfaces:**
- Consumes: Task 9 (window, reminder rule, log, progress, candidate), Task 12 `KapProposalList`, Task 8 builders.
- Produces:
```swift
struct WeeklyReviewFlow: View { init(window: EvadReviewWindow, close: @escaping @MainActor @Sendable () -> Void) }
/// Page 5's sentence: accepted proposals first ("Erre figyelj: <first accepted title>."), else the plan ("Tartsd a heti <n> edzést és a <bedtime> lefekvést.").
func weeklyReviewTakeaway(accepted: [KapacitasProposal], o: EvadOverview?) -> String
@MainActor final class WeeklyReviewReminder { init(center: ReminderCenter, log: EvadReviewLog); func refresh(now: Date, hasSeason: Bool) async }
static let weeklyReviewRoute = "boop://heti-atnezes"
```
- Page copy (exact titles): 1 „Hogy ment a hét?", 2 „Mit tanult Boop?", 3 „Milyen lesz a jövő hét?", 4 „Mit eszel jövő héten?", 5 „Kész". Notification title „Kész a heti átnézés", body „Öt rövid lépés a hetedről — két perc." Page 3 empty: „Jól néz ki a jövő hét". Page 4 button „Megnézem a menüt".

- [ ] **Step 1: Write the failing tests** — `takeawayPrefersAcceptedProposals`, `takeawayFallsBackToThePlan`, `reminderSchedulesThroughTheCenter` (fake `ReminderCenter`: `refresh` on Wednesday with a season, permission granted → one `scheduleOnce` with id `boop.heti-atnezes.<monday>`, hour 18 minute 0, route `boop://heti-atnezes`; no season → `cancel` for every pending id with that prefix), `reviewRouteOpensTheFlow` (`handleTap(route: "boop://heti-atnezes")` → `RitmusRouter.shared.review == true`).
- [ ] **Step 2: Run** `… -only-testing:BoopTests/WeeklyReviewTests`. Expected: FAIL, `cannot find 'weeklyReviewTakeaway' in scope`.
- [ ] **Step 3: Implement**. Page 1 reads `client.adherence(from: weekMonday, to: weekMonday+6)` (kímélő line `evadExcusedLine`); page 2: insights ≤3 + `kapacitasPatternRows` + `kapacitasHistory` of `weekMonday`'s Kapacitas week; page 3: `KapProposalList` for `nextMonday` (accept/decline only on tap; loading state until the week arrives); page 4: one line from `overview.menu?.status` (ready/not generated/approved) and „Megnézem a menüt" presents `EtelMenuPage` (Task 16) as a cover over the flow, returning keeps the page; page 5 „Kész" → `log.markDone(weekMonday, takeaway:)`, reminder refresh, close. „Később" on any page → close, nothing written. Reduced motion: page changes cross-fade.
- [ ] **Step 4: Run** again. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Verify**: `-preview shell -previewOpen review -reviewPage 1…5`; screenshots `built/22-26-atnezes-*.png`; VoiceOver reads „1. lépés az 5-ből".
- [ ] **Step 6: Commit** `feat(boop): the Sunday weekly review — five pages, wall card, local notification (mezo-r36n9.196)`

### Task 16: Menu and list into Étel › Hét; „Menübe jöhet" on the recipe

**Files:**
- Create: `ios/Boop/Etel/EtelMenu.swift` (`EtelMenuCard` hero for Hét; `EtelMenuPage` = today's `EvadMenuTab` body inside `NKAreaSubPage(crumb: "Étel")`, its „Kiválasztott receptek" row replaced by „N recept a menüben" → Receptek with the filter on), `ios/Boop/Etel/EtelList.swift` (`EtelListCard`; `EtelListPage` = today's `EvadListTab` body; `EvadPastListsPage`, `EvadStaplesPage` moved here unchanged)
- Modify: `ios/Boop/Etel/EtelHet.swift` (menu card + list card above today's week), `ios/Boop/Etel/EtelRoom.swift` (`EtelHetSub` cover enum: `menu, list, pastLists, staples`; `EvadSwapSheet` at page level; `init(tab:sub:)` — `sub == "menu"` opens the menu page; `@State menuOnly: Bool` passed to Receptek), `ios/Boop/Etel/EtelReceptek.swift` (filter chip „Menübe jöhet", per-card toggle hidden without a season, blocked recipes show the reason and no toggle), `ios/Boop/Etel/RecipeDetail.swift` (the same toggle row), `ios/Boop/Etel/EtelLogic.swift`
- Delete: `ios/Boop/Evad/EvadMenuTab.swift`, `ios/Boop/Evad/EvadListTab.swift` (incl. `EvadRecipesPage`) after the move
- Test: `ios/BoopTests/EtelMenuTests.swift`

**Interfaces:**
- Consumes: Task 10 `EvadMenuStore.recipeOptions/allowedIds/setAllowed`.
- Produces:
```swift
enum EtelMenuToggle: Equatable { case hidden, on, off, blocked(String) }
/// No season → .hidden; option missing → .hidden; !usable → .blocked(reason ?? "nem fér a szabályaidba"); allowed → .on else .off.
func etelMenuToggle(_ recipe: Recipe, options: [EvadRecipeOption]?, hasSeason: Bool) -> EtelMenuToggle
func etelMenuFilter(_ recipes: [Recipe], allowed: Set<String>) -> [Recipe]   // id match on uuidString.lowercased()
func etelMenuCountLine(_ n: Int) -> String   // "\(n) recept a menüben"
```

- [ ] **Step 1: Write the failing tests** — `toggleHiddenWithoutSeason`, `toggleBlockedShowsReason`, `toggleOnOff`, `filterMatchesLowercasedUUID`, `countLine`.
- [ ] **Step 2: Run** `… -only-testing:BoopTests/EtelMenuTests`. Expected: FAIL, `cannot find 'etelMenuToggle' in scope`.
- [ ] **Step 3: Implement**; the toggle uses today's look (an `NKToggleRow`/the existing Évad tick, decision #130); offline toggle shows the store's „Ehhez internet kell.".
- [ ] **Step 4: Run** `EtelMenuTests` + existing `EtelHetTests`. Expected: `** TEST SUCCEEDED **`.
- [ ] **Step 5: Verify**: `-previewHome etel -etelTab Hét` (spike `27`, the „+" never over the card's row ends), `-etelTab Receptek -etelMenuOnly YES`, a recipe detail sheet; screenshots `built/27-etel-het.png`, `built/28-receptek-menube.png`.
- [ ] **Step 6: Commit** `feat(boop): weekly menu and list in Étel › Hét; „Menübe jöhet" on the recipe (mezo-r36n9.196)`

### Task 17: Wall re-routes and removing the old Évad tab

**Files:**
- Modify: `ios/Boop/Nap/MaWall.swift:237` (`evadWallTarget(c.id)`: `.evad(tab, sub)` → `openDestination(.room(RoomEntry(.evad, tab:, sub:)))`; `.etelMenu` → `.room(RoomEntry(.fuel, tab: "Hét", sub: "menu"))`; `.review` → `router.openReview()`), `ios/Boop/Suly/SulyRoom.swift:48` (`openEvad` → `.room(RoomEntry(.evad, tab: "Terv"))`), `ios/Boop/Edzes/EdzesRoom.swift:188` (`.room(RoomEntry(.evad))`)
- Modify: `ios/BoopKit/Sources/BoopCore/Evad/EvadStore.swift` (remove `pendingSub`), `EvadWall.swift` (remove `evadWallOpens`; its tests move to `evadWallTarget`)
- Delete: `ios/Boop/Evad/EvadPage.swift` (keep `EvadStepButton`, `EvadWarningBox`, `EvadLine`, `evadReviewAnchor`, `evadListLeft`, `evadPaceText` → `ios/Boop/Evad/EvadShared.swift`), `EvadOverviewTab.swift`, `EvadTeher.swift` (its `evadLoadWeeks` → `EvadHetPages.swift`)
- Modify: `ios/Boop/Evad/EvadPreview.swift` (flags now `-previewHome evad`), `ios/BoopKit/Tests/BoopCoreTests/EvadWallTests.swift`

- [ ] **Step 1: Write the failing test** — in `EvadWallTests`, replace the `evadWallOpens` assertions with `evadWallTarget` ones for the same four ids (they already exist from Task 8 — this step deletes the old ones and adds `noPendingSubLeft`: `git grep -n pendingSub ios/` empty is checked in Step 3).
- [ ] **Step 2: Implement** the removals; `git grep -n "EvadPage\|EvadSub\b\|pendingSub\|evadWallOpens\|EvadRecipesPage" ios/` empty.
- [ ] **Step 3: Run** both full suites (Task 1 and Task 3 commands, no filter). Expected: `** TEST SUCCEEDED **` twice.
- [ ] **Step 4: Verify**: `-previewHome nap -evadEndSoon YES` → tap each Évad wall card: correction → Terv + Módosítás; menu → Étel › Hét menu page; proposal → Kísérlet; result → its result page.
- [ ] **Step 5: Commit** `refactor(boop): Évad wall cards open the room's tabs; old Évad page removed (mezo-r36n9.196)`

### Task 18: Step 2 docs and mirror

**Files:**
- Modify: `docs/boop-handbook/04-terv/` (`00-attekintes.md` → the Évad room: Most · Hét · Terv · Kísérlet; new `10-heti-atnezes.md` Funkció page; `07-bevasarlolista.md`, `09-heti-menu.md` → „Étel › Hét"; `08-hataskovetes.md` → Kísérlet tab), `docs/boop-handbook/06-etel/05-receptek.md` („Menübe jöhet" toggle + filter), `06-etel/00-attekintes.md` (Hét holds the menu + list), `01-alapok/ertesitesek.md` (the Sunday 18:00 notification), `_funkciok.json` (menu/list/experiment rows: app place „Étel" / „Évad › Kísérlet"; heti átnézés note), `docs/features/boop-ios.md` (§2 Évad room + review + Étel menu, §4 no new API, §9 „recipe toggle = full-set write" gotcha, §10 files), `ios/README.md` (`-evadTab Most|Hét|Terv|Kísérlet`, `-evadMost`, `-evadYear none`, `-previewOpen review -reviewPage N`, `-etelMenuOnly YES`; remove `-previewTab terv` rows)

- [ ] **Step 1: Write the docs.**
- [ ] **Step 2: Run** `node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs`. Expected: `0 errors, 0 stale`.
- [ ] **Step 3: Commit** `docs(boop): handbook and flags for the Évad room, the Sunday review and the Étel menu (mezo-r36n9.196)`

### Task 19: Step 2 — *Kész, ha…*, gates, merge, install, live check

- [ ] **UX/UI bar:** every Évad page = hero + one „what you see" sentence + ≤5 cards (count per tab on the screenshots); largest Dynamic Type on Most, Hét, Terv, the review pages and Étel › Hét (bars break name / count onto two lines, never mid-word — spike `09`/`10`); VoiceOver: the room orb reads „Évad, a heti betartás 78 százalék" or „nincs még adat", day dots read „hétfő, tartottad" etc., the year strip reads as words, every toggle and review button labelled; SE width; reduced motion (review cross-fade, map still); offline: Most/Hét/Terv show the cached overview + week with age, actions say „Ehhez internet kell.", review page 3 needs net only for its buttons; empty (no season), loading and error states on every tab; no pull-to-refresh (`git grep -n refreshable ios/Boop/Evad ios/Boop/Etel` empty).
- [ ] **Parity (spec §6, every row):** Mi mire hat → Terv page; Súly block → Terv › A cél; Az évad terve → Terv; Hogy megy → Most + review page 1; Teher és pihenés, Mennyit bírsz → Hét; Boop-javaslat → Hét; A jövő heted → Hét + review 3; tanultam / észrevett → Hét › Amit Boop tanult + review 2; Következik → Terv › Az évad hetei + Most › Ami jön; Módosítás, Új évad, Szabályok → Terv; Menü, Lista, receptek, korábbi listák, tételek → Étel; Hatás → Kísérlet; wall cards re-pointed. Tick each with its screenshot.
- [ ] **Gates:** BoopKit suite and Boop suite (no filter) `** TEST SUCCEEDED **`; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0/0; `git grep DEVELOPMENT_TEAM ios/` empty.
- [ ] **Review:** one fresh-context review on the most capable model; fixes test-first.
- [ ] **Merge:** `git fetch origin && git rebase origin/main`; `git checkout --detach origin/main && git merge --no-ff feat/boop-evad-szoba-2 -m "merge: Évad room + Sunday review + Étel menu (mezo-r36n9.196)" && node scripts/gen-codemap.mjs && git push origin HEAD:main`; delete the branch; `gh run list --branch main --limit 1` green.
- [ ] **Mirror:** `_kiadasok.json` row (merge short sha); close `mezo-r36n9.196` with evidence; Notion sync via a sonnet worker → `check` exits 0, commit `_notion-state.json`; `node scripts/check-beads-backup.mjs --fix` and commit; delete `spike/boop-evad-szoba` and both simulators.
- [ ] **Shipped:** `ios/scripts/install-on-phone.sh`; live walk-through: Évad orb number matches Most's hero; each tab; a day dot → that day in Nap › Napok; Hét → Átrendezés; Terv strip → Edzés › Éves terv and back; a recipe marked „Menübe jöhet" shows under the filter and in „N recept a menüben"; on Sunday after 18:00 the wall card and the notification open page 1, „Később" leaves nothing changed, „Kész" removes the card. Hungarian report to the owner.
