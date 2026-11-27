# Boop: a barless home ring, and Évad as its own orb and room (2026-11-27)

**Issue:** `mezo-r36n9.196`. **Owner conversation:** 2026-11-27 (this session). **Status:** spec, waiting for owner OK →
simulator spike → plan.

## 1. Intent

The owner opened the Évad and could not tell what it is for, when to open it, what he sees on it, or how it relates to
Étel, Edzés and Alvás. Measured on `main`: the Évad tab is **eleven blocks on one scroll** (Mi mire hat, Súly, Az évad
terve, Hogy megy, Teher és pihenés, a Boop-javaslat kártya, A jövő heted, Mennyit bírsz, Amit a mozgatásokból tanultam,
Amit Boop észrevett, Következik, + Módosítás/Új évad), plus three inner tabs (Menü · Lista · Hatás) and Szabályok in the
corner. The kitchen (menu, shopping list) and a third topic (experiments) live inside it, and the Edzés room has a
second long-range plan (Éves terv) whose relation to the season is never shown.

His usage, in his words: **Sunday evening** — see how the week went and what comes; **during the week** — glance at
how he stands. He wants Évad to be a domain like the others (own orb with a number, own room with its own bar), split
into nested pages with custom graphics and icons — "rather more levels deep than crowded", every page saying what it
shows and what it is for, holding the user's hand. The capacity work of 2026-11-26/27 (load vs recovery, next-week
rebalancing, learned patterns, the advisory lighter-week card) is the part he flagged as especially important.

While shaping it he extended the scope to the home screen itself: **no bottom bar at all** — the ring is the menu.

### The one-sentence model (shown to the user, used everywhere)

> **Az Évad mondja meg, mennyit és miért; az Étel, az Edzés és az Alvás szoba azt, mit csinálsz ma; a Súly szoba
> mutatja, mi lett belőle.**

Hierarchy, made visible in Évad › Terv: **Év** (Edzés › Éves terv, 52 weeks of blocks) → **Évad** (a few weeks: the
goal, the running block, food, sleep) → **Hét** (Sunday review) → **Nap** (the rooms).

## 2. Goals · non-goals · anti-goals

**Goals**
- Home: ten orbs, no bottom bar, no quick doors; centre orb → Boop chat; top Nap orb → the Nap room (today + morning
  summary + Napok history); one floating „+" bottom-right.
- Évad is the tenth orb with its own number (this week's adherence %) and its own room with an `NKAreaBar`:
  **Most · Hét · Terv · Kísérlet** (+ Boop).
- A guided five-page **Sunday weekly review** ("Heti átnézés") that gathers the scattered weekly pieces into one flow.
- Weekly menu + shopping list move to the Étel room; the Napló day list moves to the Nap room.
- Every page: a hero visual on top, one sentence saying what this page shows, then at most a few glass cards; detail one
  level deeper (owner UX rule `mezo-r36n9.177`: no plain text-and-list pages).
- Each tab and each Sunday-review page gets its **own custom glyph/illustration** (drawn in the Napkelte kit style).

**Non-goals**
- No new server calculation. Every number already exists (`EvadOverview`, `/api/capacity/season`, capacity week
  proposals, menu, experiments, year plan). Backend changes are allowed only where the builder finds a genuinely missing
  read (see §8); none is expected.
- No change to what the season *is* or how targets are computed. No change to the Éves terv editor (stays in Edzés).
- Korábbi évadok page — still later (unchanged plan).

**Anti-goals** (failure even if it technically works)
- Any block appearing in two places with two different numbers.
- Two doors to the same thing (e.g. Évad in a bar *and* on the ring; menu in Évad *and* in Étel).
- A Sunday review that is a chore: it must be skippable at every step, and leaving half-way changes nothing.
- An invented number: no season or nothing judged yet → the orb shows „–", never 0.
- Losing a control or data field that exists today (parity, §6).

## 3. Approaches

| Approach | What it is | Trade-off |
|---|---|---|
| **A. Évad room + barless ring, Sunday review as a guided flow** (picked) | Évad becomes a ring room on the Súly/Pénz template; weekly pieces move into Hét + the review; menu/list → Étel; spine bar removed. | Biggest change, but removes every duplicate door and gives each visit (glance / Sunday / rarely) its own place. |
| B. Keep Évad as a spine place, only split its page into sub-pages | Same bar, fewer blocks per page. | Leaves the relation to the rooms unclear and keeps two kinds of "place"; owner rejected the bar. |
| C. Move the year plan into Évad as well | All long-range planning in one room. | Évad gets heavy and muscle-focus detail moves away from training. Owner picked "show the year in Évad, edit it in Edzés". |

Owner decisions in this conversation (2026-11-27), to record as rows in `_dontesek.json` and
`14-decisions.md`:
1. Évad is its own orb + room with its own bar (Most · Hét · Terv · Kísérlet).
2. Weekly menu + shopping list move to the Étel room.
3. The home has **no bottom bar**: Napló place and the five quick doors go; centre orb → Boop chat; top orb stays Nap;
   only a „+" bottom-right.
4. The Napló day list moves into the Nap room ("Napok" tab).
5. The year is shown in Évad › Terv as a strip; blocks are still edited in Edzés › Éves terv.

My calls (stated to the owner, he did not object): the orb number is this week's adherence %; all capacity pieces live in
Hét + the review; one build, two steps (home first, then the Évad room); the Sunday review is announced by a Ma-wall card
and a local notification at 18:00.

## 4. What the owner sees

### 4.1 Home (step 1)

```
                 Nap
         Levél         Alvás
      Pénz               Étel
                (Boop)
      Forma              Edzés
         Súly         Energia
               Évad
                                  (+)
```

- **Ten orbs** in the ring. Order (clockwise from the top): Nap, Alvás, Étel, Edzés, Energia, Évad, Súly, Forma, Pénz,
  Levél — Évad sits at the bottom, between Energia and Súly (it feeds both). The builder re-checks orb size on the
  smallest width (`KezdolapView` picks `orbSize` per width; names must still fit).
- **Centre orb** (Boop's still orb + its daily line underneath) → opens the **Boop chat** (full-screen room, back
  returns to the ring). The daily line stays.
- **Top orb Nap** → the **Nap room**: today's page (what the centre opened until now — the morning summary, the
  timeline, the Ma wall) plus a **Napok** tab with the last 14 days (today's Napló place content; each day opens its day
  page as now).
- **No bottom bar.** The spine (`ShellTab`, `SpineBar`, the panorama of three places) is removed. Ma/Évad/Napló/Boop as
  places are gone; everything is a room opened from the ring.
- **No quick doors** under Boop's line.
- **„+"**: a floating glass circle bottom-right (same look as today's bar „+"), visible on the ring **and inside rooms**
  (so capture is always one tap away); it opens the existing „Mit rögzítesz?" sheet unchanged. The builder decides in
  the spike whether it hides while a sheet or full-screen sub-page is up.
- **Account avatar** stays in the home's title row (today it is in the Ma page title row).
- Everything that today calls `openPlace(.terv|.naplo|.boop)` (Ma-wall cards, Edzés "open season", Súly rows, the „+"
  "Edzés indítása", notifications, deep links, widgets) is re-pointed to "open room X" (`router.openRoom`).

### 4.2 Évad room (step 2)

Shared area page frame (`NKAreaPage` with `tabs`, `selectedTab`, `onBack`, `onAsk`), the evening-violet sky, its own
`Hue` (new case; today it borrows `.forma`, which collides with the Forma room). Bar: **Most · Hét · Terv · Kísérlet ·
Boop**, each with its own new glyph. Szabályok moves into Terv.

Every tab opens with the same anatomy: **hero visual · eyebrow (season name · week N of M) · one sentence "what you see
here" · glass cards**, each card opening a deeper page where there is more.

#### Most — „Hogy állok a héten?" (the mid-week glance, ~10 seconds)
1. **Hero:** the room orb filled to this week's adherence %, number inside; under it one plain sentence from the facts
   (e.g. „Jól megy a hét, csak az alvás csúszik" — template from the three ratios, no AI needed; builder's wording).
2. **Three bars:** Étel (napok a kereten belül), Edzés (alkalmak megvoltak / tervezett), Alvás (éjszakák elég / mért) —
   this week so far, Monday to yesterday, same rules as today's „Hogy megy". Tap → a sub-page with the day-by-day breakdown.
3. **A hét napjai:** seven day dots (H–V), each coloured by how the day went (in / out / kímélő / future / today); tap a
   day → that day's page in the Nap room.
4. **Ami jön:** the next one or two things (next training, a lighter week ahead, Sunday review in N days).
5. On Sunday from 18:00 (and until the review is done or Monday ends): a highlighted card on top, „Kész a heti
   átnézés" → starts the review.

Empty/early: Monday morning with nothing judged → the hero says so („Még nincs mit nézni — a hét most kezdődött"),
bars hidden, day dots shown.

#### Hét — „Hogy ment, és mi jön?"
1. **Hero:** the **Heti átnézés** card — status (available on Sunday from 18:00 / done / last week's summary) and its
   button. Outside Sunday it shows the last review's one-line takeaway and lets him reopen last week's.
2. **Teher és pihenés** — the season load chart (today's `NKSeasonLoadChart`), the headline sentence; tap → a deeper page
   with the chart large and the footnote.
3. **A jövő heted** — only while next week has open proposals: the strip + „N javaslat" → the Átrendezés page (unchanged).
4. **Boop javaslata** — the advisory lighter-week card (unchanged rule #121: only tells; one action, „Megbeszélem
   Boop-pal").
5. **Mennyit bírsz** + **Amit a mozgatásokból tanultam** + **Amit Boop észrevett** — one card „Amit Boop tanult" with a
   count; tap → a page listing the stats, patterns and insights (≤3 insights, unchanged data rules).

#### Terv — „Mi a nagy terv?" (opened rarely, to understand or change)
1. **Hero: the year strip** — 52 weeks, the year-plan blocks as segments, the season highlighted as a bracket, „itt
   tartasz" marker. No year plan → the strip shows only the season. Tap → Edzés › Éves terv (crumb back to Évad).
2. **Az évad hetei** — weeks 1…N, lighter weeks marked with their reason, the end of the season; (today's „Következik"
   folds into this strip).
3. **A cél** — goal, target date, the weight course (today's Súly block: curve, target line, dashed plan); tap → Súly room.
4. **Mi mire hat** — the system map (unchanged), now one level deep: a card „Mi mire hat" → its own page with the map
   and the one-sentence model from §1.
5. **Az évad terve** — the four plan rows (block + sport days · training/rest/both-day kcal + protein · sleep need +
   bedtime · goal + date), each row opening the room it belongs to (Edzés / Étel / Alvás / Súly).
6. **Szabályok** — a row → today's rules page.
7. Actions: **Módosítás** (today's live-preview what-if) and **Új évad** (today's five steps).

#### Kísérlet — „Kipróbálok valamit"
Today's Hatás tab content, unchanged (one experiment at a time, Boop may propose, honest result), under the new anatomy
(hero = the running experiment's progress, or an illustrated empty state with „Új kísérlet").

#### No season yet
The room opens on an illustrated empty state (today's „Indítsunk egy évadot" copy + „Megnézem" → Új évad); the bar is
hidden until a season exists; the orb shows „–".

### 4.3 Heti átnézés — the Sunday review (step 2)

A full-screen guided flow, one question per page, a progress line of five dots on top, „Tovább" bottom, „Később" (top
left) leaves at any step **without changing anything**. Each page has its own illustration.

| # | Page | Content (all existing data) | Action |
|---|---|---|---|
| 1 | **Hogy ment a hét?** | The week's three ratios + day dots, kímélő days excluded with their line | — |
| 2 | **Mit tanult Boop?** | ≤3 insights + learned patterns + „Korábban áttettük" outcomes of last week's moves | — |
| 3 | **Milyen lesz a jövő hét?** | Next week's load vs capacity, lighter week if any, Boop's proposals one by one | approve / skip each (same calls as Átrendezés) |
| 4 | **Mit eszel jövő héten?** | Menu status in one line (ready / not generated / approved) | „Megnézem a menüt" → Étel › Hét menu page; returning continues the flow |
| 5 | **Kész** | One sentence: what to watch this week (from the proposals accepted + the plan) | „Kész" |

- **When:** available from Sunday 18:00 (the existing K4 Sunday preview time) until Monday 23:59. Announced by a Ma-wall
  card and a local notification at 18:00 (local, like the bedtime reminder; one per week; respects the existing
  notification settings). Tapping either opens page 1.
- **Done state:** stored per week on the phone (and, if the builder finds it cheap, on the server so the Hét tab knows on
  another device; optional). After done: Hét hero shows the takeaway; the wall card goes.
- Pages with nothing to show are skipped (e.g. no proposals → page 3 says the week looks fine in one sentence, no list).

### 4.4 Étel room (step 2)

The weekly menu and shopping list move from Évad to Étel. The builder decides placement after looking at the room:
expected — inside the **Hét** tab (menu for next week + the list as a sub-page), or a new tab if Hét gets crowded (the
same "no crowded page" rule applies). The Ma-wall menu card and the review's page 4 open it there.

**Which recipes the menu may use** (owner decision 2026-11-27, #137): marked **on the recipe itself**. Étel › Receptek:
every recipe card and recipe page carries a „Menübe jöhet" toggle (writes the season's allowed-recipe set — same server
data as today's Évad › Menü › Kiválasztott receptek, `season_allowed_recipe`); the tab gets a filter chip „Menübe jöhet"
showing only the marked ones. The menu page shows one row „N recept a menüben" → Receptek with that filter on. The
separate selection list (`EvadRecipesPage`) goes. Sensitivity conflicts keep today's rule (shown, not selectable).
Without a season the toggle is hidden (no set to write). The rules (Szabályok) stay in Évad › Terv.

### 4.5 Nap room (step 1)

Tabs: **Ma** (today's page: morning summary, timeline, wall — what the centre opened) · **Napok** (last 14 days, today's
Napló place). Day pages unchanged.

## 5. UX/UI bar (the *Kész, ha…* list draws from this)

- Every page: hero + one "what you see" sentence + ≤5 cards; anything more goes one level deeper.
- Custom glyph per Évad tab (4), per Sunday-review page (5), for the Nap room's Napok tab, for the floating „+"
  unchanged. Drawn in the Napkelte glyph family; no SF Symbols, no emoji, never "Mezo" in visible text.
- Dynamic Type up to the largest sizes, VoiceOver labels on every new control (the orb reads its number and meaning,
  the year strip and day dots read as words), smallest iPhone width, reduced motion (the ring zoom has its still variant).
- Cached content shows instantly; offline: Most/Hét/Terv show the cached overview with its age, actions say „Ehhez
  internet kell."; the review needs net for page 3 actions only.
- No pull-to-refresh (owner rule `.191`); the head's Frissítés action reloads.

## 6. Parity — nothing that exists today may disappear

| Today | Goes to |
|---|---|
| Mi mire hat | Terv › Mi mire hat page |
| Súly block (curve) | Terv › A cél (+ Súly room) |
| Az évad terve | Terv |
| Hogy megy | Most (this week) + review page 1 (last week) |
| Teher és pihenés, Mennyit bírsz | Hét |
| Boop-javaslat (lighter week) | Hét |
| A jövő heted → Átrendezés | Hét + review page 3 |
| Amit a mozgatásokból tanultam, Amit Boop észrevett | Hét › Amit Boop tanult + review page 2 |
| Következik | Terv › Az évad hetei (+ Most › Ami jön) |
| Módosítás, Új évad, Szabályok | Terv |
| Menü, Lista (+ receptek, korábbi listák, tételek) | Étel |
| Hatás (+ kísérlet result, Új kísérlet) | Kísérlet |
| Ma place (ring) | Home |
| Napló place | Nap › Napok |
| Boop place | Centre orb |
| Five quick doors | Removed (all are in „+") |
| Ma-wall Évad cards (`evadWallOpens`: modositas / menu / hatas / kiserlet:) | Re-pointed: Terv+Módosítás / Étel menu / Kísérlet / Kísérlet result |

## 7. Codebase terrain (investigator, 2026-11-27)

- **Ring:** `ios/Boop/Kezdolap/Area.swift:9` (`enum Area`, 9 cases), `ringItem` `:96`; `NKOrbRing`
  (`BoopDesign/Napkelte/OrbRing.swift:41`) lays out any count; `KezdolapView.swift:206` orb size per width, `:288` orb
  tap → `.room(world)`, `:307` DEBUG `-previewHome`.
- **Rooms:** `Boop/Nap/NapView.swift:71–90` drill switch on `Hue`; `Boop/Nap/AreaRoom.swift:30–85` exhaustive switches
  (`areaTabs`, `areaName`, `areaGlyph`); `Hue` `BoopDesign/Napkelte/Tokens.swift:67` (rawValue-indexed `name` array —
  add the case to every array). Template: the Súly room slice (`2026-11-24-boop-suly-orb-gyorsajtok-design.md`,
  `Boop/Suly/SulyRoom.swift:9`). Bar glyphs: `NKAreaBar.glyph` (`BoopDesign/.../Area.swift:362`) — a new tab name falls
  back to `chart-deep`, so add one case per tab.
- **Spine to remove:** `Boop/Shell/ShellView.swift:6` (`ShellTab`, `storageKey`, `defaultHue`, panorama by rawValue,
  `shellPanels` from `allCases`, `:333` `EvadPage()`), `BoopDesign/.../SpineBar.swift` (positional `glyphs`), DEBUG
  `-previewTab`/`-previewSwitch`, `@SceneStorage("tab")` (unknown keys already map to Ma).
- **`openPlace` callers:** `Boop/Nap/MaWall.swift:237` (Évad wall cards via `EvadStore.pendingSub`,
  `BoopCore/Evad/EvadWall.swift:92`), `Boop/Edzes/EdzesRoom.swift:188` (`onOpenSeason`), `Boop/Suly/SulyRoom.swift:48`
  (`openEvad`), plus Boop/Napló/„+" routes — replace with an "open room" hook (`RitmusRouter.openRoom(hue)`,
  `ShellView.handle(.area(hue))`).
- **Évad today:** `Boop/Evad/EvadPage.swift` (`EvadSub` covers at page level), `EvadOverviewTab.swift`,
  `EvadTeher.swift`, `EvadMenuTab/ListTab/EffectTab.swift`, `EvadSystemMap.swift`; data `BoopCore/Evad/EvadWire.swift`
  (`EvadOverview.head/pillars/weight/map/adherence/insights/upcoming`), `EvadClient.swift`; capacity
  `BoopCore/Kapacitas/KapacitasWire.swift:68`; Átrendezés `Boop/Kapacitas/AtrendezesPage.swift`.
- **Orb number source:** `EvadAdherence` (foodInBand/foodJudged, sessionsDone/Planned, nightsOk/Judged) — no combined
  helper yet; add a pure BoopCore function. Today's adherence endpoint is "the last week"; Most needs **this week so
  far** — `EvadClient.adherence(from,to)` already takes a range (Étel's Hét tab uses it).
- **Year plan:** `Boop/EdzesTerv/EvesTerv/` (YearStrip, Terkep), opened from `EdzesRoom.swift:388`.
- **Stores** are created in `RootView.swift` and injected, so any room can read `EvadStore` / `KapacitasStore`.
- **Traps:** a new `Hue` breaks exhaustive switches (good) and rawValue arrays (crash — add to all); `.forma` must not
  identify the Évad room; the spine removal touches every 4-place array; `EvadPreview.swift` + `BoopTests` reference
  Évad/Shell types; sheets/covers stay page-level (boop-ios.md §9); no `async let` fans; regenerate CODEMAP after every
  merge.

## 8. Prior art (researcher, 2026-11-27 — thin sweep, snippets only)

- **Adopted — MacroFactor weekly check-in** (https://help.macrofactorapp.com/en/articles/247-introduction-to-check-ins-and-coaching-modules):
  plan changes happen in one short guided weekly flow, each step explaining why, with a fast path and a safe decline →
  our Heti átnézés (skippable, „Később" changes nothing).
- **Adopted — TrainerRoad phase strip** (https://support.trainerroad.com/hc/en-us/articles/115005942646-Base-Build-Specialty-Overview):
  "you are here" on a strip of phases, auto-inserted easy weeks shown with a reason → Terv's year strip + Az évad hetei.
- **Adopted — one hero number per plan, detail by drill-down** (synthesis) → orb = Most hero, the same number.
- **Considered — Apple HIG tab bars** (https://developer.apple.com/design/human-interface-guidelines/tab-bars): the HIG
  expects one primary tab bar per app. Our rooms already use a floating in-room bar (`NKAreaBar`) and the home loses its
  bar entirely, so there is exactly one bar on screen at any time — consistent with the rule's intent.
- Gaps: WHOOP / Oura / Runna layouts were not covered.

## 9. Build order

1. **Step 1 — home:** barless ring with 10 orbs (Évad orb present, opening today's Évad page as a room until step 2),
   centre → Boop chat, Nap room (Ma + Napok), floating „+", quick doors removed, every `openPlace` re-pointed.
2. **Step 2 — Évad room:** the four tabs, the Sunday review, menu + list into Étel, wall-card re-routes, new glyphs.

Each step: its own gates, merge, install on the phone, live check. One simulator spike covering both steps comes first
(owner gate 2), on a throwaway branch.

## 10. Left to the builder

- Exact copy of sentences (Hungarian business language, no jargon); the hero sentence templates for Most.
- Glyph drawings (in the spike, for owner OK).
- Whether „+" hides over sheets; the Étel placement of menu/list (§4.4); whether the review's done state is also stored
  on the server.
- Whether the Évad orb's adherence % weighs the three parts equally (default: equal weight over the parts that have
  something to judge; a part with nothing to judge is left out; nothing at all → „–").

## 11. Builder check (2026-11-27) — answers and calls

A fresh reviewer read this spec as the builder. Its questions, settled (all **my calls** unless marked):

1. **Per-day data for Most.** Answered by the code: `EvadClient.adherence(from:to:)` returns `EvadAdherenceResponse`
   with per-day `EvadAdherenceDay` (judged, excused + excuse, kcal/target, foodInBand, sessions planned/done…). One call
   for Monday→yesterday feeds the bars, the day dots and the breakdown page. No backend change.
2. **Nap room structure.** The Nap room is a normal ring room (`NKAreaPage`, bar **Ma · Napok · Boop**; Boop in the bar
   like every room opens the chat). The Ma tab keeps today's page content (summary, timeline, wall) under the room head.
   The **home** keeps a slim title row: „boop" + the account avatar (Fiók lap unchanged).
3. **Step 1 is a real release** (merged, installed, live-checked). Until step 2 the Évad orb opens today's Évad page
   inside a plain room frame (its own back button, its inner tabs and Szabályok unchanged). Temporary glue is accepted
   and removed in step 2.
4. **Notification + done state.** Scheduled weekly as a local notification for Sunday 18:00 device time while a season
   exists; cancelled when the review is done that week or the season ends; re-armed on each app foreground. The window
   (Sunday 18:00 – Monday 23:59) uses the device's time zone. Done state lives on the phone only; a second device may
   show it as pending — accepted (one phone today).
5. **Review page 3.** Uses exactly the Átrendezés store calls and offline rules (`KapacitasStore`, next Monday); the
   proposals view is extracted from `AtrendezesPage` into a shared component, not duplicated. If proposals are not
   generated yet, the page shows the loading state and then „Jól néz ki a jövő hét" when there are none.
6. **Year strip data.** Évad reads the year plan through the existing Éves terv client (a small read + cache in a store
   injected at `RootView` if none exists). If the season spans block boundaries the bracket simply covers both segments;
   no year plan → only the season is drawn.
7. **Deep links, widgets, notifications.** External URL formats stay unchanged; old place names map to rooms
   (Ma → home, Napló → Nap › Napok, Boop → chat, Évad/terv → Évad room). Installed widgets keep working.
8. **Évad colour.** A new `Hue` case keeping the evening-violet sky, with an orb tint distinct from Forma; **the owner
   approves the colour in the spike** (visible).
