# Mezo + Én tab design iterations — Daniel's direction log (2026-08-27)

The Mezo and Én tabs went through iteration loops with Daniel after their first ships. This
file records **what changed, why, and what it means for implementation** — the prototypes
(`prototypes/mezo-tab.html`, artifact `797270dd…`; `prototypes/en-tab.html`, artifact
`dee0dd7e…`) are the visual truth, this is the rationale. Read together with
[`2026-08-27-mezo-feature-audit.md`](2026-08-27-mezo-feature-audit.md) and
[`2026-08-27-en-feature-audit.md`](2026-08-27-en-feature-audit.md) (ground truth of the real
code) and `prototypes/README.md` (current final state).

## 1. Mezo tab v2 — the tile pass (applies to EVERY page)

Daniel: *"Minták, de ez mindegyik oldalra igaz. Építsük őket élőbbre, mozgóbbra, színesebbre
és menjünk csempékkel Huawei irányba a listás megoldások helyett."*

Every list-row pattern on the Mezo subpages became washed tiles with clay icons, rise
staggers and animated bars/dots:

- **Minták**: colorful 3×2 lifecycle cells (döntésre vár = white + gold ring, pulsing;
  megfigyelés lav; megerősítve sage; még gyűlik amber; a többi muted) — the confirmed
  patterns moved into a **2-column tile mosaic** (sage wash + domain clay icon + confidence
  chip in human words), watching = lavender tiles with an animated evidence bar, gathering =
  dashed amber tiles; Adat-egészség = a coverage-ring tile strip.
- **Heti**: the trend rows became **metric tiles** (domain wash + icon + arrow + animated
  bar; protein days as a dot row; weight trend on a wide tile with a `terv szerint` chip);
  Growth rows → tinted `.mcells` mini-cells.
- **Tudástár**: fact rows → **category-washed fact tiles** (edzés coral · egészség amber ·
  élet sky, clay icon disc + toggle; disabled facts fade to a dashed tile).
- **Előrejelzések / Kísérletek**: status-washed tiles — folyamatban lavender + animated
  confidence bar, bevált/megerősítve sage, aktív amber + 7-day dot row.
- **Memória**: per-layer colored L0→L3 cards (sand/gold/coral/lav) with clay icons; the
  audit provenance rows → tinted mini-cells.
- This is now the **standing recipe for all future pages** — the Én tab was built tile-first
  from the start because of this round.

## 2. IA decision B — the fifth tab and the floating FAB

Daniel raised: *"az appnak most van még egy oldala, az Én oldal… kéne egy ötödik menüpont, de
akkor nem lehet szépen felosztani a gyors logolással. vagy a gyors logolást tegyük fel a
headerbe…?"* Three mockup options were built (`prototypes/en-ia-valasztas.html`, artifact
`418b2a2d…`): A avatar=Én, B five tabs + floating log FAB, C five tabs + header log.

**Decision: B.** The tab bar is five first-class tabs — **Nap · Edzés · Fuel · Mezo · Én** —
and quick-log lives on a **floating coral FAB bottom-right**, present on every screen in the
thumb zone. Rolled out to all prototypes (the center-FAB tab bar is retired). Rationale: Én's
content (cél, súly, alvás, growth) is daily-used and deserves first-class visibility; the
header top corner is the worst one-handed zone for the most frequent action.

## 3. Én tab first ship

Daniel: *"kezdd el kérlek kidolgozni nekem az Én page-t ugyanúgy, mint ahogy csináltad a Mezo
oldalt."* Built audit-first (`2026-08-27-en-feature-audit.md`), tile-first per §1:

- **Hub**: identity hero (avatar with in-level XP ring, equipped title chip, Lv · XP · 🔥 ·
  🪙, bio line that vanishes when empty), coral-ringed goal card (animated track +
  Hátra/Tempó/ETA cells; maintain → `tartás`, track hidden — real contract), 8 tiles +
  settings band.
- **Subpages**: Cél (prescription segment tiles + guard pills + timeline with ⚠ fedezetlen),
  Súly (MA + terv + tűréssáv chart, weekly tiles, cascading log sheet), Alvás (bed rail,
  ring tiles, never-red phase reference rows, stacked night columns, dark night-mode tile),
  Éjszakai mód (clock-ban state machine), Growth (4 segments), Napló (inline 1–5 decision
  review), Emberek, Tudás (live Archivál), Értesítés (24h load spark recomputing on toggles),
  AI-napló (segments + status-rail call tiles). Honest-state contracts preserved throughout.

## 4. Quick log v1 → v2

Daniel: *"mehet a quick log kidolgozása"*, then: *"a checkinnél hiányzik a szöveges része meg
az, hogy mind a négy státuszt checkineld amit mérünk. naplónál nézzük meg a UI-t arra is ha
kiválasztod bármelyiket a három közül."*

The floating FAB opens the quick-log sheet (wired live in en-tab; the same sheet goes behind
every tab's FAB). Audited against the real `QuickInputSheet` (title `Gyors logolás` /
`bármikor, két koppintás`; 8 tiles + highlighted chat row; Alvás/Napló/Check-in swap
in-place; the rest navigate).

- **Context head (MOST)** — designed addition: the sheet knows the time; at 13:30 the
  Ebéd-ablak is the spotlight (coral ring, plan meal, Logold), echoing the Fuel swimlane.
- **Víz** logs in place: ＋250/＋400/＋500 chips, live HU-grouped counter + toast.
- **Check-in = the full Heartbeat flow** (v2, after Daniel's correction): the duo tile shows
  the four measured dimensions as mini-cells (morning reading faded; after save `délután ✓` +
  fresh values); tapping opens the real stepped measurement — **Energia (coral) · Stressz
  (amber) · Testi (rose) · Mentális tisztaság (sky)** on 1–10 scales with the real sublines
  and low/high anchors (Üres→Tele…), auto-advance + Kihagy; then the 2×2 tap-back summary
  grid, the optional 200-char sentence (real placeholder), and **Mezo's reactive azonnali
  olvasat** card driven by the entered values with the real rule set (e8+m8 → PR-window good;
  e≤4+s≥6 / body≤4 / s≥8 → warn variants; else neutral).
- **Napló: all three branches with their own in-place UIs** (v2): Aktivitás — textarea +
  "Az AI besorolja…" → ambiguous-skill picker grid quoting the entry → done card `+15 XP` +
  quest-completed line; Napló — textarea + working mic transcript + Dátum row; Hála — 1–3
  growable rows with the real placeholders + `＋ Még egy`, saving bumps the streak and
  cascades to the hub tile + page hero.
- Alvás honestly reads `ma ✓ 7,5 h` and refuses to re-log; Súly opens the weight sheet in
  place; Étkezés/Edzés/Stack navigate with live context sublines; the Mezo row at the bottom
  keeps chat as a logging path.

## 5. Heti áttekintés — the round after the real feature shipped

On 2026-08-27 the real weekly review merged (`feat/weekly-review`, bd `mezo-p2tr`, PR #270, v2.52.0):
`/me/week` with a deterministic day/week score, an LLM weekly narrative, a deterministic "discoveries"
digest, and anchored week/day conversations. Daniel: *"bemente egy új commit, a Heti új verziója…
tervezzük meg ennek is az új UI részét… gazdagon jelenítsünk meg infokat, ez itt egy nagyon fontos
része az appnak. ha kell tervezz hozzá olyat is, amihez kell backend módosítás, hogy még többet
kihozzunk a heti reflexióból. az AI score-n kívül ez a heti elemzés új mintákat és tudásokat kéne hogy
hozzon a userről, gyarapítania kéne a tudást az appnak, a memóriát."*

Audited first (`2026-08-27-heti-feature-audit.md`), then built as the Én tab's **Heti** subpage (9th hub
tile) per the §1 tile recipe. What the round changed relative to the shipped UI:

- **Hero** — the spec originally asked for a score ring and shipped a flat 56px number; the redesign
  restores it as an *animated* ring (0 → score spin-up, band colours 80+ sage · 70+ gold · below
  terracotta — never red) plus a delta pill and an **8-week score trend** with the viewed week ringed.
  `tanulom` honesty preserved.
- **Eight stat cells** instead of six — `avgCheckinEnergy` and `latestWeightKg` are returned by
  `/api/me/week` and were simply not rendered.
- **Day columns** — band-coloured, `—` stub for tanulom days, MA marker, tappable (scrolls to the day
  tile and opens it), and a date-derived axis (the shipped chart hardcodes `Sz` for both Szerda and
  Szombat and is `aria-hidden` with no interaction).
- **Day tiles** — the flat `Alvás 82 · Táplálkozás 75 · …` string became **four colored subscore rings**
  under a `miből jött össze` eyebrow (the spec asked for this breakdown); kcal now shows against its
  target too (`kcalTarget` was fetched and unused); the Mezo day note moved into a **companion bubble
  with the orb** — in the shipped page it is an unmarked `<p>` indistinguishable from a data row.
- **Review card** — the `highlights[]` payload finally renders as `amire épült` **anchor chips**
  (Minta · Tudás · Életesemény · Emlék). This was the audit's largest dead payload: the generator's whole
  bounds-checked index-selection machinery exists to produce it and no component ever showed it.
  `generatedAt` is now visible as well.
- **Honest states split** — the shipped page uses ONE ghost string ("Hétfő reggel érkezik…") for three
  different situations, including a months-old week whose LLM call failed, with no retry surface. The
  redesign splits them: running week → the ghost plus `4 / 7 nap logolva`; finished week without a review
  → **`✦ Készítsd el most`** with a live spinner (the `POST …/regenerate` endpoint already does exactly
  this — 409 only guards an in-progress week); and week switching shows a **skeleton**, since today the
  page has neither a loading nor an error state (a failed fetch renders a blank body).
- **Discoveries** → tile mosaic with the status information the API already returns and the UI dropped:
  pattern `event` (✓ Megerősítve · ▲ Erősödött · ★ Előléptetve), life-event dates, prediction outcomes
  (◐ Folyamatban · ✓ Bevált · ✗ Nem jött be).

### Round 2 — the Heti becomes a tile hub

Daniel: *"picit sok a scroll szerintem, legyen itt is pár csempe… ez a rész maradhat de utána legyen
heti elemzés csempe, ahol bent van a napi pontszám és heti elemzés kártya… legyen egy csempe a hét
tanulságaival. legyen egy csempe ami a hét napjaihoz vezet ahol meg tudod őket nézni egyesével. és
legyen egy heti felfedezések, ahol van minden ami alul volt."*

The hero + the eight stat cells stay; everything below became **four view tiles**, each with its own
subpage. Hub scroll height dropped from 1651 px to 525 px (roughly one screen).

| Csempe | Preview on the hub | Subpage |
|---|---|---|
| **1 · Heti elemzés** (wide, lav ring) | orb, the review's first sentence, the week's mini score bars, the generation stamp / `hétfőn jön` / `nincs még` | Napi pontszám card + the full review card with the anchor chips + a hand-off band to the lessons |
| **2 · A hét tanulságai** | open-candidate count, `dönts róluk — bekerülnek a Tudástárba` | the candidates with evidence lines and Tanuld meg / Nem rólam szól |
| **3 · A hét napjai** | `5 / 7 nap` + seven mini score rings | a 2-column day mosaic (round 3) whose tiles open a dedicated day page (round 4) |
| **4 · Heti felfedezések** | `5 új nyom a memóriában` + category dots | the discovery mosaic with the status chips |

Two things Daniel's list did not name explicitly, kept on the hub bottom: the **`Mezo · a következő
heted`** band (running week only, per the real gating) and the honesty footnote. Every cascade crosses
the boundary: accepting a lesson re-renders the tile, the analysis page's hand-off band, the hub Tudás
tile and the graph count; generating a missing review refreshes all four tiles at once. Tapping a day
column in the analysis page opens the days page and expands that day.

### Round 3 — the days stop being a list

Daniel: *"még a hét napjait pimpeljük picit, most túl listás."* The seven rows became a **2-column
mosaic**: each day is a tile washed by its score band (80+ sage · 70+ gold · below terracotta), carrying
the big score, the four subscores as **animated sparks** (alvás sky · fuel sage · check-in rose ·
aktivitás coral) and clay-icon data chips (kcal · alvás · edzés · check-in n/4 · a `jegyzet` chip when
Mezo wrote about that day). A summary row of mini-cells sits above: *legjobb nap · leggyengébb ·
tanulom*. The repeated `nyisd ki ›` label was replaced by a single chevron in each tile's header.

The round also split a state the shipped UI conflates: **`tanulom`** (fewer than two domains have data,
so no score) versus **`nincs adat`** (nothing was logged that day) — the latter on a dashed tile with
`ezen a napon nem logoltál — a hét pontszámába nem számít bele`. Future days are dashed, dimmed and
carry `még előtted — ide majd a nap adatai jönnek`.

### Round 4 — one day, one page

The mosaic's first drill-down grew the tapped tile to full width. Daniel: *"most viszont fura hogy ha
jobb oldali csempét nyitom meg akkor szétesik… lehet itt az kéne, hogy saját oldalra visszük át a
usert, teljes oldalra arra az adott napra."* Correct — a right-column tile going full-width leaves a
hole in the grid and shifts everything below it.

So a tapped day now opens a **dedicated day page**: hero with the day's score ring (band-coloured) and
the data chips, `Miből jött össze` with the four subscore rings, `Fuel · a cél ellenében` with the three
target bars, alvás · edzés · súly · XP cells, the Mezo note on an **orb card** with feedback and
`Beszélgess a napról`, and at the bottom **‹ előző nap / következő nap ›** tiles carrying the
neighbours' day-of-week and score — so the week is walkable day by day without going back to the
mosaic. Tapping a column on the analysis page now lands straight on that day's page (the mosaic stays
underneath, so Back walks out mosaic → Heti). The mosaic itself never reflows.

Honest states got their own page treatment: a `tanulom` day says *"Kettőnél kevesebb területről van
adat, ezért a Mezo nem ad pontszámot: kitalálni nem fog"*, a `nincs adat` day says the day does not
count toward the weekly score, a future day gets its own empty page, and a day the review skipped says
so (*"a Mezo csak azokhoz a napokhoz ír, ahol volt mit mondani"*) rather than showing nothing.

### The knowledge loop — backend-flagged additions

Daniel's core ask ("gyarapítania kéne a tudást") has no implementation today: the weekly pipeline is
**strictly read-only** with respect to the companion's knowledge stores. Four designed additions:

1. **A · `A hét tanulságai`** *(designed in the prototype)* — the generator's JSON gains
   `candidateFacts[]`: facts derived from the week's *cross-day* correlations, each with an evidence line.
   They are reviewed in place (`Tanuld meg` / `Nem rólam szól`) and routed through the **existing**
   candidate-fact flow, so the "code-collected, model-selected" discipline holds — a raw model-invented
   fact never lands in the store. Accepting cascades into the hub Tudás tile and the graph count.
2. **B · Highlight feedback** — the model already names which pattern/fact/life-event mattered this week;
   feed that back into pattern confidence and fact salience. The data is persisted and currently wasted.
3. **C · Persisted weekly score series** — the score is recomputed on every read and never stored, so
   `prevWeekScore` is the only longitudinal signal (and it costs a second full `DayScoreService` pass).
   Storing it on the review row unlocks the 8-week trend and sentences like "three weeks ago was your
   best week".
4. **D · Richer generator input** — journal entries/decisions, experiments, people mentions, the
   medication cycle and `period_summary(week)` (which the spec listed as an input, then cut) are all
   readable from the proactive slice and none reach the weekly prompt today.

## Cumulative designed additions (implementation flags)

1. Mezo tab as a first-class tab (the Insights section promoted); Én as the fifth tab;
   floating quick-log FAB replaces the center-FAB tab bar (**IA change**).
2. Chat refs with human labels instead of raw ids (real-app gap #7 fix).
3. Hungarian status chips on Előrejelzések/Kísérletek (◐ Folyamatban / ✓ Bevált / ◇ Javaslat).
4. Hub decision card synced with the Minták page (single-decision spotlight).
5. Quick-log context head (MOST window) + in-place water logging.
6. Memória: human cron times instead of raw cron strings.
7. Én hub goal card with ETA cell; tile pass as the standing visual recipe.
8. Heti as a **tile hub** (hero + 8 cells + 4 view tiles → own subpages): animated score ring +
   8-week trend, 8 stat cells, date-derived tappable day columns,
   subscore rings + kcal-vs-target on the day tiles, the Mezo day note as an attributed bubble,
   **the review anchor chips** (dead payload today), the three honest states split apart with
   `✦ Készítsd el most`, skeleton on week switch, and status chips on every discovery
   (**IA change:** Heti is the Én tab's 9th tile, matching the real `/me/week` move).
9. **Backend-flagged (Heti):** A candidate facts from the weekly generator through the existing
   Tudástár review flow · B highlight feedback into pattern confidence / fact salience ·
   C persisted weekly score series · D richer generator input (journal/decisions, experiments,
   people mentions, medication cycle, `period_summary(week)`).

## Still open

Mezo: chat detail rounds (conversation rename/delete UX, retry on error bubble), Memoár
archive. Én: GoalPlanner wizard, RoutineEditor, AI-call detail page, PeopleDetail/PersonLog
sheets, SleepLog/SleepGoal sheets at full depth, TitleShop/Streak sheets. Global: Napzárás,
Edzés review page, Fuel Terv/Gyógyszer deep rounds, then the consolidated spec + implementation
plan for mezo-88jw.
