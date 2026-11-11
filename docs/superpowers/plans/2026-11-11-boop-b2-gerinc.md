# Boop B2 Gerinc — the new shell (Ma · Terv · Napló · Boop + "+") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Boop's five-domain shell with the owner-approved spine — one home **Ma** (Reggel → Napközben → Este) plus Terv · Napló · Boop and a global "+" — keeping every S3 behaviour, and add the shared proposal card, "miért?" view and domain drill-down template.

**Architecture:** The Napkelte kit (`BoopDesign/Napkelte`) gains the spine bar, proposal card, "miért?" body and drill-down page frame. `BoopCore/Morning` gains pure builders (day phase, the day plan, proposals, close-out goals) tested with fixtures. The app target re-homes the S3 Mai: the hero stays `MaiView`; below it the selected orb's tiles + a door to its drill-down, then the three phase sections. The S3 per-orb short paths and their cards move into the drill-down's last section. Live data stays the existing brief endpoint (`MorningStore`); nothing new is sent to the backend.

**Tech Stack:** SwiftUI (iOS 26 SDK, Xcode 27), Swift Testing / XCTest as already used in `BoopKit/Tests` and `BoopTests`.

**Spec:** `docs/superpowers/specs/2026-11-11-boop-standalone-design.md` §3 (spine), §5 B2 row; owner-approved simulator spike `docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/Gerinc*.swift` (+ `gerinc-*.png`), approved 2026-11-11; look canon `docs/superpowers/specs/2026-11-10-boop-napkelte-design.md` §4.

## Global Constraints

- Napkelte look: dark glass, painted sky per page, colour only in the sky and the orbs, white type; serif headlines, Outfit numbers, mono caps labels.
- No emoji. No SF Symbols except chevrons and arrows. Icons from the kit glyph set (`NKGlyph`); Boop's tab icon is a small `StillOrb`.
- The companion is **Boop** in every user-visible string, never "Mezo". One voice: expert names (Alvás, Mozgás, Étkezés, Közérzet, Szkeptikus) appear only as labels inside "miért?".
- **Nothing changes without the owner's tap**: a proposal applies only on *Elfogadom*; *Most nem* only hides it for today.
- Proposals sit **inline in the Ma timeline at MOST** (owner, 2026-11-11), never as a pinned queue. Cap: 3 per day.
- Ma is **one scroll** (Reggel, Napközben, Este); the Reggel plan card collapses once accepted (Napközben stays open); the phase strip scrolls to a section.
- Bottom bar: icons only, names as accessibility labels; the "+" is its own glass circle beside the bar.
- **Keep the shipped backdrop motion** (owner, 2026-11-11): switching places in the bar slides the painted landscape toward the tapped place while the two skies blend (`NKBackdropPanorama`, travel 0.5, 0.95 s smooth; reduced motion = pure cross-fade), and tapping a mini orb cross-fades the page's sky (0.6 s) with the spring re-colour. Neither may be replaced by a plain swap.
- Phase boundaries reuse the shipped clock rules: Reggel 04:00–10:00, Napközben 10:00–18:00, Este 18:00–04:00 (`isEvening` = hour ≥ 18).
- Do not touch B1's files: `BoopCore/Health/**`, `BoopCore/Calendar/**`, `Boop/Connect/HealthLink.swift`, `Boop/BoopApp.swift`, `Boop/App/**`, entitlements/signing, `Boop.xcodeproj`, `BoopAPI/**`. New Swift files need no project edit (synchronized groups).
- `git grep DEVELOPMENT_TEAM ios/` stays empty.

## Review Focus

1. **Session move from the proposal card** — *Elfogadom* on "Told HH:MM-re az edzést" must call the existing `moveSession` with its undo toast; a server failure shows the existing problem toast and the card stays pending (test in Task 6).
2. **Brief without a session, conflict, sleep or calendar** (learning user, kímélő mód) — Ma renders with no proposals, an empty-day line in Napközben, and the plan card lists only what exists (tests in Tasks 2 and 3).
3. **Old `@SceneStorage("tab")` values** ("Nap", "Edzés", "Fuel", "Én") after the update — they must land on Ma, not crash or show a blank page (test in Task 5).
4. **Sign-out still reachable** — the Én page disappears; the avatar opens the account sheet with sign-out and its confirmation (test in Task 5; check in Task 9).
5. **Midnight / clock moves while open** — the phase follows `ModeClock` ticks; a past "Most nem" from yesterday does not hide today's proposal (dismissals are keyed by brief date; test in Task 3).

---

## File structure

| File | Responsibility |
|---|---|
| `ios/BoopKit/Sources/BoopCore/Morning/DayPhase.swift` (new) | `DayPhase` enum + `DayPhase.at(_:calendar:)` |
| `ios/BoopKit/Sources/BoopCore/Morning/DayPlan.swift` (new) | the Reggel plan rows and the Este close-out goals from a `Brief` |
| `ios/BoopKit/Sources/BoopCore/Morning/Proposals.swift` (new) | `Proposal` model + `Proposals.from(brief:now:dismissed:)` |
| `ios/BoopKit/Sources/BoopDesign/Napkelte/SpineBar.swift` (new) | `NKSpineBar` (4 icons + "+" circle); replaces `NKNav` |
| `ios/BoopKit/Sources/BoopDesign/Napkelte/Proposal.swift` (new) | `NKProposalCard`, `NKWhyBody` (facts + expert lines) |
| `ios/BoopKit/Sources/BoopDesign/Napkelte/Drill.swift` (new) | `NKDrillPage` frame: painted head, back + crumb, still orb, eyebrow, verdict, numbered `NKDrillSection`s |
| `ios/BoopKit/Sources/BoopDesign/Napkelte/Frames.swift` (modify) | `NKTitleRow.onPlus` optional; delete `NKNav` |
| `ios/BoopKit/Sources/BoopDesign/Napkelte/DayPath.swift` (modify) | a card may hang off the MOST station when it `opens` |
| `ios/Boop/Shell/ShellView.swift` (rewrite) | `ShellTab`, four places, the "+" sheet, account sheet, backdrop panorama over 4 panels |
| `ios/Boop/Shell/AccountSheet.swift` (new) | `EnAccountSection` + web-app link in a sheet; sign-out confirmation |
| `ios/Boop/Shell/WebOnlyTabView.swift` (delete) | replaced by Terv/Napló/Boop placeholders |
| `ios/Boop/Capture/CaptureSheet.swift` (new) | the "+" quick-capture frame |
| `ios/Boop/Terv/TervView.swift`, `ios/Boop/Naplo/NaploView.swift`, `ios/Boop/BoopChat/BoopTabView.swift` (new) | light placeholders |
| `ios/Boop/Nap/MaiView.swift` (modify) | header: phase strip instead of Nap tabs; drops A napom tab |
| `ios/Boop/Nap/MaiMode.swift` (modify) | `BoopClock` gains `-previewPhase` |
| `ios/Boop/Nap/MaPhases.swift` (new) | `MaBelow`: lens strip, Reggel plan card + Boop mondja, Napközben timeline with proposals at MOST, Este card |
| `ios/Boop/Nap/MaDrill.swift` (new) | `MaDrill(hue:)`: the four sections from the brief; section 4 hosts the orb's short path + cards (moved out of `MaiBelow`) |
| `ios/Boop/Nap/MaiPath.swift` (modify) | `MaiBelow` → `OrbPathCards` (short path + cards only, tiles removed) |
| `ios/Boop/Nap/ANapomView.swift` (delete) | its full-day path becomes Napközben |
| `ios/Boop/Nap/NapView.swift` (modify) | uses `MaBelow`; drill navigation; empty-state header without the Nap tabs |

---

### Task 1: Day phase

**Files:** Create `ios/BoopKit/Sources/BoopCore/Morning/DayPhase.swift`; Test `ios/BoopKit/Tests/BoopCoreTests/DayPhaseTests.swift`

**Interfaces — Produces:** `public enum DayPhase: Int, CaseIterable, Sendable { case reggel, napkozben, este }`, `public var name: String` ("Reggel", "Napközben", "Este"), `public static func at(_ date: Date, calendar: Calendar = .current) -> DayPhase`.

- [ ] **Step 1: failing tests** — `phaseAt0359IsEste`, `phaseAt0400IsReggel`, `phaseAt0959IsReggel`, `phaseAt1000IsNapkozben`, `phaseAt1759IsNapkozben`, `phaseAt1800IsEste`, `phaseAt2330IsEste`, using a fixed `Calendar(identifier: .gregorian)` in `Europe/Budapest`.
- [ ] **Step 2:** run the BoopKit test command from `ios/README.md`; expect FAIL (no `DayPhase`).
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run; expect PASS.
- [ ] **Step 5:** commit `feat(boop): DayPhase clock rule (mezo-r36n9.12)`.

### Task 2: The day plan and the close-out goals

**Files:** Create `ios/BoopKit/Sources/BoopCore/Morning/DayPlan.swift`; Test `ios/BoopKit/Tests/BoopCoreTests/DayPlanTests.swift` (fixtures from `PathFixtures.swift`)

**Interfaces — Produces:**
- `public struct PlanRow: Sendable, Equatable, Identifiable { id, time: String, glyph: String, title: String, sub: String }`
- `public enum DayPlan { static func rows(_ brief: Brief) -> [PlanRow]; static func goals(_ brief: Brief) -> [CloseGoal] }`
- `public struct CloseGoal: Sendable, Equatable, Identifiable { id, title: String, result: String, met: Bool? }` (`nil` = not decidable yet)

Rows, in clock order: the morning check-in (`"Reggeli check-in"`, sub `"fél perc"` or its summary when done); each unlogged meal (`"<title> · legalább <n> g fehérje"` where n = remaining protein split evenly over unlogged meals, sub `"a mai keret <kcalTarget> kcal"` grouped with a thin space as `grouped()` does); the session (`title`, sub `"<minutes> perc"`, plus `" · áttéve <time>-ra/re"` when moved — reuse the `timeSuffix` rule by moving `timeSuffix` into BoopCore); the evening check-in (`"Esti zárás"`, `"egy perc"`); bedtime (`"Lefekvés"`, `bedtimeTarget`, sub `"7 és fél óra alvásért"` only when a target exists). Missing parts are simply absent.

Goals: protein (`"<proteinTarget> g fehérje"`, result `"<proteinG> g"`, met = proteinG ≥ proteinTarget); the session if any (title + time, met = `nil` — the brief has no "done" flag yet); bedtime if a target (met = `nil`).

- [ ] **Step 1: failing tests** — `rowsFullDayInClockOrder`, `rowsOmitMissingSessionAndBedtime` (kímélő fixture without session), `rowsMarkMovedSession` (time "18:30", planned "18:00" → sub contains "áttéve 18:30-ra"), `proteinSplitOverUnloggedMeals` (target 165, eaten 38, two unlogged → 64 each, rounded up), `goalsProteinMet`, `goalsWithoutSessionHasTwoItems`, `learningBriefYieldsNoCrash` (empty meals/checkins → rows contain only what exists).
- [ ] **Step 2:** run; FAIL.
- [ ] **Step 3:** implement `DayPlan` (move `timeSuffix(_:)` from `Boop/Nap/SessionMove.swift` to `BoopCore/Morning/DayPlan.swift` as `public`; keep the app's call sites compiling).
- [ ] **Step 4:** run BoopKit + app tests; PASS.
- [ ] **Step 5:** commit `feat(boop): day plan rows and close-out goals (mezo-r36n9.12)`.

### Task 3: Proposals

**Files:** Create `ios/BoopKit/Sources/BoopCore/Morning/Proposals.swift`; Test `ios/BoopKit/Tests/BoopCoreTests/ProposalsTests.swift`

**Interfaces — Produces:**
```swift
public enum ExpertField: Int, CaseIterable, Sendable { case alvas, mozgas, etkezes, kozerzet, szkeptikus
    public var label: String }                         // "Alvás", "Mozgás", "Étkezés", "Közérzet", "Szkeptikus"
public struct ExpertLine: Sendable, Equatable { public let field: ExpertField; public let text: String }
public struct ProposalFact: Sendable, Equatable { public let value: String, unit: String, label: String }
public struct Proposal: Sendable, Equatable, Identifiable {
    public enum Kind: Sendable, Equatable { case moveSession(to: String) }
    public let id: String, kind: Kind, text: String, sub: String, acceptedLine: String
    public let facts: [ProposalFact], experts: [ExpertLine]
}
public enum Proposals {
    public static let dailyCap = 3
    public static func from(_ brief: Brief, now: Date, dismissed: Set<String>, calendar: Calendar = .current) -> [Proposal]
    public static func dismissKey(date: String, id: String) -> String     // "\(date)|\(id)"
}
```
B2 has one live source: the brief's `conflict` with today's session. Rule: a session exists, `conflict != nil`, the session is not already moved (`sessionMoved(planned:time:)` false), `now` is before the session's planned time, and `dismissKey(brief.date, "move-session")` is not in `dismissed` → one proposal: id `"move-session"`, text `"Told <suggestedTime>-<ra|re> az edzést"`, sub = `conflict.text`, acceptedLine `"Az edzés <suggestedTime>-<ra|re> került"`. Facts (only those with data): `("\(calendar.count)", "esemény", "a naptáradban ma")`, `(Forma score, "", "a mai Formád")`, `(sleep display from the Alvás metric, "", "alvás az éjjel")`. Experts are **only lines the brief really carries** — no invented text: Mozgás = `conflict.text`; Alvás = `tonightTip` when a bedtime target exists; Étkezés = `nextMealTip` when present. Közérzet and Szkeptikus get lines from B8's day council (not in B2). Output is capped at `dailyCap`.

- [ ] **Step 1: failing tests** — `conflictMakesMoveProposal` (text "Told 18:30-ra az edzést"), `noConflictNoProposal`, `movedSessionNoProposal`, `afterSessionTimeNoProposal` (now 18:05, planned 18:00), `dismissedTodayHidesIt`, `dismissedYesterdayDoesNotHideToday` (key with yesterday's date), `expertsOnlyFromBriefFields` (no `nextMealTip` → no Étkezés line; never a Szkeptikus line), `factsSkipMissingData` (no sleep → two facts).
- [ ] **Step 2:** run; FAIL.
- [ ] **Step 3:** implement (move `sessionMoved(planned:time:)` into BoopCore beside it, public; app call sites keep compiling).
- [ ] **Step 4:** run BoopKit + app tests; PASS.
- [ ] **Step 5:** commit `feat(boop): proposals from the brief, capped and dismissible per day (mezo-r36n9.12)`.

### Task 4: Kit components — spine bar, proposal card, "miért?" body, drill-down frame, MOST card

**Files:** Create `BoopDesign/Napkelte/SpineBar.swift`, `Proposal.swift`, `Drill.swift`; modify `Frames.swift` (delete `NKNav`; `NKTitleRow(onPlus: (() -> Void)? = nil)` hides the "+" when nil), `DayPath.swift` (when `st.isNow && st.opens`, render `card(st)` under the MOST label); Test `ios/BoopKit/Tests/BoopDesignTests/NapkelteSpineTests.swift` (render tests in the style of `NapkelteRenderTests.swift`).

**Interfaces — Produces** (all `public`, BoopDesign does not import BoopCore — callers pass plain values):
- `NKSpineBar(selected: Binding<Int>, onPlus: () -> Void)`; `static let labels = ["Ma", "Terv", "Napló", "Boop"]`; glyphs `sun-ink`, `chart-deep`, `book-sage`, then a `StillOrb(palette: Hue.forma.orb, size: 22, level: 0.8)` (desaturated 0.2 when not selected); the "+" is `plus-ink` in a 58 pt `.glassEffect(.regular.interactive(), in: .circle)`, label "Rögzítés"; selection haptic as `NKNav` had; capsule glides with `matchedGeometryEffect`.
- `NKProposalCard(text: String, sub: String, state: NKProposalState, compact: Bool = false, onAccept: () -> Void, onDismiss: () -> Void, onWhy: () -> Void)`; `public enum NKProposalState: Equatable { case pending, accepted(String), dismissed(String) }` — pending: still orb + mono "BOOP JAVASOLJA" + dotted-underlined "miért?" + serif text + sub + white "Elfogadom" + glass "Most nem"; settled: one quiet row (check / clock glyph, line, "miért?") exactly as the spike's `ProposalCard`.
- `NKWhyBody(title: String, sub: String, facts: [(value: String, unit: String, label: String)], experts: [(label: String, palette: [Color], text: String, doubt: Bool)], closing: String)` — painted head 200 pt (Forma sky), "MIÉRT JAVASLOM?", "AMIT LÁTOK" fact tiles (Outfit 26), "KI MIT LÁT BENNE" lines with a 22 pt still orb per field (doubt = italic, 70 %), "BOOP" closing in serif. The decision buttons are the caller's.
- `NKDrillPage<Content: View>(hue: Hue, crumb: String, eyebrow: String, headline: String, sentence: String, level: Double?, onBack: () -> Void, @ViewBuilder content: () -> Content)` and `NKDrillSection<C: View>(number: Int, label: String, @ViewBuilder content: () -> C)` — 360 pt painted head, glass back circle with `chevron.left`, 64 pt still orb with hue glow, floating lights, mirrored land at the end.

- [ ] **Step 1: failing tests** — `spineBarHasFourLabelsAndPlus` (labels equal `["Ma","Terv","Napló","Boop"]`), `proposalCardRendersAllStates` (pending/accepted/dismissed render a non-empty image via `ImageRenderer`), `whyBodyRendersWithZeroExperts`, `drillPageRenders`, `dayPathNowCardRendersWhenOpens`.
- [ ] **Step 2:** run; FAIL.
- [ ] **Step 3:** implement, matching `GerincRoot.swift` / `GerincParts.swift` / `GerincMa.swift` visuals with kit tokens (`nkGlass`, `NKMono`, `NKPill`, `.nkFont`, `Font.nkNumber`).
- [ ] **Step 4:** run BoopKit tests; PASS (app still compiles: `ShellView` still references `NKNav` until Task 5 — keep a deprecated `NKNav` alias until Task 5 deletes the last use, then remove it in Task 5).
- [ ] **Step 5:** commit `feat(boop): kit — spine bar, proposal card, miért body, drill-down frame (mezo-r36n9.12)`.

### Task 5: The shell — four places, "+", account sheet, placeholders

**Files:** Rewrite `ios/Boop/Shell/ShellView.swift`; create `Shell/AccountSheet.swift`, `Capture/CaptureSheet.swift`, `Terv/TervView.swift`, `Naplo/NaploView.swift`, `BoopChat/BoopTabView.swift`; delete `Shell/WebOnlyTabView.swift`; Test `ios/BoopTests/ShellTabTests.swift`

**Interfaces — Produces:**
- `enum ShellTab: Int, CaseIterable { case ma, terv, naplo, boop }`, `static func restored(_ raw: String) -> ShellTab` (`"ma"/"terv"/"naplo"/"boop"` map to themselves; anything else — including the old `"Nap"`, `"Edzés"`, `"Fuel"`, `"Boop"`, `"Én"` — maps to `.ma`; note the old `"Boop"` web page has no place now, so it too lands on Ma), `var storageKey: String`.
- `@SceneStorage("tab")` keeps its key; values written are the new storage keys.
- `ShellView` hosts: `NKBackdropPanorama` over four panels (Ma = the page's reported sky, Terv `.fuel`, Napló `.alvas`, Boop `.forma`), the page, `NKSpineBar`; `.sheet` for `CaptureSheet` and `AccountSheet` **at page level** (boop-ios.md §9). An environment action `\.openAccount` lets Ma's title-row avatar open the account sheet from inside the page.
- `CaptureSheet(onPick: (String) -> Void)`: "RÖGZÍTÉS" / "Mit rögzítesz?"; Étkezés card with Fotó · Szöveg · Vonalkód · Recept; tiles Check-in, Napló, Súly, Edzés indítása; the "Mondd vagy írd…" field. Every item answers `soonToast(<name>)` (B3/B4 wire them). Detents `[.height(560), .large]`.
- `AccountSheet(me: Me)`: `EnAccountSection` (sign-out + confirmation dialog moved here from `WebOnlyTabView`) + a "Webes app · Megnyitom" row opening `BoopConfig.webAppURL`.
- Terv: weight card from `brief.day.weight` (kg → trend) when present, today's session card when present, and an `NKBoopCard` "Az edzés- és étrendtervedet *a webes appban* állítsd be…" with *Megnyitom*. Napló: the Minták / past days frame with the line "A napjaid és Boop következtetései hamarosan itt gyűlnek." Boop: Boop's greeting bubble + a disabled "Írj a Boopnak…" pill answering `soonToast("Beszélgetés")`. All three: `NKTabPage` with a 330 pt head, serif title, one line.
- DEBUG flags: `-previewTab ma|terv|naplo|boop`, `-previewOpen capture|account`.

- [ ] **Step 1: failing tests** — `restoresNewKeys`, `oldDomainValuesLandOnMa` (for each of "Nap","Edzés","Fuel","Boop","Én",""), `storageKeyRoundTrips`.
- [ ] **Step 2:** run app tests; FAIL.
- [ ] **Step 3:** implement; delete `NKNav` and its alias.
- [ ] **Step 4:** run BoopKit + app tests; PASS; record the bar switch (`-previewSwitch terv` kept as a DEBUG flag: switches after 3 s and back) with `xcrun simctl io <udid> recordVideo` and check the slide + blend; build and launch `-preview shell -previewTab terv`, screenshot with `xcrun simctl io <udid> screenshot`, compare with `gerinc-8-terv.png`.
- [ ] **Step 5:** commit `feat(boop): spine shell — Ma · Terv · Napló · Boop + capture + account (mezo-r36n9.12)`.

### Task 6: Ma — phase strip, lens strip, Reggel, Napközben with proposals, Este

**Files:** Modify `Nap/MaiView.swift` (header), `Nap/MaiMode.swift` (`BoopClock`), `Nap/NapView.swift`; create `Nap/MaPhases.swift`; delete `Nap/ANapomView.swift`; Test `ios/BoopTests/MaPhasesTests.swift`

**Interfaces:**
- Consumes: `DayPhase`, `DayPlan.rows/goals`, `Proposals.from`, `NKProposalCard`, `NKWhyBody`, `NKTabStrip`, `DayPath` (MOST card), `moveSession` / `undoSessionMove`.
- Produces: `struct MaBelow: View` (`brief`, `store`, `ctx: MaiContext`, `phase: DayPhase`, `onDrill: (Hue) -> Void`, `onLink: (Brief.Link) -> Void`); `func napkozbenStations(_ brief: Brief, now: Date, evening: Bool, hasProposals: Bool) -> [PathStation]` (the full-day `PathBuilder.steps(for: nil, …)` as quiet stations, with the MOST station `opens = hasProposals`); `func phaseSectionId(_ p: DayPhase) -> String` (`"reggel"|"napkozben"|"este"`).
- `MaiView` header: `NKTitleRow` with `onPlus: nil` and the avatar → `\.openAccount`; `NKTabStrip(tabs: DayPhase.allCases.map(\.name), selected:, dot: <current phase name>)`; a tap scrolls (`ScrollViewReader`) to the section, offset so the compact capsule does not cover the section title. `MaiView` drops the A napom branch; `NapTab` is removed.
- `MaBelow` order: lens strip (`MaiTiles` for the selected orb + a glass row "<Orb> részletesen · a napok mögötte ›" → `onDrill`) → **Reggel** (phase title + range; plan card: `DayPlan.rows`, the pending proposal compact inside it when the phase is Reggel, *Elfogadom a napot* → stores `brief.date` in `@AppStorage("planAcceptedDate")` and collapses to "A nap terve elfogadva · <n> pont"; *Módosítom* → `soonToast("A terv módosítása")`; then `BoopSaysCard` — the spoken brief with tappable phrases, all orbs, not only Forma) → **Napközben** (`DayPath` of `napkozbenStations`; the MOST card holds the `NKProposalCard`s; a station tap opens its domain drill: meals → Fuel, session/walks → Mozgás, sleep/bedtime → Alvás, check-ins/intention/observations → Forma, busy block → the existing day sheet) → **Este** (rating of five still orbs, `DayPlan.goals`, one-line field, *Lezárom* → `soonToast("Esti zárás")`, *Ma kihagyom* collapses; dimmed with "18:00-KOR NYÍLIK · 1 PERC" before Este) → the Health row (`ConnectCard`).
- Proposal actions: *Elfogadom* on `.moveSession(to:)` → `moveSession(store, to:, planned:, toast:, undoToast:)` (existing, with undo); on failure the existing `moveProblemToast` and the card stays pending. *Most nem* → insert `Proposals.dismissKey` into `@AppStorage("dismissedProposals")` (newline-joined), toast "Rendben, most nem". *miért?* → page-level `.sheet` with `NKWhyBody` + the same two buttons.
- `BoopClock`: `-previewPhase reggel|napkozben|este` reads 08:10 / 13:40 / 21:10 today (`-previewEvening YES` still means 21:10).

- [ ] **Step 1: failing tests** — `napkozbenNowOpensOnlyWithProposals`, `napkozbenKeepsClockOrder` (fixture full day), `phaseSectionIds`, `emptyDayShowsOnlyNow` (no stations besides MOST → the view shows the existing "Ma még nincs semmi a napodban…" line; test the predicate `isEmptyDay(_:)`), `dismissStorageRoundTrip` (`dismissedSet(from:)` / `dismissedString(_:)`).
- [ ] **Step 2:** run app tests; FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run BoopKit + app tests; PASS; launch `-preview shell -previewPhase reggel|napkozben|este` and `-previewEvening YES`, `-previewRecovery YES`, `-previewEmpty YES`; screenshot each; compare with `gerinc-1…4`.
- [ ] **Step 5:** commit `feat(boop): Ma — Reggel plan, Napközben timeline with proposals at MOST, Este (mezo-r36n9.12)`.

### Task 7: The domain drill-down

**Files:** Create `Nap/MaDrill.swift`; modify `Nap/MaiPath.swift` (`MaiBelow` → `OrbPathCards`: same short path + cards, no tiles, no Boop mondja); `Nap/NapView.swift` (a `NavigationStack` around the Ma page with `.navigationDestination(for: Hue.self)`, nav bar hidden; `ShellView` hides `NKSpineBar` while a drill is pushed via an environment binding); Test `ios/BoopTests/MaDrillTests.swift`

**Interfaces — Produces:** `struct MaDrill: View` (`hue`, `brief`, `store`, `ctx`); `func drillDays(_ hue: Hue, _ brief: Brief) -> [DrillDay]` with `struct DrillDay: Equatable { let day: String, value: String, fill: Double, today: Bool }` — Alvás from `deepSleepWeek` (value `"<n> p"` mély), Pulzus from `restingHrWeek` (`"<n> bpm"`, fill relative to the week's max), others `[]`; weekday names via the existing `weekLabels(endingOn:)` / `weekdayName(_:)`; nil days show "–" with fill 0.

Sections (`NKDrillPage`, crumb "Ma · <Orb>", eyebrow from the metric, headline/sentence from `maiCopy`): **1 A szint** — the orb's display (Outfit 48) + caption, the orb's `MaiTiles`, Alvás adds the `Hypnogram` with its axis; **2 A hét** — `WeekBars` for Alvás (deep sleep) and Pulzus (resting HR), the energy `GlowLine` for Forma, otherwise `SheetEmptyLine("Ehhez még nem gyűjtök heti képet — hamarosan.")`; **3 A napok mögötte** — `drillDays` rows (empty → `SheetEmptyLine`); **4 Mit tehetsz** — the pending proposal if it belongs to this orb (move-session → Mozgás) then `OrbPathCards` for this orb (check-in, intention, observation swipe stack, night card, bedtime reminder card, walk, session card with move + undo, breath, busy block, meal cards — unchanged behaviour). The existing detail sheets stay reachable from Boop mondja phrases.
DEBUG flag `-previewDrill forma|alvas|mozgas|fuel|pulzus`.

**Inner top tabs (spec §3/§3.1 update, 2026-11-11):** domains are full-screen *rooms*; a room with depth carries its own inner top tabs in one shared pattern (Étel `Ma · Receptek · Kamra · Hét`, Edzés `Ma · Terv · Gyakorlatok · Előzmények`, built in B4/B5). Extend the kit's `NKDrillPage` with an optional inner tab row: `tabs: [String] = []`, `selectedTab: Binding<String>? = nil` — when `tabs` is non-empty an `NKTabStrip` sits under the verdict block in the head and the caller switches `content` on the selected tab; empty = today's single-page room. B2's five rooms pass no tabs. Add a render test `drillPageRendersWithInnerTabs`.

- [ ] **Step 1: failing tests** — `drillPageRendersWithInnerTabs` (kit), `alvasDaysFromDeepWeek` (7 rows, last `today == true`), `pulzusFillRelativeToMax`, `otherOrbsHaveNoDays`, `nilDayShowsDash`.
- [ ] **Step 2:** run; FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run BoopKit + app tests; PASS; launch `-preview shell -previewDrill alvas` and `mozgas`; screenshot; compare with `gerinc-6-alvas.png`; check the move + undo inside Mozgás.
- [ ] **Step 5:** commit `feat(boop): domain drill-down template, S3 orb cards re-homed (mezo-r36n9.12)`.

### Task 8: Docs, flags, codemap

**Files:** `docs/features/boop-ios.md` (shell, Ma, drill-down, proposal, parity notes, §9 presentation rule unchanged), `docs/features/README.md` (Boop row status/route), `docs/milestones/roadmap.md` (dated B2 entry; *Epics in flight* row), `.claude/skills/boop/SKILL.md` §6 (B2 shipped), `ios/README.md` (flags: remove `-previewTab napom`; `-previewSwitch` now takes `terv|naplo|boop`; add `-previewTab`, `-previewPhase`, `-previewDrill`, `-previewOpen`), `docs/CODEMAP.md` (regenerate).

- [ ] **Step 1:** edit the docs.
- [ ] **Step 2:** `node scripts/gen-codemap.mjs` then `node scripts/lint-docs.mjs` → 0 errors / 0 stale.
- [ ] **Step 3:** commit `docs(boop): B2 Gerinc shipped — spine, Ma, drill-down (mezo-r36n9.12)`.

### Task 9: Review, merge, install, report

- [ ] Fresh-context review of the whole branch on the most capable model; fix Critical/Important with a failing test first; file minors under `mezo-r36n9`.
- [ ] `git fetch && git rebase origin/main`; re-run both test suites; `--no-ff` merge from a detached `origin/main`; `git push origin HEAD:main`; regenerate CODEMAP after the merge if it changed; fast-forward the primary checkout's `main`.
- [ ] Phone install only after checking the shared notes / B1 is not installing; say so there first; `ios/scripts/install-on-phone.sh`; open the app on the phone (owner unlocks) and check Ma with the real brief.
- [ ] Delete this session's simulator; close `mezo-r36n9.12`; `node scripts/check-beads-backup.mjs --fix`; commit + push.
- [ ] Hungarian report walking the *Kész, ha…* list.

---

## Kész, ha… (done checklist — also in bd `mezo-r36n9.12` acceptance)

**Amit a tulajdonos lát (each checked with a simulator screenshot against the approved `gerinc-*.png`):**
- [ ] Bottom bar: Ma · Terv · Napló · Boop icons (Boop = small orb) + separate "+" circle; the selected capsule glides; hidden while a drill-down is open.
- [ ] Ma hero = the S3 hero (five mini orbs re-colour the page, rising orb, verdict, lens pill, Boop elmondja); title row without "+"; the phase strip Reggel · Napközben · Este marks the current phase and scrolls to its section.
- [ ] Reggel: plan card from the real brief; *Elfogadom a napot* collapses it for the day; Boop mondja card with tappable phrases opening the existing sheets.
- [ ] Napközben: the whole day as one path lit to MOST; the "Told …-ra az edzést" proposal hangs at MOST when the brief has a conflict; *Elfogadom* moves the session (undo toast works); *Most nem* hides it for today; *miért?* opens the facts + labelled lines (only lines the brief carries).
- [ ] Este: the close card (rating, goals, one line, *Lezárom* → "hamarosan"), dimmed before 18:00.
- [ ] Drill-down: Alvás shows verdict → level + hypnogram → week → the days → actions; the other four open the same template; the S3 orb cards (check-in, intention, observation swipe, bedtime reminder, session move, breath, meals, busy block) work inside them.
- [ ] "+" sheet opens with all items answering "hamarosan"; avatar opens the account sheet with sign-out (confirmation) and the web-app link.
- [ ] Terv / Napló / Boop placeholders as in the spike.
- [ ] Empty states (not connected, syncing, learning, no calendar, offline, problem/retry), evening dusk, kímélő calm sky + banner, 320 pt-equivalent (iPhone SE size simulator), reduced motion (no typing, no slosh).
- [ ] No emoji, no SF Symbols except chevrons/arrows; "Boop" never "Mezo".

**Parity (reverse list — every S3 behaviour still present):** backdrop slide + sky blend on every bar switch (Ma ↔ Terv ↔ Napló ↔ Boop, direction by bar order) and the sky cross-fade on every orb switch, also inside the drill-down's head · mini-orb re-colour + spring · rising orb/sinking value · lens pill per orb (check-in soon, bedtime reminder on/off with notification permission + settings deep link, workout menu, Fuel chips, breathing minute with haptics and auto-stop) · Boop elmondja voice + mute + typing sync · compact capsule after the hero · Boop mondja phrases → sleep / pulse / day sheets (magnifier, conflict kept/moved) · session move + undo + problem toast · observation swipe true/false with server call · bedtime card switch shared with the pill · evening + kímélő modes and `ModeClock` re-reading · brief reload after sync / foreground / midnight · Health row (`ConnectCard`) + connect cover · sign-out · web-app link · preview flags documented.

**Gates:** BoopKit tests + app tests green (commands in `ios/README.md`), app builds for device (`install-on-phone.sh` build step), `git grep DEVELOPMENT_TEAM ios/` empty, `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs` 0/0. No backend change → no backend tests, no deploy.

**Docs:** `docs/features/boop-ios.md`, feature index row, roadmap milestone + epics table, `boop` skill §6, `ios/README.md` flags.

**Shipped:** merged to main and pushed; installed on the phone (coordinated with B1 in the shared notes); live check on the phone with the real brief.
