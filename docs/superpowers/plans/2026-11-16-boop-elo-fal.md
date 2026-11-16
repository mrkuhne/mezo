# Boop L0/b — Ma, az élő fal (plan)

- **Issue:** `mezo-r36n9.45` · **Epic:** `mezo-r36n9` · **Date:** 2026-11-16
- **Spec:** [`2026-11-13-boop-life-dashboard-design.md`](../specs/2026-11-13-boop-life-dashboard-design.md) §3.1 ·
  look settled in the Élet spike rounds 6–7 (`EletFeed.swift`, `elet-1-ma.png`, `elet-2-most.png`, `elet-3-ma-tortent.png`)
- **Owner decisions:** #13 (a living wall, not a timeline; the 0–100 score leaves the home), #14 (rounds 3–5),
  **#34 (2026-11-16: three fixed roles decide the three cards)**, **#35 (2026-11-16: only the first role may ring
  the phone, once or twice a day)**, #32–#33 (the ring is the entrance, so this page sits behind the ring's centre)
- **Builds on:** the ring (`mezo-r36n9.47`) and the shared area-page kit (`mezo-r36n9.37`), both on main

## 1. What changes for the owner

The page behind the ring's centre stops being the day's timeline to scroll and becomes **what Boop wants to say
right now**: at most three cards, the check-in pinned above them while it is due, and — when there is nothing —
one warm line instead. The morning briefing and the day's timeline do not disappear; they fold into one row each,
open in the morning and closed later. Below them the day's energy curve and the cross-area notices stay.

**The three cards are three roles, always in this order** (decision #34):

| # | Role | What goes in it | Example |
|---|---|---|---|
| 1 | **Ami elromlik, ha most nem csinálod** | Something with a deadline that is still actionable | „Az ebéd ablaka 14:00-kor zárul” · the check-in while it is due |
| 2 | **Ami a legtöbbet javít a mai napodon** | The one step that moves today | „Vacsorára 50 g fehérje kell — egy csirkés tál pont ennyit hoz” |
| 3 | **Ami történt és tudnod kell** | Something that already happened | „Megjött a reggeli posta · 2 érdekes” |

A slot with nothing to put in it **stays empty** — the wall shrinks, it does not pad. A card he acts on **settles
into „Ma történt”** with its own one-liner instead of vanishing. Every card carries a **„miért?”** that can say
both why Boop is saying this and what it set aside for it.

**And the wall may reach his pocket, but only from the first slot** (decision #35): a candidate in the `.expires`
role may raise a local notification, **at most one or two a day**, on top of the two Boop already rings (the
check-in and bedtime, B3). The other two roles never ring. The cap is part of the rule, not a setting — a rule
without a cap is the same as letting Boop decide, which he turned down.

## 2. How it is built

### 2.1 The engine (pure, in `BoopCore`)

`Morning/Wall.swift` — no SwiftUI, no network, unit-tested:

```swift
public enum WallRole { case expires, improves, happened }   // the three slots, in this order
public enum WallKind { case teendo, tortent, keszulj, reakcio }
public struct WallCandidate { id, role, kind, area, expiresAt, text, sub, big, photo, actions, settled, why }
public struct Wall { pinnedCheckIn, hero, rows, settledToday, emptyLine, nextVoice }
public func buildWall(_ candidates: [WallCandidate], now: Date, acted: Set<String>, checkIn: CheckInState) -> Wall
```

Rules, each its own test:
- **At most one card per role**, and at most three in all. Within `.expires` the soonest still-actionable one;
  within `.improves` the source's own rank, ties broken by area order; within `.happened` the most recent he has
  not seen.
- **The hero** is the highest-role card present; it takes the photo band if it has a photo, and reads at 25 pt.
  The other two are compact rows inside one card. The check-in is neither — it keeps its own tinted question shape.
- **Acted cards** leave the wall and appear in `settledToday`; the slot does not refill from a lower role.
- **Empty** is a state, not a failure: `emptyLine` plus `nextVoice` (when Boop will next have something).
- **A card never repeats** once settled or dismissed today.
- **`notifiable`** is true only for `.expires` candidates; the planner rings at most twice a day and never for a
  card already settled, dismissed or seen on the wall in this session.

### 2.2 The sources are a registry, not a list

`WallSource` is a named function `(WallInput) -> [WallCandidate]`; the app registers one per area. Edzés, Pénz and
Levél add themselves later without touching the engine or the view — the parent session asked for this explicitly
and it is the difference between a wall that grows and one that is rewritten each slice. Day one registers:
**Ritmus** (check-in, evening close), **Étel** (meal windows, the reaction to a logged meal, supplements),
**Alvás/Energia/Forma** (the brief's own observations), **Nap** (the calendar's next commitment).

### 2.3 The view (`BoopDesign/Napkelte/Wall.swift` + `ios/Boop/Nap/`)

The three weights of round 7, built from the shipped kit where it already fits (`NKCardPhoto`, `NKHueText`,
`NKBadge`, the glass card): the check-in question card · one hero with the photo band and 25 pt serif · the rest as
compact rows inside a single card (52 pt thumbnail, two lines, the number in weight on the right, the action as an
inline link). „Ma történt” is a folded section under them.

## 3. Kész, ha…

**Amit a tulajdonos lát**
- [ ] The wall shows at most three cards plus the pinned check-in, in the three fixed roles, on his real day.
- [ ] The hero carries its photo where the thing has one, and no photo where nothing fits (B3/b rule).
- [ ] A card he acts on settles into „Ma történt” and does not come back today.
- [ ] Every card's „miért?” opens and says why this, in Boop's voice.
- [ ] **The empty wall** reads warmly and says when Boop will next speak — shown deliberately in review.
- [ ] The morning briefing and the day's timeline are one row each, open in the morning, closed later; nothing
      that is on the page today has silently disappeared (reverse parity list in the PR body).
- [ ] The energy curve and the cross-area notices still follow them.
- [ ] Loading, failed and offline states per block (the kit's `NKBlockState`), never one page-level spinner.
- [ ] 375 pt wide; Reduce Motion; Dynamic Type at the largest step the page already supports.

**Hogy működik**
- [ ] `buildWall` is pure and tested: one card per role · the cap of three · the hero choice · acted cards settle ·
      an empty slot shrinks the wall · nothing repeats after settling · the check-in pins only while due.
- [ ] A new area adds itself by registering a source — proven by a test that registers a fake area and sees its
      card on the wall with no change to the engine or the view.
- [ ] The 0–100 score does not appear on this page (it lives in the areas, next to the data it came from).
- [ ] Only `.expires` candidates are notifiable, the daily cap holds, and a settled or seen card never rings —
      each its own test, with the clock injected.

**Kapuk**
- [ ] `xcodebuild test` for `Boop` and `BoopKit-Package` — green except the known `mezo-r36n9.52` failure.
- [ ] `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs` 0 errors / 0 stale.
- [ ] `docs/features/boop-ios.md` + the feature index row + a milestone entry; the `/boop` skill's state block.
- [ ] Beads backup refreshed; `node scripts/boop-notion-sync.mjs check` exits 0.

**Kész**
- [ ] Merged to main the way the project prescribes, codemap regenerated after the merge, the primary checkout
      fast-forwarded, the branch deleted.

## 4. What this slice does not do

The ring and the area pages are done and not touched. No new backend, no new API operation: the wall is built from
what the brief, the day ledger and the food plan already carry. Pénz and Levél have no source yet — they register
when they are built. The workout player and every other full-screen flow stay outside.
