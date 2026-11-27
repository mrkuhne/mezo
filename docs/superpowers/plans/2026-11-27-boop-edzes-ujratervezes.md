# Boop Edzés újratervezés — Slice Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, the munkamenet default).
> **Each task below is one step = one fresh session = one bd child under `mezo-r36n9.197` = one `feat/` branch merged
> to main on its own.** Steps use checkbox (`- [ ]`) syntax. A step session reads this plan, the spec, and its bd
> child; it may write a finer task list in its bd notes, never a second plan file.

**Goal:** Every existing Edzés page gets the accepted visual rank (#119, #124): one hero card on top, one glass card
per logical unit, actions inside the card they act on, small graphics — on the lighter Mozgás room sky.

**Architecture:** iOS only, no server or data change. Step 1 lifts Étel Ma's private card and paged hero into three
new kit views (`NKSectionCard`, `NKPagedHero`, `NKCardActions`) plus the `mozgas` room sky; steps 2–6 move the Edzés
pages onto them, page by page, using the throwaway spike `spike/boop-edzes-ujratervezes` (`bb7edca44`) as the **look
reference only** (never merged — every step branches from main).

**Tech Stack:** SwiftUI iOS 26, Swift Testing, Napkelte kit (`ios/BoopKit/Sources/BoopDesign/Napkelte/`).

**Spec:** `docs/superpowers/specs/2026-11-27-boop-edzes-ujratervezes-design.md` (§5 design, §6.1 spike result and
glitch list, §7.1 sequencing) · decisions #119, #124.

## Global Constraints

- Napkelte canon: dark glass, colour only in the sky, the orbs and key numbers; no emoji; never „Mezo" in a visible string.
- No glass on glass: anything inside a section card uses the inner treatment (fill `white 0.06`, stroke `white 0.08`, radius 20), never `nkGlass`.
- One primary action per card (white capsule, or the hue capsule for Indítás); the rest quiet capsules or the card's „…" menu.
- Running block: Szerkesztés primary; Újraindítás · Lezárás · Mentés a sablonba only in the hero's „…" menu (#124).
- Ma tab order: hero → Következik → A mai gyakorlatok → Hol tartasz → Az Edzés terület → ask row (#124).
- Mozgás room sky `[0x5C7FC0, 0xF4BC8E, 0xFFEFCB]`, `roomTop` `0x34507E`; the Mozgás orb elsewhere keeps its colours.
- Every block still loads and fails on its own (`NKBlockState` semantics, inside its card); never pull-to-refresh (`.191`).
- Accessibility Dynamic Type / VoiceOver: a paged hero stacks its pages; action rows reflow to a column; no mid-word breaks.
- Parity: every control and data field of each touched page stays; no behaviour change outside the spec.
- Player (step 5): no control moves — size and distance from the bottom edge unchanged.
- Kit files are shared with `.188` (Sport): new kit views are new files; `Tokens.swift` gets only the sky case.

## Review Focus

1. **First open with no cache** — the Mezociklus hero must show the calm loading state, not „Nincs futó mezociklusod", until the first answer decides (spike glitch). Test in Task 2.
2. **XXXL type** — stat words, block title, muscle rows and the „ÚJ HÉT" capsules must not truncate or break mid-word. Tests in Tasks 1 and 2 (layout-mode helpers) + simulator shots.
3. **A block whose days or muscles have not arrived** — the cards show their own no-data line, the hero stays. Task 2.
4. **Pótlás / done / rest day on Ma** — the hero picks the right label, primary and page set; „Mégis a mai napot" stays reachable. Task 3.
5. **Offline** — the room renders from cache; actions that need the net say so in the card instead of disappearing. Tasks 2–4.

---

### Task 1: Kit building blocks + Étel onto them (bd child „Edzés 1 — közös kártyaelemek")

**Files:**
- Create: `ios/BoopKit/Sources/BoopDesign/Napkelte/NKSectionCard.swift`, `NKPagedHero.swift`, `NKCardActions.swift`
- Modify: `ios/BoopKit/Sources/BoopDesign/Napkelte/Tokens.swift` (`roomSky`, `roomTop`: `.mozgas` case)
- Modify: `ios/Boop/Etel/EtelMa.swift` (`card(...)` → `NKSectionCard`, `heroCard` → `NKPagedHero`)
- Test: `ios/BoopKit/Tests/BoopDesignTests/NapkelteTokensTests.swift`, new `NapkelteCardsTests.swift`

**Interfaces — Produces:**
- `NKSectionCard<Content>(_ label: String, hue: Hue, glyph: String? = nil, trailing: NKCardTrailing = .none, state: NKBlockState = .ready, onOpen: (() -> Void)? = nil, @ViewBuilder content:)` — `nkGlass(24)`, padding 16/12, head = today's `NKBare` head.
- `enum NKCardTrailing { case none, text(String), menu(AnyView), chevron }`
- `NKPagedHero(pages: [AnyView], height: CGFloat)` — radius 28; `static func showsDots(pageCount: Int) -> Bool` (false for 1); stacks pages when `isAccessibilitySize || voiceOver`.
- `NKCardActions(primary: NKCardAction, quiet: [NKCardAction] = [], primaryStyle: .white | .hue(Hue))`, `struct NKCardAction { title, glyph?, enabled, action }` — `ViewThatFits` row → column; at most 2 quiet (assert).
- `View.nkInnerCard(radius: CGFloat = 20)` — the inner treatment.

- [ ] Write failing tests: `mozgasRoomSkyIsTheSpikeStep2` (rgb of the three stops and `roomTop` = constants above; `.fuel` unchanged; `.mozgas.sky` unchanged), `pagedHeroHidesDotsForOnePage` (`showsDots(1) == false`, `showsDots(2) == true`).
- [ ] Run `cd ios/BoopKit && xcodebuild test -scheme BoopKit-Package -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' -skipPackagePluginValidation -derivedDataPath ../build/kit` → the two fail.
- [ ] Implement the three views + sky case; lift Étel's code (bodies from `EtelMa.card` `:60` and `heroCard` `:74`).
- [ ] Take Étel Ma before/after simulator shots on the fixtures (normal, XXXL, kímélő day) — no visible change; then BoopKit + Boop `xcodebuild test` green.
- [ ] Add a `-previewKit` gallery entry for the three views (normal + XXXL). Commit `feat(boop): kit section card, paged hero, card actions; Mozgás room sky (mezo-r36n9.197.x)`.

**Kész, ha:** tests green; Étel shots identical; gallery shows the views at XXXL without truncation; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0/0; kit doc row in `docs/features/boop-ios.md`.

### Task 2: Mezociklus tab (bd child „Edzés 2 — Mezociklus fül")

**Files:**
- Modify: `ios/Boop/Edzes/EdzesRoom.swift` (the `.blokk` tab, today `:828`), `ios/Boop/Edzes/Mezociklus/MezoCurrentCard.swift` (becomes the hero body or is retired), `MezoTiles` call site
- Create: `ios/Boop/Edzes/EdzesWeeksArc.swift` (the weeks' arc graphic grown from `NKBlockTimeline`, spike `SpikeWeeksArc`), `ios/Boop/Edzes/EdzesMuscleBars.swift` (spike `SpikeMuscleBars`)
- Test: `ios/BoopTests/EdzesMezociklusTabTests.swift`

**Interfaces — Consumes:** Task 1 views. **Produces:** `EdzesWeeksArc(weeks: [NKBlockWeek], hue: Hue, compact: Bool = false)` (Task 3 uses `compact: true`); `enum MezoHeroState { case loading, running(Block), none(planned: MezoCard?), failed(String) }` with `static func resolve(block: BlockPlan?, firstAnswerArrived: Bool, failure: String?, planned: MezoCard?) -> MezoHeroState`; `func muscleRows(_ bands: [MuscleBand], top: Int = 5) -> (rows: [MuscleBand], more: Int)`.

- [ ] Write failing tests: `heroIsLoadingUntilFirstAnswer` (`resolve(nil, false, nil, nil) == .loading`; `resolve(nil, true, nil, nil) == .none(planned: nil)`; failure → `.failed`), `muscleRowsCapsAtFiveWithMore` (8 bands → 5 rows, `more == 3`).
- [ ] Run Boop `xcodebuild test` (README line 37) → fail.
- [ ] Build top → bottom per spec §5.2: hero (title, „N. hét a M-ből · split", arc, Szerkesztés, „…" menu with the three) → Heti átnézés entrance unchanged → „A heted" card (`DayCard` carousel, inner treatment) → „Izmok ezen a héten" card (whole card → `BlockLoadPage`) → Mezociklusaim · Éves terv tiles as two small cards → ask row. No-block hero: „Nincs futó mezociklusod" + Új mezociklus; failed: calm line in the hero.
- [ ] XXXL: block title wraps by word (`minimumScaleFactor(0.8)`, no hyphenation), muscle row = name above bar; „ÚJ HÉT" capsules via `NKCardActions`.
- [ ] Tests green; simulator shots: normal, lower part, no block, failed, offline, iPhone 16e, XXXL (the spike's `-spikeState` flag is re-added as a permanent `-previewEdzesState nincs|hiba|offline` in `PreviewTransport`). Commit.

**Kész, ha:** all listed shots match the spike look; no loading flash on cold start; VoiceOver labels on the hero, „…" menu items and cards; parity (Újraindítás, Lezárás, Mentés a sablonba, Szerkesztés, review entrance, load page, Mezociklusaim, Éves terv all reachable); gates as Task 1; handbook page for the Edzés Mezociklus tab updated.

### Task 3: Ma tab (bd child „Edzés 3 — Ma fül")

**Files:**
- Modify: `ios/Boop/Edzes/EdzesRoom.swift` (Ma section today `:422`, `TodaySessionCard` `:1005`)
- Test: `ios/BoopTests/EdzesMaTabTests.swift`

**Interfaces — Consumes:** `NKPagedHero`, `NKSectionCard`, `NKCardActions`, `EdzesWeeksArc(compact: true)`. **Produces:** `enum MaHeroKind { case today, pótlás, done, rest, none }` with `static func resolve(...)` mirroring today's branch order in the Ma section (another-day workout → brief session → plan workout → rest → none); `func heroPages(_ kind: MaHeroKind) -> Int` (rest/none → 1, else 2).

- [ ] Write failing tests: `anotherDayWinsOverTodaysSession`, `restDayHasOnePage`, `doneDayOffersResultNotStart`.
- [ ] Run → fail. Implement per spec §5.3 and the Ma order in Global Constraints: page 1 label, title, time, three stats (stack vertically at accessibility sizes), primary, „Másik napot csinálok ma" / „Mégis a mai napot" as quiet links inside the hero; page 2 today's body map. Cards: Következik (moved), A mai gyakorlatok (`ExerciseCard` carousel), Hol tartasz (compact arc → Mezociklus tab), Az Edzés terület (menu grid tiles with `nkInnerCard`), ask row.
- [ ] Hero height measured per state (no empty band on page 1). Tests green; shots: today, running („FUT" + progress), done, pótlás, rest, offline, 16e, XXXL. Commit.

**Kész, ha:** shots match; parity (missions, Indítás/Folytatás, Eredmény, other-day sheet, every menu tile); gates; handbook Ma page.

### Task 4: Mezociklus sub-pages + sheets (bd child „Edzés 4 — mezociklus aloldalak")

**Files:** `ios/Boop/Edzes/Mezociklus/MezociklusokPage.swift`, `MezoDetailPage.swift`, `MezoReportPage.swift`, `MezoRestartSheet.swift`, `MezoCloseSheet.swift`; `ios/Boop/Edzes/EdzesBlokk.swift` (`BlockLoadPage :27`, `MuscleWeeksPage :147`). Test: extend `ios/BoopTests/EdzesMezociklusTabTests.swift` only where a helper is added.

**Interfaces — Consumes:** Task 1 views, `EdzesWeeksArc`, `EdzesMuscleBars`, `muscleRows`.

- [ ] Per spec §5.4: Mezociklusaim (running-block hero with arc + body map, Következik card, Sablonjaim card row, Lezártak rows in one card newest first); részlet (arc hero + title + status tag; A hét napjai · Mit kapnak az izmok · Hogy sikerült cards; bottom bar unchanged); Zárójelentés (result hero + Boop's verdict line; five section cards); Terhelés pages (total-sets hero + per-muscle bars; rows in one card; muscle page hero = weeks chart, then Határai · Hol van cards); the two sheets: sections as cards.
- [ ] Shots for each page via `-previewMezo list|detail|…` + `-previewBlokkOpen`: normal, empty (`-previewMezo empty`), offline, 16e, XXXL. Boop tests green. Commit.

**Kész, ha:** shots; parity of every button (Indítás, Szerkesztés, template save, restart/close flows); gates; handbook Mezociklusaim / részlet pages.

### Task 5: Workout flow rendrakás (bd child „Edzés 5 — edzés közben, rendrakás")

**Precondition:** status check of `.125`, `.150`, `.15` (player files). One in flight → wait or rebase after it merges.

**Files:** `ios/Boop/Edzes/WorkoutBriefing.swift`, `WorkoutCeremony.swift`, `WorkoutPlayer.swift`, `PlayerTechnique.swift`, `SwapSheet.swift`, `WorkoutAsPlanned*.swift`, `OtherDaySheet`, `RestEndSheet`, `GymSheet`.

- [ ] Before shots of the player (each `-previewEdzesSheet` value) with control frames recorded (a debug overlay or `accessibilityFrame` dump).
- [ ] Per spec §5.5: briefing hero (title + three stats) + one card per group/mission; ceremony result hero + cards; player: current-exercise info in one card, next-up in a quieter card, name ranked above meta; sheets: card sections only.
- [ ] After shots: every control's frame size and bottom distance identical to before (diff the dumps). `WorkoutAsPlannedModelTests`, `WorkoutLiveActivityTests` and the full Boop suite green. Commit.

**Kész, ha:** control-frame diff empty; reduced motion checked; Napló/Shell users of `WorkoutAsPlannedSheet` unchanged in shots; gates; handbook workout page.

### Task 6: Builder + day-edit sheets (bd child „Edzés 6 — blokképítő igazítás")

**Precondition:** `.113`, `.114`, `.125` merged (shared files `BlockBuilderPage.swift`, `DayEditSheets.swift`, `PlanKit.swift`).

- [ ] Per spec §5.6: section heads via `NKSectionCard`, one primary per mode, `DayEdit*` groups as cards; empty tabs Gyakorlatok / Előzmények: the `NKNotLiveYet` message inside an `NKSectionCard` (§5.7).
- [ ] Shots via `-previewBlokk` (each `-previewBlokkTab`, picker, why sheet, edit states) normal + XXXL; Boop tests green. Commit.

**Kész, ha:** shots; parity of every builder mode and sheet; gates; handbook builder page; `.197` closed with the release row in `_kiadasok.json` for the last merge.

## Every step (shipped)

`xcodebuild test` BoopKit + Boop · `node scripts/gen-codemap.mjs` · `node scripts/lint-docs.mjs` 0/0 · `docs/features/boop-ios.md` + milestone line · Boop handbook page · `_jegyek.json` row for the child · local `--no-ff` merge to main + push · app installed on the phone and walked through · Hungarian report · Notion sync through a sonnet worker.
