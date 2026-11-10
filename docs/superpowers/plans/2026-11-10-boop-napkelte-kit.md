# Boop S2.5 · Napkelte kit + frame re-skin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the approved "Napkelte" look into the shipped Boop app: a reusable kit in `BoopDesign` (ground, hues, painted landscape, orbs, glass, type, frames, chart pieces, the path), and every screen the app already has (sign-in, onboarding, connect, shell, Nap's empty state, the web-only tabs) re-skinned in it — so S3 (morning brief + the real Mai) and S4 (morning steps) build on finished pieces.

**Architecture:** Port the spike's views (`docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/Aura*.swift`) into `ios/BoopKit/Sources/BoopDesign/Napkelte/` as public, data-driven components; pure decisions (rise height, palette padding, path lighting, hue per page) become tested functions. The app's screens swap the Lágy kit for the Napkelte kit; the Lágy files stay until nothing uses them. Screens that were never drawn get one simulator spike round and the owner's OK before Task 9–11 build them.

**Tech Stack:** SwiftUI (iOS 26 SDK, Liquid Glass `glassEffect`, `GlassEffectContainer`, scroll transitions, `visualEffect`), Metal shader `Orb.metal` (exists), Swift Testing, `ImageRenderer` for render smoke tests, CoreMotion (orb slosh).

**Spec:** [`docs/superpowers/specs/2026-11-10-boop-napkelte-design.md`](../specs/2026-11-10-boop-napkelte-design.md) (look) and [`2026-11-09-boop-ios-v1-design.md`](../specs/2026-11-09-boop-ios-v1-design.md) (data, install, slices). Spike = executable reference; copy its values.

## Slice map (where this plan sits)

| Slice | Content | Status |
|---|---|---|
| S1 alap, S2 adatok | auth, onboarding, shell, Health + calendar sync | shipped |
| **S2.5 Napkelte kit (this plan)** | kit + re-skin of everything shipped + spike round for undrawn screens | — |
| S3 reggel | morning brief backend (five metric verdicts, §9.1), the real Mai: hero, rising orb, lens actions, per-orb tiles + paths, sheets, A napom path, evening Mai, kímélő | own plan, after S2.5 |
| S4 lépések | check-in (+ midday/afternoon sets, body map), szándék, mérlegelés, első étkezés, Boop észrevette list, "+" sheet, notifications list | own plan |
| later | widgets + in-place notification actions; napzárás (Rutin round); the other domains' rounds | — |

## Global Constraints

- Ground `#0D1218`; colour lives **only** in the painted backdrop and the orbs; everything else white on glass (spec §4.1).
- Card glass: white 7 % fill, radius 26 pt continuous, 1 pt stroke gradient white 16 % → 3 %; tiles radius 22; **no coloured glows on cards**.
- Primary action = solid white pill, dark text; secondary = white 10 % pill. Floating controls = system Liquid Glass.
- Type: headlines/Boop's voice serif (system New York) — hero headline 42 pt, inner titles 38–40, brief 18–19; numbers Outfit Light; labels monospaced caps 12 pt with tracking; body system sans 15–17. Manrope not used in this look.
- Five hues (sky top · middle · horizon / orb quad) exactly as `PaintedLandscape.skies` and `SunMetric.all[].orb` in the spike; order Forma, Alvás, Mozgás, Fuel, Pulzus. **"Készenlét" is called "Forma"** in every string.
- Orb palettes always have **4 colours** (3 crashes the shader).
- Bottom bar: five domains, **icons only**, names as accessibility labels.
- Tabs: thin text tabs, selected = white semibold + **1 pt** underline, others white 62 %, **no hairline** under the row.
- Mini orbs: 46 pt, five equal columns, only the selected one alive and full colour; others ~25 % saturation and still; **no rings**.
- Rise mapping: `t = clamp((score − 40) / 60, 0, 1)`; at t = 0 the orb's centre sits on the horizon (clipped below).
- Ground never black: deep hue gradient (`top.mix(with: ground, by: 0.55 → 0.78 → 0.7)`), floating lights (opacity 0.30 / 0.24 / 0.20, parallax 0.35), mirrored landscape at the bottom (opacity 0.28).
- Companion = **Boop**; Hungarian copy; no emoji; no SF Symbols except chevrons/arrows/plus/minus/checkmark in system controls.
- Reduced motion: end states, no rise animation, no typing, still orbs.
- Files owned by no other in-progress issue may be edited (S2 shipped); `ios/Boop.xcodeproj/**` needs no edit (synchronized groups); never commit a team id.

## Review Focus

1. **A palette with fewer than 4 colours** reaching the shader → must pad, never crash (Task 3 test `orbPaletteAlwaysFour`).
2. **Score outside 0–100 or nil** (thin data) → rise clamps; nil shows the "még tanulom" still orb, no rise (Task 3 tests `riseClamps`, `nilScoreIsLearning`).
3. **Reduced motion on** → the hero renders its end state; no `TimelineView` animation runs (Task 3 test `stillOrbUnderReducedMotion` via the `animated` flag).
4. **Dynamic Type at XXL** on tiles and the tab strip → text shrinks (`minimumScaleFactor`) instead of clipping (Task 5/6 render tests at `.accessibility3`).
5. **No calendar / offline / sync failed** on the Nap empty page → each shows its own line and action, not a blank (Task 11 tests on `NapEmptyState.from(...)`).

---

### Task 0: Spike round for the undrawn screens → owner OK (gate)

Not product code: extend the throwaway spike (`docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/`, new file `AuraFrame.swift`, routed from `AuraRoot` with `-auraFrame <name>`). Draw, in the approved language:
sign-in · register (invite code, field error, offline card) · onboarding (profile, first weight with the ruler, "Szia, Boop vagyok") · Health/Calendar permissions · 60-day backfill progress · the Connect card on the Nap empty page · Nap empty / thin-data (< 14 nights: "még tanulom" still orb) / offline / brief-failed states · the "+" quick-add sheet (Víz · Étel · Súly · Edzés · Napló) · notifications list (bell) · settings/profile (avatar) · evening Mai · kímélő Mai · check-in body-map question · Boop észrevette full list.

- [ ] **Step 1:** Build each as a launchable state; verify every one in your own simulator (`xcrun simctl create "Boop · mezo-r36n9.3" …`), screenshot each into `docs/design_2.0/prototypes/boop-ios-spike/aura-frame-*.png`.
- [ ] **Step 2:** Hand over in Hungarian (CLAUDE.md §Communication): what to tap, what is new, 1–2 questions. **Stop until the owner OKs.** Record his changes in spec §10 and commit.

### Task 1: Napkelte tokens and type ramp

**Files:**
- Create: `ios/BoopKit/Sources/BoopDesign/Napkelte/Tokens.swift`
- Test: `ios/BoopKit/Tests/BoopDesignTests/NapkelteTokensTests.swift`

**Interfaces:**
- Produces: `public enum NK { static let ground: Color; static func deepGround(_ h: Hue) -> [Color] }`, `public enum Hue: Int, CaseIterable { case forma, alvas, mozgas, fuel, pulzus; var name: String; var sky: [Color] /*3*/; var orb: [Color] /*4*/; var glow: Color; var top: Color }`, `public extension Font { static func nkSerif(_ s: CGFloat, _ w: Font.Weight = .regular) -> Font; static func nkMono(_ s: CGFloat, _ w: Font.Weight = .medium) -> Font; static func nkNumber(_ s: CGFloat) -> Font /*Outfit Light*/ }`.

- [ ] **Step 1: Write the failing tests**

```swift
@Test func hueNamesAndOrder() {
    #expect(Hue.allCases.map(\.name) == ["Forma", "Alvás", "Mozgás", "Fuel", "Pulzus"])
}
@Test func everyHueHasThreeSkiesAndFourOrbColours() {
    for h in Hue.allCases { #expect(h.sky.count == 3); #expect(h.orb.count == 4) }
}
@Test func groundMatchesSpec() { #expect(rgb(NK.ground) == (0x0D, 0x12, 0x18)) }
@Test func formaGlowMatchesSpike() { #expect(rgb(Hue.forma.glow) == (0x8B, 0x6C, 0xF0)) }
```
(`rgb` helper as in `DesignKitTests.tokensMatchCanon`.)

- [ ] **Step 2:** Run `cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath ../build/kit -only-testing:BoopDesignTests/NapkelteTokensTests` → FAIL (`Hue` undefined).
- [ ] **Step 3:** Implement `Tokens.swift` with the spike's values (`AuraSunrise.swift` `SunMetric.all` glow/top/orb, `PaintedLandscape.skies`); `deepGround` = `[top.mix(with: ground, by: 0.55), …0.78, …0.7]`.
- [ ] **Step 4:** Re-run → PASS.
- [ ] **Step 5:** Commit `feat(ios): Napkelte tokens and type ramp (mezo-r36n9.3)`.

### Task 2: Painted landscape + mirrored land

**Files:**
- Create: `ios/BoopKit/Sources/BoopDesign/Napkelte/Landscape.swift`
- Test: `ios/BoopKit/Tests/BoopDesignTests/NapkelteRenderTests.swift`

**Interfaces:**
- Consumes: `Hue` (Task 1).
- Produces: `public struct PaintedLandscape: View { public init(hue: Hue) }` (ridge layers as in the spike, seeded per hue so a page always looks the same), `public struct MirroredLand: View { public init(hue: Hue) }` (300 pt, flipped, opacity 0.28, mask clear → black).

- [ ] **Step 1:** Test `everyHueRendersALandscape`: for each `Hue`, `ImageRenderer(content: PaintedLandscape(hue:).frame(width: 390, height: 600)).uiImage` is non-nil and its centre pixel is not the ground colour.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Port `PaintedLandscape` (Canvas sky gradient, horizon glow, 4 ridges with aerial perspective, haze) and `MirroredLand` from `AuraPath.swift` / `AuraSunrise.swift`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ios): Napkelte painted landscape (mezo-r36n9.3)`.

### Task 3: Orbs — living, still, rising hero, mini row

**Files:**
- Create: `ios/BoopKit/Sources/BoopDesign/Napkelte/Orbs.swift`
- Modify: `ios/BoopKit/Sources/BoopDesign/Graphics.swift` (make the existing `ShaderLibrary.bundle(.module).orb` call site shared, no behaviour change)
- Test: `ios/BoopKit/Tests/BoopDesignTests/NapkelteOrbTests.swift`

**Interfaces:**
- Consumes: `Hue`.
- Produces:
  - `public func orbPalette(_ c: [Color]) -> [Color]` (pads/truncates to 4),
  - `public func riseFraction(score: Int?) -> Double?` (nil → nil; else `clamp((s − 40)/60)`),
  - `@Observable public final class OrbMotion` (tilt spring, speak surge, ripple — port from spike `LivingOrb.swift`),
  - `public struct LivingOrb: View { init(palette: [Color], size: CGFloat, level: Double, glow: Bool, motion: OrbMotion, animated: Bool = true) }`,
  - `public struct StillOrb: View { init(palette: [Color], size: CGFloat, level: Double) }`,
  - `public struct RisingOrb: View { init(hue: Hue, score: Int?, display: String, motion: OrbMotion) }` (156 pt, number inside, clipped at the horizon; nil score = "még tanulom" still orb, no rise),
  - `public struct MiniOrbRow: View { init(items: [(Hue, String)], selected: Binding<Hue>) }` (five equal columns, selected live, others `StillOrb` saturation 0.25 opacity 0.75, no rings, tap selects with `.sensoryFeedback(.selection)`).

- [ ] **Step 1: Write the failing tests**

```swift
@Test func orbPaletteAlwaysFour() {
    #expect(orbPalette([.red, .blue, .green]).count == 4)
    #expect(orbPalette([.red]).count == 4)
    #expect(orbPalette([.red, .blue, .green, .white, .black]).count == 4)
}
@Test func riseClamps() {
    #expect(riseFraction(score: 40) == 0); #expect(riseFraction(score: 100) == 1)
    #expect(riseFraction(score: 0) == 0); #expect(riseFraction(score: 130) == 1)
    #expect(abs(riseFraction(score: 78)! - 0.6333) < 0.001)
}
@Test func nilScoreIsLearning() { #expect(riseFraction(score: nil) == nil) }
@Test @MainActor func stillOrbUnderReducedMotion() {
    let img = ImageRenderer(content: LivingOrb(palette: Hue.forma.orb, size: 100, level: 0.7, glow: false, motion: OrbMotion(), animated: false)).uiImage
    #expect(img != nil)
}
```

- [ ] **Step 2:** Run `-only-testing:BoopDesignTests/NapkelteOrbTests` → FAIL.
- [ ] **Step 3:** Implement; `LivingOrb` reads `accessibilityReduceMotion` and treats it as `animated == false` (end state, paused timeline); the mini row uses `.allowsHitTesting(false)` on the orbs and a tap on the column (the spike's "orb swallowed the tap" bug).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ios): Napkelte orbs (mezo-r36n9.3)`.

### Task 4: Glass, controls, small marks

**Files:**
- Create: `ios/BoopKit/Sources/BoopDesign/Napkelte/Glass.swift`
- Test: extend `NapkelteRenderTests.swift`

**Interfaces:**
- Produces: `public extension View { func nkGlass(_ radius: CGFloat = 26) -> some View }`, `public struct NKPill: View { init(_ title: String, glyph: String? = nil, primary: Bool = true, action: () -> Void) }`, `public struct NKMono: View { init(_ text: String) }`, `public struct Trend: View { init(up: Bool, size: CGFloat = 9) }`, `public struct NKToast: ViewModifier` + `func nkToast(_ text: Binding<String?>) -> some View` (glass capsule from the top, 2.2 s, success haptic), `public struct NKGlyph: View { init(_ name: String, _ color: Color, size: CGFloat) }` (template-tinted Lágy glyph; outlined stand-ins for check/clock/camera/book as in `AuraSpike.swift` `AuraGlyph`).

- [ ] **Step 1:** Test `outlinedGlyphsRender`: `NKGlyph("check-ink", .white, size: 22)` renders non-nil; test `pillRendersAtAccessibilitySize` renders `NKPill("Kitöltöm")` with `.dynamicTypeSize(.accessibility3)` non-nil.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (values in Global Constraints). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(ios): Napkelte glass and controls (mezo-r36n9.3)`.

### Task 5: Frames — tab page, inner page, sheet, nav

**Files:**
- Create: `ios/BoopKit/Sources/BoopDesign/Napkelte/Frames.swift`
- Test: extend `NapkelteRenderTests.swift`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `public struct NKTitleRow: View { init(onBell: () -> Void, bellCount: Int, onPlus: () -> Void, onAvatar: () -> Void) }` (bell left with count, "boop" Outfit Light tracking 3 centre, "+" and avatar glass circle right),
  - `public struct NKTabStrip: View { init(tabs: [String], selected: Binding<String>, dot: String?) }`,
  - `public struct NKTabPage<Hero: View, Content: View>: View { init(hue: Hue, heroHeight: CGFloat?, compact: NKCompact?, @ViewBuilder hero: () -> Hero, @ViewBuilder content: () -> Content) }` — painted backdrop (full height when `heroHeight == nil`, else that height), deep-hue ground, `FloatingLights`, `MirroredLand` at the end, compact capsule when the hero scrolls away (`onScrollGeometryChange`),
  - `public struct NKCompact { let palette: [Color]; let title: String; let value: String; let line: String }`,
  - `public struct NKFlowFrame<Content: View>: View { init(hue: Hue, crumb: String, eyebrow: String, title: String, sub: String, onBack: () -> Void, @ViewBuilder content: () -> Content) }` (360 pt head),
  - `public struct NKSheetFrame<Content: View>: View { init(hue: Hue, eyebrow: String, title: String, @ViewBuilder content: () -> Content) }` (170 pt band; use with `.presentationDetents([.medium, .large])`, background ground, radius 34),
  - `public struct NKNav: View { init(selected: Binding<String>) }` (icons only: sun-ink, dumbbell-ink, bowl-cream, chat-ink, person-sage; `accessibilityLabel` Nap/Edzés/Fuel/Boop/Én; selected white on a white 12 % capsule, others 45 %).
- [ ] **Step 1:** Tests: `navHasNoVisibleLabels` (NKNav's items expose accessibility labels "Nap", "Edzés", "Fuel", "Boop", "Én" — expose `NKNav.items` as an internal static for the test); `tabStripRendersAtAccessibilitySize`; `flowFrameRenders`.
- [ ] **Step 2:** FAIL. **Step 3:** Port from `AuraSunrise.swift` (header, hero, compact, pageBackground), `AuraSteps.swift` (`AuraStepFrame`), `AuraSheets.swift` (`AuraDetailSheet` band), `AuraSpike.swift` (`AuraTabBar`), `AuraPath.swift` (`FloatingLights`). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(ios): Napkelte frames and nav (mezo-r36n9.3)`.

### Task 6: Chart pieces and tiles

**Files:**
- Create: `ios/BoopKit/Sources/BoopDesign/Napkelte/Charts.swift`, `ios/BoopKit/Sources/BoopDesign/Napkelte/Tiles.swift`
- Test: `ios/BoopKit/Tests/BoopDesignTests/NapkelteChartTests.swift`

**Interfaces:**
- Produces (all data-driven, no fake data inside): `Hypnogram(segments: [(stage: Int, minutes: Double)])` + `HypnogramLegend(rows: [(stage: Int, label: String, time: String, share: Double)])`, `GlowLine(points: [Double], nowAt: Double?)`, `WeekBars(values: [Double], average: Double, unit: String, labels: [String])`, `BusyRibbon(slots: [Double])` (72 × 15-min busy levels 0…1, `trainingSlot: Int?`), `NKTile(label:value:sub:graphic:)` with `minimumScaleFactor(0.7)`, graphics `WaterGlass(level:dropping:)`, `StepTrail(progress:)`, `NightArc()`, `SleepLatency()`, `LevelBars(values:tints:wide:)`.
- [ ] **Step 1:** Tests: `hypnogramShareSumsToOne` (legend shares from segments sum to 1 ± 0.01 via `public func stageShares(_:) -> [Int: Double]`), `weekBarsHandleFlatData` (all equal values render, no division by zero: `weekBarScale(values:)` returns finite lo < hi), `tileRendersAtAccessibilitySize`.
- [ ] **Step 2:** FAIL. **Step 3:** Port from `AuraSpike.swift`, `AuraSunrise.swift`, `AuraSheets.swift`, `AuraPath.swift`. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(ios): Napkelte charts and tiles (mezo-r36n9.3)`.

### Task 7: The path component

**Files:**
- Create: `ios/BoopKit/Sources/BoopDesign/Napkelte/DayPath.swift`
- Test: `ios/BoopKit/Tests/BoopDesignTests/NapkeltePathTests.swift`

**Interfaces:**
- Produces: `public struct PathStation: Identifiable { id: String; time: String; glyph: String; title: String; sub: String; done: Bool; isNow: Bool }`, `public func pathLit(_ stations: [PathStation]) -> [Bool]` (segment below station i is lit iff station i and i+1 are both done/now-or-earlier), `public struct DayPath<Card: View>: View { init(stations: [PathStation], hue: Hue, @ViewBuilder card: (PathStation) -> Card?) }` (MOST row with `NowPulse`, scroll transitions as in the spike).
- [ ] **Step 1:** Tests: `litUpToNow` (stations [done, done, now, todo, todo] → `[true, true, false, false, false]`); `emptyPathIsEmpty` (`pathLit([]) == []`); `nowOnlyPath` (single now station → `[false]`).
- [ ] **Step 2:** FAIL. **Step 3:** Port `DayPath`/`NowPulse` rows from `AuraPath.swift`, cards supplied by the caller. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(ios): Napkelte day path (mezo-r36n9.3)`.

### Task 8: Shell in the new look

**Files:**
- Modify: `ios/Boop/Shell/ShellView.swift` (replace `LagyNav` with `NKNav`; dark scheme), `ios/Boop/Shell/WebOnlyTabView.swift` (as an `NKTabPage` with the domain's hue-less ground: Forma hue for Boop, Mozgás for Edzés, Fuel for Fuel, Alvás for Én — *call*, keep its copy and "Megnyitom" action), `ios/Boop/Shell/EnAccountSection.swift` (glass card, confirmed sign-out unchanged)
- Test: `ios/BoopTests/GreetingTests.swift` unchanged must pass; add `ios/BoopTests/ShellTests.swift` with `webTabsKeepTheirCopy` (each `WebOnlyTabView.Domain` still returns the same `boopLine`).
- [ ] **Step 1:** Write `ShellTests` → run app tests (`cd ios && xcodebuild test -project Boop.xcodeproj -scheme Boop … -only-testing:BoopTests/ShellTests`) → PASS already for copy (guard), then make the UI change.
- [ ] **Step 2:** Implement; run all app tests → PASS; launch in your simulator with `-preview shell` and screenshot the five tabs.
- [ ] **Step 3:** Commit `feat(ios): shell and web-only tabs in the Napkelte look (mezo-r36n9.3)`.

### Task 9: Sign-in and register re-skin (per Task 0 OK)

**Files:** Modify `ios/Boop/Auth/AuthFlow.swift`, `ios/Boop/Auth/AuthForm.swift`, `ios/Boop/RootView.swift` (Splash, OfflineView). Test: `ios/BoopTests/AuthFormTests.swift` must stay green (behaviour unchanged); add `authCopyIsBoop` (no "Mezo" in any visible string of the auth views — assert on the copy constants).
- [ ] **Step 1:** Add the copy test → PASS on current copy. **Step 2:** Rebuild the views to the Task 0 screens with `NKFlowFrame`/`NKPill`/glass fields (field errors and the offline card included). **Step 3:** App tests → PASS; screenshot `-preview` states. **Step 4:** Commit `feat(ios): sign-in and register in the Napkelte look (mezo-r36n9.3)`.

### Task 10: Onboarding + Connect re-skin (per Task 0 OK)

**Files:** Modify `ios/Boop/Onboarding/{OnboardingFlow,ProfileStep,WeightStep,RulerDial}.swift`, `ios/Boop/Connect/{ConnectFlow,ConnectCard,PermissionsStep,BackfillStep}.swift`. Tests: `OnboardingModelTests`, `ConnectCopyTests`, `HealthSyncTests` stay green.
- [ ] **Step 1:** Rebuild each step on `NKFlowFrame` (hues: profile Forma, weight Fuel, permissions Alvás, backfill Alvás with a filling `StillOrb` as progress — *call*), the ruler as in `AuraSteps.swift` `AuraWeight.ruler`. **Step 2:** All app + kit tests → PASS; run `-preview onboarding` and the connect cover in your simulator, screenshot each step. **Step 3:** Commit `feat(ios): onboarding and connect in the Napkelte look (mezo-r36n9.3)`.

### Task 11: Nap · Mai empty and thin-data states

**Files:**
- Create: `ios/Boop/Nap/NapView.swift`, `ios/BoopKit/Sources/BoopCore/NapEmptyState.swift`
- Delete: `ios/Boop/Shell/NapEmptyView.swift` (replaced; `ShellView` points at `NapView`)
- Test: `ios/BoopKit/Tests/BoopCoreTests/NapEmptyStateTests.swift`

**Interfaces:**
- Produces: `public enum NapEmptyState: Equatable { case notConnected, syncing(progress: Double), learning(nights: Int), noCalendar, offline, ready; public static func from(connected: Bool, syncProgress: Double?, nights: Int, calendarRows: Int, online: Bool) -> NapEmptyState }` (priority: offline > notConnected > syncing > learning (< 14 nights) > noCalendar > ready).
- [ ] **Step 1: Write the failing tests**

```swift
@Test func offlineWins() { #expect(NapEmptyState.from(connected: true, syncProgress: nil, nights: 30, calendarRows: 3, online: false) == .offline) }
@Test func thinDataIsLearning() { #expect(NapEmptyState.from(connected: true, syncProgress: nil, nights: 9, calendarRows: 3, online: true) == .learning(nights: 9)) }
@Test func noCalendarAfterEnoughNights() { #expect(NapEmptyState.from(connected: true, syncProgress: nil, nights: 35, calendarRows: 0, online: true) == .noCalendar) }
@Test func notConnectedFirst() { #expect(NapEmptyState.from(connected: false, syncProgress: nil, nights: 0, calendarRows: 0, online: true) == .notConnected) }
```
- [ ] **Step 2:** Run kit tests → FAIL. **Step 3:** Implement `from`; build `NapView` = `NKTabPage(hue: .forma)` with title row, tabs, a `RisingOrb(score: nil)` ("még tanulom"), a verdict per state (copy from Task 0), the Connect card on a short `DayPath` for `.notConnected`, an `ErrorCard`-style glass card for `.offline`. The "+"/bell/avatar buttons open placeholders that say "Hamarosan" until S4 (*call*). **Step 4:** Kit + app tests → PASS; screenshot every state via `-preview`. **Step 5:** Commit `feat(ios): Nap empty and learning states in the Napkelte look (mezo-r36n9.3)`.

### Task 12: Retire unused Lágy pieces, docs, gates, ship

**Files:** Modify `ios/BoopKit/Sources/BoopDesign/{Pages,Components,Graphics}.swift` (delete only types no longer referenced; `git grep` proves it), `ios/BoopKit/Tests/BoopDesignTests/DesignKitTests.swift` (Manrope expectation removed only if Manrope is removed), `docs/features/boop-ios.md`, `docs/features/README.md` (Boop row), `docs/milestones/roadmap.md`, `CLAUDE.md` §Boop (canon = Napkelte spec + spike `Aura*.swift`), `.claude/skills/boop/SKILL.md` §2 + §6, `docs/superpowers/specs/2026-11-09-boop-ios-v1-design.md` §0 (pointer), `ios/README.md` (Approved look link), `docs/CODEMAP.md` (regenerate).
- [ ] **Step 1:** Kit tests + app tests (commands above) → all PASS; `git grep -n DEVELOPMENT_TEAM ios/` → empty.
- [ ] **Step 2:** `node scripts/gen-codemap.mjs` and `node scripts/lint-docs.mjs` → 0 errors / 0 stale.
- [ ] **Step 3:** Fresh-context final review on the most capable model; fix Critical/Important with a failing test first; file minors under `mezo-r36n9`.
- [ ] **Step 4:** `git fetch && git rebase origin/main` → merge `--no-ff` from a detached HEAD → `git push origin HEAD:main` → regenerate CODEMAP if the merge touched it → fast-forward the primary checkout (boop skill §3).
- [ ] **Step 5:** Install on the owner's phone (`ios/scripts/install-on-phone.sh`, say so first); live check: every re-skinned screen on the device; `node scripts/check-beads-backup.mjs --fix`; close/update `mezo-r36n9.3`; Hungarian report walking the checklist.

## Kész, ha…

**Amit a tulajdonos lát (the phone):**
- [ ] Task 0's screens were OKed by the owner before Tasks 9–11 were built, and the built screens match them.
- [ ] Sign-in, register (field error, offline), onboarding (profile, weight ruler, greeting), permissions, backfill progress and the Connect card show the dark-glass, painted-sky look; Boop, never Mezo.
- [ ] The bottom bar shows five icons with no labels; VoiceOver reads Nap, Edzés, Fuel, Boop, Én.
- [ ] Nap shows the title row (bell, "boop", "+", avatar), the four text tabs with the 1 pt underline and no hairline, and the right empty state: not connected / syncing / learning (< 14 nights, "még tanulom" orb, no rise) / no calendar / offline.
- [ ] The ground is never black on any page: deep hue, floating lights, mirrored landscape at the end.
- [ ] The four web-only tabs keep their copy and "Megnyitom" action in the new look.
- [ ] Reduced motion: still orbs, no typing, no rise animation. 320 pt-wide layout (iPhone SE-class) does not clip tiles or tabs.

**Parity (reverse list):** sign-in/register validation and error texts; invite code; onboarding resume; weight ruler range and haptics; Health/Calendar permission flow; 60-day backfill with progress and the S2 sync triggers; Connect card actions; Én account card + confirmed sign-out; web-tab links — all still present and behaving as before.

**Gates:** kit tests and app tests green; `git grep DEVELOPMENT_TEAM ios/` empty; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0/0.

**Docs:** `docs/features/boop-ios.md` (look + kit + states), feature index row true, roadmap milestone entry, CLAUDE.md §Boop + boop skill name Napkelte as canon, v1 spec §0 pointer, `ios/README.md` link.

**Shipped:** merged to main, CI green for the merge commit, installed on the owner's phone and checked there; `mezo-r36n9.3` updated; tracker backup refreshed and pushed.
