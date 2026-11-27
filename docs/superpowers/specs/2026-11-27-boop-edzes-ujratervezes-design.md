# Boop Edzés — újratervezés: látható egységek, kiemelt fő elem, üvegkártyák

> bd `mezo-r36n9.197` · epic `mezo-r36n9` · B5 Edzés · follows decision #119 (`d-2026-11-27-kartyak-vissza`) · 2026-11-27
> Big slice (playbook §5): this spec + one simulator spike + a slice plan here; each step then runs in its own session.

## 1. Intent — why

The owner, 2026-11-27, about Edzés: „általánosságban nehéz megmondani, melyik logikai egység hova tartozik, és
összefolynak a menüsorok, szövegek, elemek" — worst on the **Mezociklus** tab. Decision #119 retired the flat
„kevés kártya, sok egymondatos tény" layout for every room; Étel Ma (`mezo-r36n9.184`, fd1788065) was the first room
moved. Edzés is next: every existing main page and sub-page gets a visual hierarchy where each logical unit is
visibly one thing.

Today the room is mostly `NKBare` blocks (hue tick + small-caps label, no surface) stacked on the sky, with a few
cards mixed in (`KovetkezikCard`, `TodaySessionCard`, `ExerciseCard`, `MezoTiles`). On the Mezociklus tab the running
block is a flat block whose three action pills (Szerkesztés · Újraindítás · Lezárás) sit between the title, the level
bar and the next block's label — the „menüsorok összefolynak" the owner names.

## 2. Goals · non-goals · anti-goals

**Goals**
1. Every page: **one hero element on top** that carries the page's point, then **one glass card per logical unit**
   with its label on the card's header — the card edge separates, not the text.
2. Menus and actions live **inside the card they act on** (or in a bottom bar on look-first pages), never as a free
   row between text blocks. **One primary action per page**, the rest quieter.
3. Small graphics that show the data's shape (the weeks' arc, muscle bars, body map, day strip) — no text-only cards.
4. **Shared building blocks first** (owner picked, §4): the glass section card and the paged hero become kit pieces;
   Étel Ma moves onto them with no visible change, every Edzés page is built from them.
5. Workout player: **rendrakás only** (owner picked, §4) — same card grouping and clearer ranking; every control,
   gesture and position stays.

**Non-goals**
- The empty **Gyakorlatok** and **Előzmények** tabs (owner: „csak a meglévők") — they keep their placeholder; only
  its look follows the card rule.
- **Éves terv** (`EvesTerv*`, `YearStrip`) and the **heti átnézés** (`WeekReviewDeck`, `WeekReviewEntrance`): they
  move to the Évad room under `mezo-r36n9.196`; this slice leaves them untouched (the entrance keeps its slot on the
  Mezociklus tab).
- No new features, no backend change, no change to what any button does.

**Anti-goals**
- The retired flat layout in any form; a page that is text + lists (a list-only page is fine only for search- or
  settings-like sheets).
- Moving a player control the owner's thumb has learned.
- Emoji; the word „Mezo" in a visible string („Mezociklus" is fine).
- Glass on glass (a card inside a card with its own glass) — inner groups use a plain divider or a faint fill.

## 3. Constraints

- **Napkelte canon**: dark glass, painted sky, colour only in the sky, the orbs and the key numbers; build from the
  kit (`ios/BoopKit/Sources/BoopDesign/Napkelte/`). Kit changes are **additive**: `NKBare` stays for the rooms that
  have not moved yet.
- **Every block loads and fails on its own** (`NKBlockState` semantics kept inside each card: loading, failed, the
  age text in the header's trailing slot).
- **Look first, then decide** (#116): pages that start or overwrite something keep their bottom bar.
- **Playbook §9 bar**: Dynamic Type XXXL (a paged hero stacks its pages at accessibility sizes and under VoiceOver,
  as Étel's does), VoiceOver labels on every card and control, smallest iPhone width, reduced motion, cached content
  instantly, smooth scroll on the heaviest page (Mezociklus tab, the player).
- **Parity**: every control and data field of every touched page still present; behaviour unchanged.
- **Parallel work**: `.196` (Évad room) owns EvesTerv/WeekReview; `.188` (Sport) edits kit files
  (`Tokens`, `Area`, `Frames`, `Glass`); `.113`/`.114`/`.125`/`.15` touch `BlockBuilderPage`, `UjBlokk*`,
  `WorkoutPlayer`, `PlayerTechnique`. Steps that touch those files go after those land, or rebase onto them.

## 4. Approaches (owner picked: shared building blocks first; player rendrakás only)

**Build order**

| | What | Cost |
|---|---|---|
| **A (picked)** shared building blocks first | Step 1 lifts Étel's private section card + paged hero into the kit; Étel moves onto them; then page by page. | Step 1 shows almost nothing new; afterwards every page speaks the same language and goes faster. |
| B page by page | Each page gets its own cards at once. | Pages drift apart; a later unification round. |

**Player depth**

| | What | Cost |
|---|---|---|
| **Rendrakás (picked)** | Same card grouping and ranking; controls stay. | Smaller change; nothing to relearn mid-workout. |
| Átépítés | Huge weight/reps hero, all controls in the thumb zone, rest as a big ring. | Relearning in the gym; the longest step. |

Rejected without asking: a big-bang single branch over ~25 screens (merge risk with four parallel sessions; violates
playbook §5 short sessions).

## 5. Design

### 5.1 The shared building blocks (step 1, kit)

- **`NKSectionCard`** — a glass card (`nkGlass(24)`, padding 16/12) whose header is today's `NKBare` head (hue tick,
  small-caps label, optional glyph, trailing slot for the age text or a „…" menu or a chevron), with `NKBlockState`
  handling inside. Optional tap target for the whole card (chevron in the header) — used where the card opens a
  sub-page. Lifted from `EtelMa.card(...)`.
- **`NKPagedHero`** — a glass hero card (radius 28) with 1–3 pages, the capsule dots, a fixed height, stacking its
  pages vertically at accessibility Dynamic Type / VoiceOver. Lifted from `EtelMa.heroCard`.
- **`NKCardActions`** — the in-card action row: one primary capsule (white) + up to two quiet ones, or a „…" menu
  for the rest; reflows to a column at large type (`ViewThatFits`). Replaces the free pill rows.
- **Room sky** (owner picked the lighter step, #129): `Hue.roomSky` gets a `mozgas` case
  `[0x5C7FC0, 0xF4BC8E, 0xFFEFCB]` and `roomTop` `0x34507E` (the spike's `-spikeSky 2`).
- Étel Ma switches to `NKSectionCard` / `NKPagedHero` with **no visible change** (screenshot-compared in the step).

### 5.2 Mezociklus tab (step 2 — the owner's worst page)

Top → bottom:
1. **Hero — „A mezociklusod"** (single-page hero card, no dots — my call, so the muscle load is not shown twice):
   title, „3. hét az 5-ből · felső–alsó" (például), and **the weeks' arc** as the dominant graphic
   (`NKBlockTimeline` grown into the hero, from existing data — `edzesTimeline(b)` already gives one bar per week
   with the phase load, the current/past/future state and the deload flag; no new data). Under it the in-card
   actions: **Szerkesztés** primary; Újraindítás · Lezárás · Mentés a sablonba behind a „…" menu in the hero header
   (**owner picked the „…" menu over visible quiet capsules, #129**).
2. **Heti átnézés entrance** — unchanged (Évad-owned), in its current slot.
3. **„A heted" card** — the day carousel (`DayCard`s) inside the card; today's day ringed, done days ticked.
4. **„Izmok ezen a héten" card** — this week's top muscles as slim bars with set counts (the data behind today's
   `muscleSummary` / `muscleBands`), „+N további", whole card → `BlockLoadPage`.
5. **„Tovább" card row** — Mezociklusaim · Éves terv tiles (today's `MezoTiles`) as two small cards.
6. Ask row.

No running block: the hero becomes „Nincs futó mezociklusod" with the planned one (if any) as its body and
**Új mezociklus** as the hero's primary action; then the Tovább row. Failed load: the hero shows the calm no-data
line; the Tovább row stays.

### 5.3 Ma tab (step 3)

1. **Hero — „A mai edzés"** (`NKPagedHero`):
   - *Page 1:* label (ma / pótlás / megvolt), session title, three stat numbers (perc · gyakorlat · sorozat), time;
     primary **Indítás / Folytatás** (or **Eredmény** when done); the „Másik napot csinálok ma" / „Mégis a mai napot"
     quiet links inside the card.
   - *Page 2:* „A mai terhelés" — today's body map (moved from its own block).
   - Rest day: „Pihenőnap" + the next session's title and day; no page 2.
2. **Következik card** — unchanged content, moved **under the hero** (owner OK #129: at the top two orange primaries
   competed).
3. **„A mai gyakorlatok" card** — the `ExerciseCard` carousel inside the card.
4. **„Hol tartasz" card** — a compact weeks' arc (same graphic as the Mezociklus hero, small), tap → Mezociklus tab.
5. **„Az Edzés terület" card** — the menu grid inside a card.
6. Ask row.

### 5.4 Mezociklus sub-pages (step 4)

- **Mezociklusaim** (`MezociklusokPage`): hero = the running block (title, week ring, arc mini); cards: Következik ·
  Sablonjaim (horizontal card row) · Lezártak (rows inside one card, newest first).
- **Mezociklus részlet** (`MezoDetailPage`): hero = the weeks' arc + title + status tag; cards: A hét napjai
  (carousel) · Mit kapnak az izmok (bars) · Hogy sikerült (closed only); bottom bar unchanged (look first).
- **Zárójelentés** (`MezoReportPage`): hero = the result in one number/ring with Boop's one-line verdict; the five
  sections as cards.
- **Terhelés** (`BlockLoadPage`, `MuscleWeeksPage`): hero = this week's total sets with the per-muscle bar chart;
  muscle rows inside one card; the muscle page's hero = that muscle's weeks chart, then Határai · Hol van cards.
- **Sheets** (`MezoRestartSheet`, `MezoCloseSheet`): sections as cards, no structure change.

### 5.5 Workout flow (step 5 — rendrakás)

- **Eligazítás** (`WorkoutBriefing`): hero = session title + the three stat numbers; then one card per exercise
  group / mission; the start button where it is.
- **Összegzés** (`WorkoutCeremony`): hero = the big result (time, volume, the record if any); the rest as cards.
- **Lejátszó** (`WorkoutPlayer`): group the current exercise's info (name, target, technique line, set strip) into
  one card and the next-up into a quieter card; header ranks the exercise name above the meta. **No control moves**
  — the set controls, rest bar, swipe and sheet entries keep their position and size. Sub-sheets (note, set fix,
  exercise menu, swap, records, technique) get card sections only.
- `SwapSheet`, `OtherDaySheet`, `RestEndSheet`, `GymSheet`, `WorkoutAsPlannedSheet` (shared with Napló/Shell):
  card sections only.

### 5.6 Blokképítő + nap-szerkesztő (step 6, last)

Already card-based. Align to the kit: section headers via `NKSectionCard` heads, one primary per mode, the
`DayEdit*` sheets' groups as cards. Runs after `.113`/`.114`/`.125` land (shared files).

### 5.7 Empty tabs

Gyakorlatok / Előzmények: the `NKNotLiveYet` message sits in an `NKSectionCard`; nothing else.

## 6. Spike (owner gate ②)

One throwaway spike on the preview fixtures (`-preview shell -previewHome edzes`, `-previewMezo …`,
`-previewEdzes*`): the **Mezociklus tab**, the **Ma tab**, **Mezociklusaim**, **Mezociklus részlet**, plus one player
screenshot before/after the rendrakás; each in normal, empty, loading, error, offline, smallest iPhone, XXXL type;
the sky at today's and a lighter step side by side. Sheets, report, load pages and builder follow the same rule and
are shown at each step's end.

### 6.1 Spike result (2026-11-27, owner OK — decision #129)

Branch `spike/boop-edzes-ujratervezes` (`bb7edca44`, throwaway). Shown: Ma and Mezociklus tabs (top and lower
parts), the „…" menu vs visible capsules, sky 1 vs 2, Mezociklusaim, Mezociklus részlet, no block / failed /
offline (`-spikeState nincs|hiba|offline`), iPhone 16e, XXXL type. Accepted as the direction. Glitches the build
fixes (they are part of each step's *Kész, ha…*):
- **XXXL:** the hero's three stat words truncate („gyakorl", „éles") — the stats stack vertically at accessibility
  sizes; the block title breaks mid-word („Hypertrop / hy") — allow word-wrap with `minimumScaleFactor`, never a
  mid-word break; the muscle bars' name and number collide — row becomes name over bar at accessibility sizes;
  the „ÚJ HÉT" entrance's secondary capsule overflows — `NKCardActions` reflow to a column.
- **Menu grid** inside „Az Edzés terület" card: tiles keep the faint inner fill (no second glass) — use the
  inner-card treatment, same as the day/exercise cards.
- **Loading flash:** the Mezociklus tab briefly shows „Nincs futó mezociklusod" before the block arrives — show the
  hero's calm loading state until the first answer (or the cache) decides.
- **Ma hero height:** the fixed pager height leaves empty space on page 1 when there is no running progress; the
  spike filled it with the „Másik napot csinálok ma" link (now inside the hero, as §5.3 says) — measure per state.

## 7. Steps (each one session, own bd child under `.197`, merged to main on its own)

0. Spike + slice plan (owner OKs).
1. Kit building blocks + Étel onto them (no visible change).
2. Mezociklus tab.
3. Ma tab.
4. Mezociklus sub-pages + sheets.
5. Workout flow rendrakás (briefing, ceremony, player, its sheets).
6. Builder + day-edit sheets (after `.113`/`.114`/`.125`).

### 7.1 Sequencing and gates (my calls, from the builder check)

- **Step 0 is the spike** (§6, done — #129: lighter sky, „…" menu). Then the slice plan (owner OK). No step builds
  before both.
- **Step 1 adds the kit pieces as new files** (`NKSectionCard.swift`, `NKPagedHero.swift`, `NKCardActions.swift`)
  and the `mozgas` sky case in `Tokens.swift` (a two-line edit — rebase onto `.188` if it is in flight there).
- **Steps 5 and 6 start with a status check** of `.125`/`.150`/`.15` (player) and `.113`/`.114` (builder): if one
  is still in flight on those files, the step waits or rebases onto its branch after it merges; never two writers on
  one file.
- **Paged hero states:** one page → no dots; loading → the hero frame at its height with the calm loading line;
  failed → the no-data line inside the hero. The stack-at-accessibility rule applies to the hero only; carousels
  (`DayCard`, `ExerciseCard`) keep their own existing large-type behaviour.
- **Player:** info blocks may shift inside the new cards; every control keeps its size and its position relative to
  the bottom edge (the thumb zone). If a control would have to move to make a card, that grouping is skipped.
- **Étel „no visible change":** there are no golden baselines (retired); step 1 takes simulator screenshots of Étel
  Ma on the fixtures before the lift and compares after.

## 8. Left to the builder

- Exact kit API names/signatures; whether `NKSectionCard` wraps or replaces `NKBare` internally.
- Hero heights per page (measured on fixtures at XXXL; the carousel height is given, not measured).
- Whether the weeks' arc is a new kit chart or a grown `NKBlockTimeline`.
- Which player sub-views form the „current exercise" card without touching control layout.
- Rebase/merge order against `.188` kit edits.

## 9. Prior art

- **Apple** (Adopting Liquid Glass; HIG Materials; WWDC25 323): glass is the control layer, content cards use
  standard materials — **adopted**: our `nkGlass` cards are the content layer; no glass-on-glass. `tabViewBottomAccessory`
  for a running workout — **rejected for now** (iOS 26 only, and a new feature, out of scope).
  developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass ·
  developer.apple.com/design/human-interface-guidelines/materials · developer.apple.com/videos/play/wwdc2025/323
- **watchOS 26 Workout backlash** (MacRumors 2025-11-20): a more graphical but deeper layout hid the primary action —
  **adopted as a rule**: the hero keeps the page's primary action in it.
  macrumors.com/2025/11/20/apple-watch-users-workout-app-complaints/
- **Training apps** (Hevy/Strong/Fitbod comparison, sensai.fit, low trust; Whoop/Oura/RP from general knowledge,
  unverified): hero ring/arc + cards below (Whoop, Oura, Apple Fitness) — **adopted**; RP's week-by-day mesocycle
  grid — **adopted** as the weeks' arc + day carousel; Hevy/Strong dense set tables for history — **rejected**.
  sensai.fit/blog/hevy-vs-strong-vs-fitbod

## 10. Codebase terrain

- Room: `ios/Boop/Edzes/EdzesRoom.swift` (1158 lines; Ma `:422`, Mezociklus `:828`, empty tabs `:951/:957`,
  cards `ExerciseCard :969`, `TodaySessionCard :1005`, `DayCard :1090`).
- Mezociklus: `ios/Boop/Edzes/Mezociklus/` — `MezoCurrentCard.swift` (the flat block + free pills), `MezociklusokPage`,
  `MezoDetailPage`, `MezoReportPage`, `MezoRestart/CloseSheet`, `MezoKit` (`MezoMiniCurve`, `MezoRing`).
- Load: `ios/Boop/Edzes/EdzesBlokk.swift` (`BlockLoadPage :27`, `MuscleWeeksPage :147`).
- Workout: `WorkoutBriefing`, `WorkoutPlayer` (1203 lines), `PlayerTechnique`, `WorkoutCeremony`, `SwapSheet`,
  `WorkoutAsPlanned` (shared with `Naplo/NaploCatchUp.swift:211`, `Shell/ShellView.swift:203`).
- Builder: `ios/Boop/EdzesTerv/BlockBuilderPage.swift` (1709 lines), `DayEditSheets.swift`, `PlanKit.swift`.
- Étel's private pieces to lift: `ios/Boop/Etel/EtelMa.swift` `card(...) :60`, hero `:85–200`.
- Kit: `Area.swift` (`NKBare :88`, `NKBlockState :79`, `NKAreaPage :204`, `NKAreaSubPage :442`), `Glass.swift`
  (`nkGlass :5`), `Carousel.swift`, `Train.swift` (`NKBlockTimeline`), `Tokens.swift` (`Hue.roomSky`).
- Preview flags: `EdzesTerv/PlanPreview.swift :10–40`, `RootView.swift`, room-level flags in `EdzesRoom.swift ~:295`.
- Traps: kit files shared with `.188`; CODEMAP silently dropped by merges (regenerate); `WorkoutAsPlannedSheet` is
  shared; `TopBounceLock.swift` may not be on main yet; never pull-to-refresh (`.191`).
