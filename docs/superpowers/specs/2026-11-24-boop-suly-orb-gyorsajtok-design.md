# Boop: sheet close buttons, the home screen's quick doors, and the Súly area (2026-11-24)

**Issues:** `mezo-r36n9.156` (sheets), `.157` (quick doors), `.158` (Súly). **Owner decisions:** #99–#102 in
`docs/superpowers/research/boop-standalone/14-decisions.md`. **Spike:** branch `spike/boop-suly-orb` (throwaway),
screenshots in `docs/superpowers/specs/assets/suly-orb-gyorsajtok/spike/`, owner OK 2026-11-24 („tökéletes mindegyik,
a test kapjon saját új ikont").

## 1. Intent

The owner reported three things after the 2026-11-24 install: the sheets ("drawers") have no close button and a
pull-down inside them refreshes instead of closing; the home screen's „+ Rögzítés" capsule is ugly; and there is no
area for his weight — he wants a ninth orb, built like Pénz, in its own colour, whose number says how well he is
tracking his weight goal.

## 2. Goals · non-goals · anti-goals

- **Goals:** every sheet closes with one tap; a pull inside a sheet never reloads the room behind it; the five most
  frequent captures are one tap from the ring; the ring has nine orbs with Súly between Energia and Forma; a Súly room
  on the shared area page (Ma · Test · Napló) fed by the season, the weight trend, the weigh-ins and Apple Health; the
  Súly orb's number is the pace score below.
- **Non-goals:** no backend change (every number the room needs is already served); no new weight-goal editor (the
  goal lives in the Évad); no new photo world for Súly (the painted sky is enough, Képek rule "right with no photo").
- **Anti-goals:** an invented number on the orb (no season, no trend → „–"); a second „+" on the home screen; a
  Hue added without its arrays (crashes); `async let` fans (Swift 6.2 abort, boop-ios.md §9).

## 3. What the owner sees

### 3.1 Sheets (`.156`)
- `NKSheetFrame` carries a **glass close circle top-right** (36 pt eye, 44 pt finger, a drawn hairline cross — no SF
  Symbol), environment `dismiss`, a11y „Bezárom". Opt-out `closable: false` for a frame that is not a sheet. The drag
  indicator and the drag stay.
- The Étel room's `.refreshable` wraps **only the page**, not the `.sheet` chain, so the refresh action no longer
  reaches the sheets through the environment.
- Full-screen sub-pages keep their top-left back chevron (they are pages, not drawers).

### 3.2 Quick doors (`.157`)
- The capsule goes. Under Boop's line: **five glass doors** — Étkezés · Víz · Súly · Check-in · Napló — 46 pt circles
  with the door's glyph and a 10 pt mono caps name; evenly spread across the width; each opens its own sheet at once
  through a new `\.openPick` environment the shell provides (`ShellView.handle(_:afterSheet:)`, the same switch the
  „+" sheet uses). The bar's „+" keeps the full nine-door sheet.

### 3.3 Súly (`.158`)
- **Hue.suly** — gold: sky `3A2606 · C9901E · FFE9A8`, orb `3B2606 · CF9426 · F4DB8C · FFF6D2`, glow `E6B33A`, top
  `3A2606`; name „Súly". Tab glyph for „Test": a new drawn glyph `body-cream` (owner: „a test kapjon saját új ikont");
  „Napló" tabs wear `book-sage`.
- **The ring:** nine orbs — Nap · Alvás · Étel · Edzés · Energia · **Súly** · Forma · Pénz · Levél; orb 56 pt, 52 pt
  under 400 pt of ring side, 46 pt under 360 (short phones), so names never touch the next orb.
- **The number** (`sulyPaceScore`, pure, BoopCore): cut/bulk — `r = actual ÷ planned` weekly rate; `r ≤ 0 → 0`;
  deviation `= r > 1 ? (r−1)/2 : 1−r`; score `= round(100·max(0, 1−deviation))`. Maintain — `d = |trend − band
  centre| ÷ half-width`; `d ≤ 1 → 100−20d`, else `max(0, 80−80(d−1))`. nil (orb „–") without a season, a planned rate,
  a trend rate, or when the trend's `dataSufficiency` is `none`. The actual rate is the trend endpoint's
  `last4wRateKgPerWeek` (the same window the server's own status uses); the planned rate is the season's
  `weight.kgPerWeek`.
- **The room** (`SulyRoom`, `NKAreaPage(hue: .suly)`): head orb = score (level and number), headline/sentence from the
  season status (`on_course` „Pályán vagy a súlycélhoz" · `slower` „Lassabb a tervnél" · `faster` „Gyorsabb a tervnél"
  · `in_band`/`out_of_band` for maintain · `no_data` „Még kevés a mérés" · no season „Nincs évad — a cél az évadban
  él"), actions Súly rögzítése (opens the quick weight sheet) · Frissítés.
  - **Ma:** highlight (today's weigh-in or „A héten még nem mértél", the trend); stats most (trend) · a cél · heti ütem
    (actual, „terv x"); „A súlyod" curve = season series + projection with the target line (maintain: the band);
    stats eddig lement · van még hátra · hetek ezen az ütemen; „A hét mérései" rows (weekday · time, source, kg);
    „A cél" row → Évad; info row „Honnan tudom, hogy pályán vagy?" (sheet with the rule in words); ask-Boop row.
  - **Test:** stats testzsír % · izomtömeg kg · BMI (latest ≤ 30 d from Apple Health, BMI from the trend kg and the
    profile height when known, else „–"); 90-day curves for fat % and lean mass; the Feelfit line.
  - **Napló:** weigh-ins by week (this week, last week, …, 12 weeks), weekly average in the trailing, source and
    manual marker.
  - Offline: cached last read with age (ServerCache, the Pénz rule); no net and no cache → the honest line.
- **Data:** `SulyStore` (BoopCore) reads, as `Task {}` handles: the season overview (`EvadClient.overview`, 404 = no
  season), the trend (`GET /api/biometrics/weight/trend`), the logs (`GET /api/biometrics/weight`) through a raw
  `SulyClient`, and body samples through the app's `HealthReader` (`readSamples(.bodyFatPct|.leanBodyMass)`). Re-read
  on `ritmus.weightTick` (new, bumped by `captureWeight` and by the outbox's sent weight), on scene active and on
  room close.
- **Route:** `Area.suly` → `.room(.suly)` → `NapView` drill → `SulyRoom`; `-previewHome suly`, `-sulyTab Test|Napló`.
- **Absorbs `mezo-r36n9.28`** (Testösszetétel): the Test tab is the Feelfit card; the goal-engine BMR part of `.28`
  stays open as its own backend follow-up.

## 4. Approaches considered

| | Amit csinálunk | Mi az ára | |
|---|---|---|---|
| Sheets: X on every sheet + refresh fix | one change in the frame, one line in Étel | overrides the Napkelte „grabber only" rule | **chosen** |
| Sheets: refresh fix only | one line | tall and medium sheets stay hard to close | rejected |
| Doors: five glass doors | one tap to the five frequent sheets | the other four doors only on the bar's „+" | **chosen** |
| Doors: one nicer „+" circle | a prettier capsule | a second door to the same sheet | rejected |
| Number: pace adherence | says whether he is doing it right now | „–" without a season | **chosen** |
| Number: progress to target | 0 at start, 100 at target | barely moves for months, says nothing about now | rejected |
| Ninth orb: smaller orbs at nine | nine fit on every phone | 46 pt on the smallest phone | **chosen** |
| Ninth orb: a second ring / swap an area | | the owner asked for nine | rejected |

## 5. Prior art (researcher)

- Apple's iOS 26 close role renders a circular Liquid Glass close top-trailing on informational sheets; Cancel/Done
  pairs only where data can be lost (nilcoalescing.com/blog/AddACloseButtonToSwiftUIModalsOnIOS26/). Adopted: the
  glass circle top-right, drawn cross (the canon allows no SF Symbol), environment dismiss.
- iOS button placement: a lone X is the informational sheet's close; grabber-only is fine only for short sheets
  (bigmedium.com/ideas/ios-button-placement.html). Adopted.
- Liquid Glass floating controls: a per-screen action is a custom glass button, not `tabViewBottomAccessory` and not a
  tab (donnywals.com/exploring-tab-bars-on-ios-26-with-liquid-glass/). Adopted as glass circles; a single FAB was
  rejected because the bar already has the „+".
- Weight apps (MacroFactor, Happy Scale) ship a trend line and a pace band or forecast rather than a % adherence
  (strongerbyscience.com/macrofactor-algorithms-philosophy/). Adopted the trend-vs-plan slope idea; the 0–100 number is
  Boop's own, with the word (pályán · lassabb · gyorsabb) next to it.

## 6. Codebase terrain (investigator)

- Sheets: `NKSheetFrame` (`BoopDesign/Napkelte/Frames.swift:372`, 32 users) is the one place; the only `.refreshable`
  is `Etel/EtelRoom.swift` (outermost, after six `.sheet`s). No close component existed; covers use a top-left chevron.
- Home: `Kezdolap/KezdolapView.swift` (`quickLogButton`, `ringView`, `loadNumbers`, `initialRoute`), `Kezdolap/Area.swift`
  (enum, `ringItem`), `BoopDesign/Napkelte/OrbRing.swift` (generic N positions), `SpineBar.swift` (the bar's „+").
- Hue: `Tokens.swift` — `name`, `glow`, `top` are arrays indexed by rawValue; `orb` needs four colours. Exhaustive
  switches: `Nap/AreaRoom.swift` (tabs, name, glyph), `Nap/MaiView.swift` (`metricKey`), `Nap/NapView.swift` (drill),
  tests `NapkelteTokensTests`, `MaiCopyTests` (`allCases.count == metrics + 2` → + 3).
- Pattern: Pénz (`Penz/PenzRoom.swift`, `PenzStore` with `Task {}` handles and `ServerCache`, `penzSheetStyle`,
  `PenzActionRow`); Évad already decodes the season's weight (`BoopCore/Evad/EvadWire.swift` `EvadWeight`,
  `EvadWeightPillar`, `EvadHead.status/trajectory`) and draws it (`Evad/EvadOverviewTab.swift`).
- Weight data: `api/feature/weight/weight.yml` (`listWeightLogs`, `logWeight`, `getWeightTrend` — all in the BoopAPI
  filter; the trend unused); the season's `weight.kgPerWeek` is the **planned** rate, the actual one is only in the
  trend endpoint; `HealthKitReader.readSamples(.bodyFatPct|.leanBodyMass)`. Writes: `WeightSheet` →
  `RitmusEnvironment.captureWeight` → `OutboxKind.weightLog`; no `weightTick` yet.
- Traps: `async let` abort (§9), the ring's motion rules (no blur over live orbs), one presentation per page level,
  the project file is a one-writer hot spot (new files need no edit), the simulator has no net (PreviewTransport).

## 7. Left to the builder

Copy of the head lines per status; the exact BMI source (profile height from `Me` if present); the Napló's week
grouping; the drawn `body-cream` glyph's shape; the info sheet's wording; the handbook page's examples (invented,
marked „például").
