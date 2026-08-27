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

## Cumulative designed additions (implementation flags)

1. Mezo tab as a first-class tab (the Insights section promoted); Én as the fifth tab;
   floating quick-log FAB replaces the center-FAB tab bar (**IA change**).
2. Chat refs with human labels instead of raw ids (real-app gap #7 fix).
3. Hungarian status chips on Előrejelzések/Kísérletek (◐ Folyamatban / ✓ Bevált / ◇ Javaslat).
4. Hub decision card synced with the Minták page (single-decision spotlight).
5. Quick-log context head (MOST window) + in-place water logging.
6. Memória: human cron times instead of raw cron strings.
7. Én hub goal card with ETA cell; tile pass as the standing visual recipe.

## Still open

Mezo: chat detail rounds (conversation rename/delete UX, retry on error bubble), Memoár
archive. Én: GoalPlanner wizard, RoutineEditor, AI-call detail page, PeopleDetail/PersonLog
sheets, SleepLog/SleepGoal sheets at full depth, TitleShop/Streak sheets. Global: Napzárás,
Edzés review page, Fuel Terv/Gyógyszer deep rounds, then the consolidated spec + implementation
plan for mezo-88jw.
