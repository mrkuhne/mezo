# Boop — a nap oldala az Élet-spike Ma képernyője (plan)

- **Issue:** `mezo-r36n9.56` · **Epic:** `mezo-r36n9` · **Date:** 2026-11-16
- **The build target is a screen, not a spec:** `docs/design_2.0/prototypes/boop-ios-spike/elet-1-ma.png`
  (`-elet YES`, source `BoopSpike/EletMa.swift` + `EletKit.swift`). The owner pointed at it and said the day's
  page is that screen: *"a 8. gömb - a Nap és a középső gömb azok mind majd a csatolt képen lévő szimulátor nap
  oldalához vigyenek. azt ott jól kidolgoztuk."*
- **Owner answers taken for this slice (2026-11-16):** no orb ribbon on the page (the ring is the only door to
  the areas — decisions #32–#33 stand); **no Reggel / Napközben / Este tabs** — one scroll, those are headings.
- **Builds on:** the ring (`mezo-r36n9.47`, `.55`), the living wall (`.45`), the area-page kit (`.37`).

## 1. What changes for the owner

Opening the day — from the ring's **centre** or from its new **Nap orb**, both doors land here — he no longer
gets a full screen of one big orb and a score-less verdict before anything useful. He gets, in one scroll:

| # | Block | What it is |
|---|---|---|
| 1 | **Fejléc** | the date, `boop`, the hairline, over the ridge photo. No orb, no tabs, no second menu. |
| 2 | **Mai nap** | the day's curve with the day's big moments sitting on it as small pins (ébredés, posta, ebéd, edzés, alvás), the hour scale, the "most" line, and a *A napod →* link into the full list. |
| 3 | **Most** | the living wall, unchanged (at most three cards + the check-in), with the count next to the heading. |
| 4 | **Folds** | *Ma történt* (from the wall), *A reggeli összefoglaló* (Boop's morning words, with *Hallgatom*), *A napod* row. |
| 5 | **Amit ma észrevettem** | the brief's cross-area observations as their own cards, with the *igaz / nem igaz* verdict they already have. |
| 6 | **Este** | the evening close card, as today. |
| 7 | **Kérdezem** | one row into Boop's chat with today's patterns. |

## 2. How it is built

- **`EnergyCurveCard` grows event pins** (`BoopDesign/Napkelte/Ritmus.swift`): a new `events: [EnergyCurveEvent]`
  (fractional hour · glyph · label · detail). Pins sit on the curve at their hour, alternate height so they do not
  collide, drop their label when two are closer than ~5 % of the width, and a tap shows the detail line under the
  card. Nothing else about the card changes, so Napló keeps the curve it has (it passes no events).
- **The events come from what the day already carries** (`MaDayEvents`, pure, tested): the brief's wake, meals,
  session, bedtime and the calendar's busiest block, mapped onto `curveAnchors`-style anchors. Nothing is invented
  and nothing is re-derived — the same values the timeline shows.
- **`MaiView`'s hero shrinks** to the title row + date + wordmark + hairline. The `RisingOrb`, the caps, the
  42 pt verdict, the sentence and the phase strip leave the day page. The lens action row stays for now as one
  compact row (it is the only home of the breathing exercise and the bedtime toggle) — flagged at the gate.
- **`MaBelow` is reordered** into the seven blocks above; the phase headings become plain headings inside the
  scroll (`phaseHead` keeps its anchor role for Napló, which still uses it).
- **Both doors land here:** `KezdolapRoute.day` stops opening the day *sheet* and opens this page, like the centre.

## 3. Kész, ha…

**Amit a tulajdonos lát**
- [ ] The page matches `elet-1-ma.png` block by block: fejléc · Mai nap · Most · foldok · észrevételek · este · kérdezem.
- [ ] The Nap orb and the ring's centre open the same page.
- [ ] The day's pins sit on the curve at the right hours and say what they are; a tap tells more.
- [ ] No orb ribbon and no phase tabs anywhere on the page (owner, 2026-11-16).
- [ ] Nothing that is on the page today is gone without a new home: the morning brief, the plan and its *Elfogadom*,
      Boop's voice, the check-in, the timeline, the energy curve, the evening close, the kímélő banner, the bedtime
      reminder, the breathing exercise (reverse parity list in the commit).
- [ ] Empty / loading / failed states per block; 375 pt; Reduce Motion; the largest Dynamic Type step the page supports.

**Hogy működik**
- [ ] `MaDayEvents` is pure and tested: the order, the hours, a day with nothing on it, a day with two moments in the
      same quarter hour, a moment outside 06:00–24:00.
- [ ] The curve card renders with and without events, and Napló's curve is byte-identical in behaviour.

**Kapuk**
- [ ] `xcodebuild test` for `Boop` and `BoopKit-Package` — green except the known `mezo-r36n9.52` failure.
- [ ] `gen-codemap.mjs`, `lint-docs.mjs` 0 errors / 0 stale.
- [ ] `docs/features/boop-ios.md` §2, the feature index row, a milestone entry, the `/boop` skill's state block,
      the handbook page of the day, and the Notion sync (`check` exits 0).

**Kész**
- [ ] Shown to the owner in the simulator (his gate), merged to main the way the project prescribes.

## 4. What this slice does not do

The area pages (step 3, `mezo-r36n9.57`) and the review of B4→B8 against the new look (step 4, `.58`) are their own
slices. No backend change: everything on the page is already in the brief, the day ledger and the food plan.
