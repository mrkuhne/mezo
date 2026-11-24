# Boop: sheet close, quick doors, Súly area — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every sheet closes with a tap and never refreshes the room behind it; the home screen's five quick doors open their sheets directly; the ring gets a ninth, gold **Súly** orb whose number is the weight-pace score, with a Súly room (Ma · Test · Napló) built like Pénz.

**Architecture:** Pure logic in `BoopCore/Suly/` (pace score, head copy, week grouping, a raw `SulyClient` and an observable `SulyStore` over `EvadClient` + the weight endpoints + the app's `HealthReader` + `ServerCache`); the room and the ring in the app on the shared `NKAreaPage` / `NKOrbRing`; the sheet close in the Napkelte kit (`NKSheetFrame`); no backend change.

**Tech Stack:** Swift 6.2, SwiftUI (iOS 26), Swift Testing, BoopKit (BoopCore · BoopDesign · BoopAPI), `RawJSONClient`, `ServerCache`.

**Spec:** `docs/superpowers/specs/2026-11-24-boop-suly-orb-gyorsajtok-design.md` (decisions #99–#102).

**Issues:** `mezo-r36n9.156` (sheets) · `.157` (doors) · `.158` (Súly). Branch `feat/boop-suly-orb-gyorsajtok`, worktree `/Users/daniel.kuhne/mezo-suly`, simulators `Boop · r36n9.suly` (Pro Max) and `Boop · r36n9.suly SE`.

## Global Constraints

- Hungarian, jargon-free strings; never "Mezo", never emoji, no SF Symbols except chevrons/arrows (the close cross and the body glyph are drawn in `Canvas`).
- A number is never invented: no season / no trend / `dataSufficiency == none` → the orb shows „–" and the room says why.
- No `async let` fans (`Task {}` handles, `mezo-r36n9.153`); presentations at page level; the ring's motion rules untouched.
- `Hue` arrays (`name`, `glow`, `top`) and the four-colour `orb` must grow together with the new case.
- Gold world: sky `0x3A2606 · 0xC9901E · 0xFFE9A8`, orb `0x3B2606 · 0xCF9426 · 0xF4DB8C · 0xFFF6D2`, glow `0xE6B33A`, top `0x3A2606`.
- Ring order: `nap, alvas, etel, edzes, energia, suly, forma, penz, level`; orb size `side < 360 ? 46 : side < 400 ? 52 : 56`.
- Doors in order: Étkezés (`bowl-cream`, `.meal(.pick, text: "")`) · Víz (`drop-sky`, `.quick(.water)`) · Súly (`scale-ink`, `.quick(.weight)`) · Check-in (`spark-cream`, `.cover(.checkin)`) · Napló (`book-sage`, `.quick(.journal)`).
- Native test runner only for BoopCore on this Mac (the scratchpad `kit` copy, design-free); `xcodebuild test` runs on the Xcode-ready Mac (`mezo-r36n9.150`) — every new test must also compile there.
- Docs mandate: handbook pages + `_jegyek/_dontesek/_kiadasok/_funkciok.json`, `docs/features/boop-ios.md`, `ios/README.md`, `14-decisions.md`, `node scripts/lint-docs.mjs` 0/0, `node scripts/gen-codemap.mjs`.

## Review Focus

1. A pull inside an Étel sheet (composer, recipe, kamra, dimension) must dismiss, never reload the room — Task 2 moves `.refreshable`; verify by code position (no runtime test possible here) and on the phone.
2. The score at the planned pace's sign: a bulk with a negative actual rate → 0; a cut with `planned = 0` → nil (Task 3 tests).
3. Maintain with a degenerate band (`high ≤ low`) → nil, never a division by zero (Task 3 test).
4. The ring with no `SulyStore` in the environment (a test host, onboarding) → the Súly orb is „–" and live (Task 6 test `sulyOrbWithoutStoreIsDash`).
5. `SulyStore` with a 404 season and a full trend → `season == nil`, `score == nil`, trend still shown (Task 5 test).

---

### Task 1: The Súly world and its glyphs (BoopDesign)

**Files:**
- Modify: `ios/BoopKit/Sources/BoopDesign/Napkelte/Tokens.swift` (`Hue` + `.suly`, already in the spike)
- Modify: `ios/BoopKit/Sources/BoopDesign/Napkelte/Glass.swift:66-120` (`NKGlyph.outlined` + `body-cream` drawing)
- Modify: `ios/BoopKit/Sources/BoopDesign/Napkelte/Area.swift:354-380` (`NKAreaTabs.glyph`: `"Test" → "body-cream"`, `"Napló" → "book-sage"`)
- Test: `ios/BoopKit/Tests/BoopDesignTests/NapkelteTokensTests.swift`

**Interfaces:** Produces `Hue.suly` (name "Súly"), glyph name `"body-cream"`.

- [ ] Step 1: Update `hueNamesAndOrder` to expect `[…, "Pénz", "Levél", "Súly"]`; add `@Test func sulyWorldIsGold()` asserting `rgb(Hue.suly.glow) == (0xE6, 0xB3, 0x3A)` and `Hue.suly.orb.count == 4`; add `@Test func testTabWearsTheBodyGlyph()` asserting `NKAreaTabs.glyph("Test") == "body-cream"` and `NKAreaTabs.glyph("Napló") == "book-sage"`.
- [ ] Step 2: Draw `body-cream` in `NKGlyph` (64-unit canvas, stroke 5): a head circle (centre 32,16 r 8) and a shoulders-to-hips outline (a rounded path from (14,58) up to the shoulders at y 32 and back down to (50,58)); add the name to `outlined`.
- [ ] Step 3: Add the two `glyph` cases. (BoopDesign tests run on the Xcode Mac; here the app build compiles them.)
- [ ] Step 4: Commit `feat(boop): the Súly colour world, the body glyph and the Test/Napló tab marks (mezo-r36n9.158)`.

### Task 2: Sheets close with a tap; the Étel refresh stays on the page

**Files:**
- Modify: `ios/BoopKit/Sources/BoopDesign/Napkelte/Frames.swift:372` (`NKSheetFrame(closable:)`, `NKCloseButton` — in the spike)
- Modify: `ios/Boop/Etel/EtelRoom.swift:651,787` (`.refreshable` moved before the first `.sheet` — in the spike)
- Modify: `docs/superpowers/specs/2026-11-10-boop-napkelte-design.md` §5.4 (one line: sheets carry a close)

**Interfaces:** Produces `public struct NKCloseButton: View { init(action:) }`; `NKSheetFrame.init(hue:eyebrow:title:closable: Bool = true, content:)`.

- [ ] Step 1: Keep the spike code; a11y label „Bezárom"; 36 pt circle, 44 pt hit area, `.glassEffect(.regular.interactive(), in: .circle)`, overlay `.topTrailing` padding 12/12.
- [ ] Step 2: `grep -n "refreshable" ios/Boop/Etel/EtelRoom.swift` shows exactly one line, above `.toolbar(.hidden…)` and above every `.sheet(`.
- [ ] Step 3: Commit `fix(boop): a glass close on every sheet; the Étel pull-to-refresh no longer leaks into its sheets (mezo-r36n9.156)`.

### Task 3: The pace score and the head words (BoopCore, pure)

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Suly/SulyLogic.swift` (spike version + `sulyHead`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/SulyLogicTests.swift`

**Interfaces:** Produces
```swift
public enum SulyCourse: String, Sendable { case cut, bulk, maintain; public init(trajectory: String?) }
public func sulyPaceScore(actualKgPerWeek: Double?, plannedKgPerWeek: Double?, course: SulyCourse, trendKg: Double?, bandLowKg: Double?, bandHighKg: Double?) -> Int?
public func sulyPaceWord(score: Int?, course: SulyCourse) -> String
public struct SulyHead: Equatable, Sendable { public let headline: String, sentence: String }
public func sulyHead(status: String?, course: SulyCourse, trendKg: Double?, targetKg: Double?, targetDate: String?, actualKgPerWeek: Double?, plannedKgPerWeek: Double?, hasSeason: Bool) -> SulyHead
```
- [ ] Step 1: Tests: `cutAtPlannedPaceIs100` (−0.5/−0.5 → 100), `cutAtHalfPaceIs50`, `cutStandingStillIs0` (0 → 0), `cutWrongWayIs0` (+0.2 → 0), `cutFasterCostsHalf` (−0.6/−0.5 → 90; −1.0/−0.5 → 50), `bulkMirrorsCut` (+0.25/+0.25 → 100, −0.1/+0.25 → 0), `plannedZeroIsNil`, `maintainInsideBand` (centre → 100, edge → 80), `maintainOutsideBand` (one band-width out → 0), `maintainDegenerateBandIsNil`, `missingInputsAreNil`.
- [ ] Step 2: `sulyHead` tests: `on_course` → "Pályán vagy a súlycélhoz"; `slower` → "Lassabb a tervnél"; `faster` → "Gyorsabb a tervnél"; `in_band` → "A sávban vagy"; `out_of_band` → "Kint a sávból"; `no_data` → "Még kevés a mérés"; `hasSeason == false` → "Nincs évad" / sentence mentions „az Évadban"; the cut sentence carries the two rates ("heti 0,4 kg … a terv 0,5") and the target when known.
- [ ] Step 3: Implement; `SulyCourse(trajectory:)` maps `"cut"`, `"bulk"`, anything else → `.maintain`. Numbers formatted with `nkRound`-style one decimal and a comma (`sulyKg(_:)` public helper).
- [ ] Step 4: Native run: `cd <scratchpad>/kit && swift test --filter SulyLogicTests` → green.
- [ ] Step 5: Commit `feat(boop): the weight-pace score and the Súly head words (mezo-r36n9.158)`.

### Task 4: The weight client and wire types (BoopCore)

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Suly/SulyWire.swift`, `ios/BoopKit/Sources/BoopCore/Suly/SulyClient.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/SulyClientTests.swift`

**Interfaces:** Produces
```swift
public struct SulyTrendPoint: Codable, Equatable, Sendable { public let date: String; public let trendKg: Double }
public struct SulyTrend: Codable, Equatable, Sendable { ewmaSeries: [SulyTrendPoint]; latestTrendKg: Double?; weeklyRateKgPerWeek: Double?; last4wRateKgPerWeek: Double?; dataSufficiency: String }  // lenient decode, missing → nil / "none"
public struct SulyLog: Codable, Equatable, Identifiable, Sendable { id: String; date: String; kg: Double; note: String? }  // "value" on the wire
public struct SulyClient: Sendable { init(raw: RawJSONClient); func trend() async throws(PlanFetchError) -> SulyTrend; func logs() async throws(PlanFetchError) -> [SulyLog] }
```
- [ ] Step 1: Tests with a stub transport (the `EvadClient` tests' pattern): `trendDecodesTheContract` (fixture with the five fields), `trendWithoutRatesIsLenient` (`{"ewmaSeries":[],"dataSufficiency":"none"}` → nil rates), `logsMapValueToKg`, `aServerFaultIsTyped` (500 → `.server`).
- [ ] Step 2: Implement over `raw.get("/api/biometrics/weight/trend", operationID: "getWeightTrend")` and `raw.get("/api/biometrics/weight", operationID: "listWeightLogs")`.
- [ ] Step 3: `swift test --filter SulyClientTests` green; commit `feat(boop): the weight trend and log client (mezo-r36n9.158)`.

### Task 5: The Súly store (BoopCore)

**Files:**
- Create: `ios/BoopKit/Sources/BoopCore/Suly/SulyStore.swift`
- Test: `ios/BoopKit/Tests/BoopCoreTests/SulyStoreTests.swift`

**Interfaces:** Produces
```swift
public struct SulyBodySample: Codable, Equatable, Sendable { date: Date; value: Double; source: String }
public struct SulySnapshot: Codable, Equatable, Sendable { season: EvadOverview?; trend: SulyTrend?; logs: [SulyLog]; fatPct: [SulyBodySample]; leanKg: [SulyBodySample]; fetchedAt: Date }
@MainActor @Observable public final class SulyStore {
    public init(evad: EvadClient?, client: SulyClient?, health: HealthReader?, cache: ServerCache?, clock: @escaping @Sendable () -> Date = { Date() })
    public private(set) var snapshot: SulySnapshot?; var offline: Bool; var problem: PlanFetchError?; var loading: Bool; var age: TimeInterval?
    public var score: Int?                      // sulyPaceScore over the snapshot (nil without season/trend or sufficiency "none")
    public var course: SulyCourse; public var head: SulyHead
    public func load(force: Bool = false) async
}
```
- [ ] Step 1: Tests with stub `RawJSONClient` transports and a `StubHealthReader`: `scoreComesFromTheTrendAndTheSeason` (season cut planned −0.5, trend last4w −0.42 → 84), `noSeasonIsHonest` (404 → `season == nil`, `score == nil`, head "Nincs évad", trend kept), `insufficientDataIsNil` (`dataSufficiency: "none"` → nil), `offlineServesTheCache` (first read ok, second read throws `.offline` → same snapshot, `offline == true`, `age != nil`), `bodySamplesAreReadFromHealth` (fat % 21.4 → `fatPct.last?.value == 21.4`).
- [ ] Step 2: Implement: four `Task {}` handles (season, trend, logs, body 90 d), `season` 404 → nil without failure; cache endpoint `"suly/snapshot"` key `"-"`, `maxAge` 14 d; `reloadAgain` guard as `PenzStore`.
- [ ] Step 3: `swift test --filter SulyStoreTests` green; commit `feat(boop): the Súly store — season, trend, weigh-ins, body samples, cache (mezo-r36n9.158)`.

### Task 6: The ninth orb on the ring

**Files:**
- Modify: `ios/Boop/Kezdolap/Area.swift` (spike version), `ios/Boop/Kezdolap/KezdolapView.swift` (`@Environment(SulyStore.self)`, `loadNumbers` adds `await suly?.load()`, `.onChange(of: ritmus?.weightTick)`, `ringItem(... suly: suly?.score)`, orb size rule, `-previewHome suly`)
- Modify: `ios/Boop/RootView.swift` (live `SulyStore(evad: EvadClient(raw: session.raw), client: SulyClient(raw: session.raw), health: HealthKitReader(), cache:)`; preview `SulyPreview.store(cache:)`), `ios/Boop/Nap/{AreaRoom,MaiView,NapView}.swift` (spike switches)
- Create: `ios/Boop/Suly/SulyPreview.swift` (a `RawJSONClient` over a `SulyPreviewTransport` answering the two weight paths; the season comes from `EvadPreviewFixtures.client`; a `PreviewHealthReader` with 12 fat % and lean samples)
- Test: `ios/BoopTests/KezdolapRingTests.swift` (`sulyOrbIsLiveAndShowsThePaceScore`, `sulyOrbWithoutStoreIsDash`, `ringHasNineAreasWithSulyAfterEnergia`), `ios/BoopTests/MaiCopyTests.swift` (`Hue.allCases.count == Hue.metrics.count + 3`)
- [ ] Step 1: Write the three ring tests (`Area.allCases.map(\.name) == ["Nap","Alvás","Étel","Edzés","Energia","Súly","Forma","Pénz","Levél"]`; `ringItem(.suly, brief: nil, suly: 84)` → display "84", level 0.84, live; `ringItem(.suly, brief: nil)` → "–").
- [ ] Step 2: Wire the store (remove `SulyFixture.previewScore`); keep the Pro Max/SE size rule.
- [ ] Step 3: Build for the simulator; `-preview shell` shows the gold orb with the preview score; commit `feat(boop): the ninth orb — Súly on the ring, fed by the Súly store (mezo-r36n9.158)`.

### Task 7: The quick doors

**Files:**
- Modify: `ios/Boop/Kezdolap/KezdolapView.swift` (`quickDoors`, `static let doors` — spike), `ios/Boop/Capture/CaptureSheet.swift` (`\.openPick`), `ios/Boop/Shell/ShellView.swift` (`handle(_:afterSheet:)`)
- Test: `ios/BoopTests/CaptureSheetTests.swift`
- [ ] Step 1: Tests `homeDoorsAreTheFiveFrequentOnes` (labels `["ÉTKEZÉS","VÍZ","SÚLY","CHECK-IN","NAPLÓ"]`, picks as in Global Constraints) and `everyHomeDoorIsAlsoOnTheSheet` (each pick is a `CaptureSheet.doors` pick, a `foodChips` entrance or the meal card).
- [ ] Step 2: Keep the spike code; a11y "<Név> rögzítése".
- [ ] Step 3: Commit `feat(boop): five quick doors under Boop's line replace the capsule (mezo-r36n9.157)`.

### Task 8: The Súly room

**Files:**
- Create: `ios/Boop/Suly/SulyRoom.swift` (page, tabs, `-sulyTab`), `ios/Boop/Suly/SulyTabs.swift` (`SulyMa`, `SulyTest`, `SulyNaplo`), `ios/Boop/Suly/SulyFaces.swift` (`sulyHue`, `SulyActionRow` = `PenzActionRow` generalised with a hue, the info sheet text `sulyRuleText`)
- Create: `ios/BoopKit/Sources/BoopCore/Suly/SulyRows.swift` (pure builders) + Test `ios/BoopKit/Tests/BoopCoreTests/SulyRowsTests.swift`
- Delete: the spike fixture (`SulyFixture`) from `SulyRoom.swift`

**Interfaces:** Produces
```swift
public struct SulyWeek: Equatable, Sendable { label: String; averageKg: Double?; logs: [SulyLog] }
public func sulyWeeks(_ logs: [SulyLog], today: String, calendar: Calendar, weeks: Int = 12) -> [SulyWeek]   // "EZ A HÉT", "MÚLT HÉT", then "nov. 3–9."
public func sulyLogTitle(_ log: SulyLog, calendar: Calendar) -> String   // "Csütörtök" (date only — the log has no time)
public func sulyCurve(_ season: EvadOverview?, trend: SulyTrend?) -> (values: [Double], labels: [String], target: Double?, now: Int)?  // season series + projection; else the trend's last 8 weeks
public func sulyMaStats(score:…) -> [NKStat]-free tuple list (value, unit, label, hot)  // most (trend) · a cél · heti ütem
public func sulyBmi(kg: Double?, heightCm: Double?) -> Double?
```
- [ ] Step 1: `SulyRowsTests`: `weeksGroupMondayFirst` (logs across three weeks → three groups, first label "EZ A HÉT", averages one decimal), `logTitleIsTheWeekday`, `curvePrefersTheSeason` (series + projection concatenated, `now == series.count − 1`, target = season target), `curveFallsBackToTheTrend`, `bmiNeedsBoth`.
- [ ] Step 2: Build the room from the spike, fed by `@Environment(SulyStore.self)`; head `level: score/100`, `display: "\(score)"`; the Test tab's latest fat % / lean kg ≤ 30 d else "–"; the Napló from `sulyWeeks`; the info sheet via `.sheet(item:)` at page level; `.task { await store?.load() }`, `.onChange(of: ritmus?.weightTick) { load(force: true) }`.
- [ ] Step 3: Build; `-preview shell -previewHome suly [-sulyTab Test|Napló]` on both simulators, screenshots to `docs/superpowers/specs/assets/suly-orb-gyorsajtok/built/`.
- [ ] Step 4: Commit `feat(boop): the Súly room — Ma, Test, Napló on the shared area page (mezo-r36n9.158)`.

### Task 9: The weight tick

**Files:**
- Modify: `ios/Boop/Ritmus/RitmusEnvironment.swift` (`private(set) var weightTick`, `weightChanged()`; bumped in `captureWeight` and when an `.weightLog` item is reported sent — the same hook `penzChanged` uses)
- Test: `ios/BoopTests/MaFoodRowsTests.swift` or a new `ios/BoopTests/RitmusTickTests.swift`: `captureWeightBumpsTheTick`.
- [ ] Step 1: Test; implement; commit `feat(boop): the Súly orb and room re-read after a weigh-in (mezo-r36n9.158)`.

### Task 10: Docs, mirror, decisions

**Files:**
- Create: `docs/boop-handbook/13-suly/00-attekintes.md` (Fő szekció), `docs/boop-handbook/13-suly/01-terulet.md` (Funkció: a szoba, a szám, a Test fül, a Napló, offline); README folder table row.
- Modify: `docs/boop-handbook/01-alapok/kezdolap.md` (nine orbs, the doors), `01-alapok/gyors-rogzites.md` (the doors replace the capsule), new Kis funkció `01-alapok/lapok-bezarasa.md`; `_dontesek.json` (+4: `d-2026-11-24-lapok-x`, `-gyorsajtok`, `-suly-orb-utem`, `-test-ful`), `_jegyek.json` (.156–.158, munkamenet `suly-orb-gyorsajtok`), `_funkciok.json` (`Súlynapló`, `Kisimított súlytrend és heti tempó` → `Kész`, app note the Súly room; `Jó úton vagy-e` note the orb), `docs/superpowers/research/boop-standalone/14-decisions.md` (#99–#102), `docs/features/boop-ios.md` (§2 Súly room + doors + sheet close, §9 the refreshable leak gotcha, §10 files), `ios/README.md` (`-previewHome suly`, `-sulyTab`), `docs/guides/boop-telefon-telepites-atado-2026-11-23.md` (third bundle), `docs/superpowers/specs/2026-11-13-boop-kezdolap-design.md` (nine orbs note), `bd` acceptance on `.156–.158`.
- [ ] Step 1: Write; `node scripts/lint-docs.mjs` → 0 errors / 0 stale; `node scripts/gen-codemap.mjs`.
- [ ] Step 2: Commit `docs(boop): handbook, decisions #99–#102, mirror rows for the Súly area, the doors and the sheet close (mezo-r36n9.156–.158)`.

### Task 11: Gates, review, ship

- [ ] Native BoopCore suite in the scratchpad kit copy: `swift test` → all green (count noted).
- [ ] `xcodebuild build` Boop for the simulator → 0 errors; the app launches in `-preview shell`, the ring, the room, a sheet with the X — screenshots in the assets folder.
- [ ] `node scripts/check-ios-contract.mjs` unchanged (no filter change); `git grep DEVELOPMENT_TEAM ios/` empty.
- [ ] Fresh-context review on the most capable model (`feature-dev:code-reviewer`); fix Critical/Important with failing tests first.
- [ ] `git fetch && git rebase origin/main`; `git checkout --detach origin/main && git merge --no-ff feat/boop-suly-orb-gyorsajtok && git push origin HEAD:main`; ff the primary checkout; `_kiadasok.json` row (merge sha); `node scripts/check-beads-backup.mjs --fix`; close `.156–.158` with evidence, extend `.150` (xcodebuild test + install on the other Mac), note `.148` (Notion sync); delete the spike branch and the simulators.

## Kész, ha… (the done-checklist, also on the bd issues)

- [ ] Every `NKSheetFrame` sheet shows the glass X top-right; tapping it closes; a11y „Bezárom"; the drag still closes.
- [ ] Étel sheets: a pull at the top dismisses (verified on the phone by the owner / the Xcode Mac); the room's own pull still reloads.
- [ ] Home: no capsule; five doors Étkezés · Víz · Súly · Check-in · Napló; each opens its sheet at once; the bar's „+" unchanged; smallest width (SE) and Pro Max both right; reduced motion unaffected.
- [ ] Ring: nine orbs in the fixed order; Súly gold, live, number = pace score or „–"; orbs 46/52/56 by width; names never touch a neighbour (SE screenshot).
- [ ] Súly room: Ma · Test · Napló · Boop bar, the Test tab with its own body glyph; head orb number = score; every block has loading / failed / empty state; offline shows the cached read with its age; no season → honest head, trend still drawn; „Súly rögzítése" opens the weight sheet and the room re-reads after it.
- [ ] Parity: nothing else on the home, the Étel room or the Pénz room changed.
- [ ] Gates: BoopCore native suite green; app builds; lint-docs 0/0; codemap regenerated; contract check unchanged; fresh review done.
- [ ] Docs: handbook `13-suly/` + the three touched pages; `_jegyek/_dontesek/_kiadasok/_funkciok.json`; `boop-ios.md`; `ios/README.md`; decisions #99–#102; handover extended.
- [ ] Shipped: merged to main, CI green, primary ff'd, beads backup committed; `xcodebuild test` + phone install recorded on `.150` for the Xcode Mac.
