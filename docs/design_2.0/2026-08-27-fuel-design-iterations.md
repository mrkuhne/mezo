# Fuel design iterations — Daniel's direction log (2026-08-27)

The fuel-tab prototype went through an iteration loop with Daniel after the first hub ship.
This file records **what changed, why, and what it means for implementation** — the prototype
(`prototypes/fuel-tab.html`, artifact `e0da58f6…`) is the visual truth, this is the rationale.
Read together with [`2026-08-27-fuel-feature-audit.md`](2026-08-27-fuel-feature-audit.md)
(ground truth of the real code) and `prototypes/README.md` (current final state).

## 1. Hub v2 — window swimlane (replaces MOST-card + done capsule)

Daniel: *"legyen a logoláshoz vezető út is egy csempe, a kész dropdownt engedjük el; kapjon
swimlane csempét minden egyes ablak."*

- Every **user-scheduled eating window** is its own tile in a horizontally scrolling lane
  (scroll-snap, auto-scrolls to the MOST tile).
- Tile states: **done** (sage wash, KÉSZ ✓, meal name, AI-score chip — fresh log =
  `✨ folyamatban`), **now** (coral ring, MOST stamp, plan meal, Logold CTA), **missed**
  (dashed amber, "még pótolható", Pótold — never punitive), **future** (plan suggestion,
  ghost Logold). Lane ends with the out-of-window log tile.
- New clay sprite icons for the windows: `i-reggeli` (egg), `i-ebed` (steaming bowl),
  `i-snack` (apple), `i-vacsora` (pot) — in `assets/clay-icons.svg`.
- Iteration 2: **kcal mini-tile + three mini macro rings** on every tile (P coral · C amber ·
  F lavender; ring fill = the meal's share of the **daily** target, echoing the hero rings).

## 2. Hub v3 — declutter

Daniel: *"nem kell az eddig x/y kalória, csak amennyit elfogyasztott; a Mezo message menjen
egy csempe mögé; Étkezési ablakok felirat és a Ma · 1/5 eyebrow nem kell."*

- Hero = **one number: the kcal consumed today** (`420 kcal ma`). No eyebrow, no
  `eddig x / y` line — the frame is told by the Alap / Mozgás / Cél chips. Day-bar + 5 rings
  stay; the water ring stays a button.
- The **companion voice left the hero**: a `mezotile` banner ("Mezo · 2 új Fuel-üzenet ma")
  opens the new **Mezo · Fuel page** — fuel-context messages with time + context eyebrows
  (ebéd-ablak / reggeli után / napzárás előtt). The hub shows only the counter, never
  repeats the voice.
- The swimlane carries no header.

## 3. Receptek v2 — spacious, alive cards

Daniel: *"pimpeljük fel, szebbek és teresebb kártyák"*, then *"nem kell a /adag kiírás,
a ringek helyett kis színes csempék egy sorban, a kcal is kapjon lighty színt."*

- Tall image band (66 px) with the category's clay meal icon on a **halo disc**, slot chip +
  role tag + ★ + fit badge (`✨ Mezo` while unscored).
- Body: name, meta (hozzávaló · perc · NOVA dot 1 sage / 2–3 amber / 4 terracotta), then a
  row of **four tinted macro mini-tiles** (`.mcells`): kcal sage-light · fehérje coral ·
  szénh. amber · zsír lavender. No `/adag` label, no rings here.
- **Live footer** surfacing the never-shown contract fields (`timesLogged`, `avgScore`,
  `lastLogged` — audit gap #7): `18× logolva · ✨ 91 p átlag · utoljára tegnap`; unlogged
  recipes honestly say `még nem logoltad`.

## 4. Stack v2 — the Edzés-subpage recipe

Daniel: *"nagyon puritán, sok a görgetés, nincs benne élet."*

- **Stat strip**: bevéve · következő · e heti adherencia · 📌 kézi.
- **Day-arc timeline** (06:45 → 23:00): zone dots placed by time — done sage ✓, the next
  zone a **pulsing gold ring**, gold MA marker, staggered time labels (no overlaps).
- **Featured KÖVETKEZŐ card** (gold ring): the next zone with a big tick, kind-colored dot,
  and the Mezo "miért ide" line — **the `mezoNote`/`windowTip` fields surfaced** (audit gap
  #4: populated in code, unreachable in the UI today).
- Remaining zones in a **2-column mini-mosaic** (done = sage wash) — scrolling cut to ~⅓.
- Every tick live-updates hero, stat strip, timeline, and the hub tile; all-done → quiet
  "szép ritmus" card. Meal-match ✓/⚠ card kept.

## 5. Kamra v2 + item detail

Daniel: *"azt is csináld meg"* + *"mi van ha rákattintasz egy kamra itemre."*

- List: stat strip; **kind-washed rail cards** (food sage / supplement sky / stim amber /
  med lavender) with monogram discs, brand + NOVA dot or italic protocol line, tinted
  kcal-per-100g / dose cell. ✨ Mezo suggestion card (NOVA-swap tip) + Legutóbbi importok
  rows (OFF/FOTÓ source tags, amber `ellenőrzés`) — both real hidden-when-empty surfaces.
- **Item detail page** (second-level): monogram header, source badge + brand + category +
  NOVA; food → macro mini-tiles + nutrient cells `/100 g` with honest `—` dashes; supp/stim →
  dose cell + italic protocol + **"💊 a stackben · {zóna} {idő}" cross-link chip**; price
  row; **"Receptekben" chips** (surfacing `usedInRecipes` — audit gap #5); `＋ Logolás`
  bridges into the log flow as a KAMRA line (100 g — out-of-window semantics: consumed
  moves, no window flips); **two-tap Törlés** that live-updates hero + stats + list.

## 6. Napló v2 — week-centric

Daniel: *"tároljunk a hetekhez: napi kcal, makrók, súly, AI átlag — ezt kell szépen
megmutatni."*

- Week-picker segments (Aug 3–9 … E hét); the hero number follows the selected week's
  AI average.
- **Daily kcal bars** with a dashed gold `CÉL 2 250` line; **today = gold "in progress"
  bar**, future days = dashed empty slots (honest); protein-day counter in the card head.
- **Per-day macro-average mini-tiles** (same `.mcells` language).
- Two cards: **Súly · heti átlag** and **AI-átlag**, each with a vs-previous-week delta
  (sage, never red).
- Implementation note: the weekly API already returns the 7-day series
  (`GET /api/fuel/week/{start}`); the FE currently collapses it to 3 scalars (audit gap
  #28) — plus this page needs weight (from the weight log) and a stored weekly AI average.

## 7. Unified logging flow — **IA change, flagged for implementation**

Daniel: *"csináljuk meg a logolási flowt teljesen… most külön van logolás meg AI logolás,
én ezt bevinném a logoláson belülre — kamra, recept, AI; képet + szöveget + kamra itemet
kombinálva. Mindenhol minden szám legyen szerkeszthető."*

- **One full-page flow** (`page-log`) replaces the LogMealSheet + AiLogSheet pair:
  - slot segments (defaulting to the launching window's `slotKey` — the mezo-bnsf fix
    pattern), derived-until-touched name;
  - three colorful **source tiles**: 🫙 Kamra (gold — grams; multi-add picker sheet that
    stays open, added rows get ✓), 🥄 Recept (coral — servings; closes on pick),
    ✨ AI (lavender inline panel: textarea **and/or** photo, `Elemzés` enabled when either
    present);
  - AI-recognized lines land as **BECSLÉS-tagged items next to the manual lines** — one meal
    can mix photo + text + pantry items + a recipe;
  - every line amount is a **typeable input** with ± steppers (recept: 1 adag steps; other:
    10 g/ml steps; invalid/≤0 input keeps the previous value — the AmountField guard);
    per-line macros and the totals card (4 tinted mini-cells + `eddig +étkezés = új / cél`
    two-segment bar) recompute live;
  - `✓ Logolás · +10 XP` → the window tile flips to done (`✨ folyamatban` score), hero /
    day-bar / rings update; out-of-window and Kamra-detail launches only move `consumed`.
- **For implementation this is a real IA change**: today the app has two separate sheets and
  the AI draft confirm path goes down the normal `POST /api/meal` anyway — the merge is
  mostly FE surface work; the `MealRequest` contract already supports mixed
  `recipe|pantry|estimate` lines in one meal (see audit §4, `provenance.origin` may need a
  `mixed`/per-line rethink).

## Cumulative designed-additions list (per-page flags live in the handoff)

1. Napló trend page (weekly 7-day series + weight + AI average per week).
2. Snack segment on Receptek; Gyógyszer segment on Kamra.
3. Terv rhythm-grid markers derived from settings (not hardcoded 21:00/14:00).
4. Recipe-card live footer (timesLogged/avgScore/lastLogged).
5. Stack: mezoNote surfaced on the featured next-zone card.
6. Kamra detail: usedInRecipes chips + stack cross-link.
7. **Unified logging flow** (LogMealSheet + AiLogSheet merge) with combinable sources and
   editable amounts everywhere.
8. Future add-medication path (none exists today).

## Still open on the Fuel tab

Terv and Gyógyszer pages are still at sketch depth; the recipe detail/editor, the
finomhangolás (ingredient overrides) block, MealScoreSheet/ScoreBreakdown, Import
(OFF/link/fotó), StackItem/StackPicker sheets, FuelSlots editor and EnergyBreakdownSheet
have not had their deep rounds yet.
