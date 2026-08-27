# Én / Me tab — feature audit (2026-08-27)

Ground-truth inventory for the Én-tab redesign (bd mezo-88jw). Companion docs:
`docs/features/me.md`, `growth.md`, `goal-engine.md`, `journal.md`, `habit.md`,
`_platform-notifications.md`.

## 1. IA map

Routes (`frontend/src/app/router.tsx:150-171`), all inside `MeSection` (AppHero + SubNavDropdown)
unless marked full-screen sibling:

| Path | Component |
|---|---|
| `/me` | `ProfilePage` |
| `/me/growth` | `GrowthPage` |
| `/me/naplo` | `JournalPage` |
| `/me/goals` | `GoalsPage` |
| `/me/weight` | `WeightPage` |
| `/me/sleep` | `SleepPage` |
| `/me/people` | `PeoplePage` |
| `/me/knowledge` | `KnowledgePage` |
| `/me/ertesitesek` | `NotificationsPage` |
| `/me/goals/new` | `GoalPlannerPage` — **full-screen sibling** |
| `/me/routines/edit` | `RoutineEditorPage` — full-screen |
| `/me/sleep/night` | `NightPage` — full-screen, tab bar + float layer hidden |
| `/me/ai-usage`, `/me/ai-usage/:id` | `AiUsagePage`, `AiCallDetailPage` — full-screen |

`ME_TABS` labels (`pages/tabs.ts:8-18`): **Profil · Growth · Napló · Cél · Súly · Alvás ·
Emberek · Tudás · Értesítés**. The dropdown carries an extra ⚙️ `Beállítások` action →
`SettingsSheet` (theme only: Világos / Sötét / Cirkadián with the −90p dimming copy).

AppHero ↔ Me: avatar+XP ring & name → `/me`; level badge & ⚡ quest counter → `/me/growth`;
🔥 streak → StreakSheet (0.45 opacity when broken); 🪙 → TitleShopSheet.

Sheets: SettingsSheet, BiometricSheet (Profil + GoalGate), EnergyBreakdownSheet (Fuel-owned,
from the TDEE block), WeightLogSheet, SleepLogSheet (3 entry points: SleepPage, TodayPage:535,
QuickInput), SleepGoalSheet, SleepStatsSheet, EditGoalSheet, AttachPlanSheet, JournalSheet
(3 modes: Napló/Döntés/Hála; QuickInput too), DecisionReviewSheet, PersonLogSheet,
PersonDetailSheet, Habit/Chain/AiSuggest sheets (RoutineEditor), TitleShopSheet, StreakSheet.
`GoalGate` = full-screen overlay (not a Sheet): "Előbb: a biometriád", missing chips
`⚠ hiányzik: nem|magasság|szül.dátum`, CTA `Biometria beállítása →`, `egyszeri beállítás · ~20 mp`;
auto-continues once complete.

## 2. Per-screen inventory (exact HU copy)

### Profil `/me` (ProfilePage, 5 children in order)
1. **MeBioRow** — `·`-joined non-null bits: `{age} év · {cm} cm · {kg} kg · {bf}%`; **null at zero bits**.
2. **GoalMiniCard** → `/me/goals`: `🎯 {TRAJECTORY_LABEL} · {title}` + `{p}% · {kg} kg hátra`
   or literal **`tartás`** when total=0; track with `{start} / {current} most / {target} cél`
   (hidden at total=0). **Null while pending or no goal.**
3. **BiometricCard** — empty: wash-lav CTA `Állítsd be a biometriád` / `Ebből számol a motor —
   nem · magasság · szül. dátum`; filled: `Biometria` + `szerkesztés ›`, grid Nem/Magasság/Kor/
   Testzsír(`—`)/Aktivitás; TDEE block (button → EnergyBreakdownSheet): `Alaphő · NEAT`,
   `Betábl. mozgás +{n}`, `Fenntartó · {Katch|MSJ} ⓘ ≈{n} kcal/nap`. Activity bands: Ülő 1.2 /
   Vegyes 1.35 / Fizikai 1.5.
4. **GrowthSummaryCard** → `/me/growth` — ghost at totalXp=0: `Az élet is edzés.` + first-activity
   copy; filled: `🌱 Growth` + `{totalXp} XP · {n} hét sorozat`, top-3 skill bars `Lv {n}`, footer
   `Atléta-szint {n|–} · Fegyelem {n}%|– · Megtakarítás (30 nap) {ft} Ft` (savings only when >0).
5. **AiUsageCard** → `/me/ai-usage`: 3 cols Ma/Ez a hét/Ez a hónap `{n} hívás` + cost;
   footnote `~ becslés — a modellárak tájékoztató jellegűek`. Skeleton in real mode only.

### Growth `/me/growth`
Hero trio: `Össz XP` (FE sum of cumulativeXp) / `Fegyelem {n}%|–` / `Ritmus {n} hét`.
Segments `Skillek / Rutin / Napló / Kitüntetések`.
- Skillek: `Ma` eyebrow + Today's DailyQuestsCard + ActivityLogCard; 3 SkillBandCards —
  LIFE `8 skill · {xp} XP` (+Megtakarítás footer), Atlétikus `12 skill · átlag {lvl|–}`,
  Izom `13 izom · legjobb Lv {n}`; rows sorted (level desc, xp desc), bar = progressPct.
  **Chip counts 8/12/13 hardcoded** (gap).
- Rutin: DayNavigator (max ma) + `✏️ Szerkesztés` → /me/routines/edit; 30-day counters
  `🌅 Tökéletes reggelek` / `🌙 Tökéletes esték` `{n} / 30 nap`; chain cards ◦/✓/— rows +
  strength `{n}%|—`; past day summary `Reggel {d}/{n} · Este {d}/{n}` `+{xp} XP`.
- Napló: 30-day GrowthJournalCard, chip `{n} ✓ · {n} — · {n} ✎`; empty `Még nincs bejegyzés —
  a teljesített küldetések és tevékenységek itt gyűlnek.`; day rows quest `küldetés · {slot}`
  (+`— tevékenységgel teljesült` / `· csendben lejárt`), activity `tevékenység · {name}` or
  `· besorolatlan` (+`· {n} Ft`).
- Kitüntetések: BadgesCard `{done} / {n} megszerezve`, 3-col grid (achieved sage ✓, else bar
  `{cur} / {target}`); PerksCard `Perkek — mérföldkövek`, empty: `Még nincs feloldott perk —
  a skill-mérföldkövek (Lv 5, 10, 15…) hozzák őket.`

### Napló `/me/naplo`
`＋ Új bejegyzés`; GratitudeStreakCard `Hálanapló` — `{n} napos sorozat · {n} bejegyzés` or
`Még nincs hálabejegyzés — írd le az első hálás gondolatod.` (null while pending);
Döntések block (only when open decisions): chip **`Nézd vissza`** (amber) when due, else
`Visszanézés: {day}`; notes month-grouped (`hu-HU` long month separators), footer
`Korábbi hónapok` (window +3 months). Loading = skeletons; error ≠ empty
(`Nem sikerült betölteni a naplót.` vs `Még nincs bejegyzés — kezdd a + gombbal.`).
JournalSheet: create-mode chips Napló/Döntés/Hála; decision note `Elmentjük, mit tudott rólad
a rendszer ebben a pillanatban…`; GratitudeRows (max 3, `+ Még egy`, 8 LIFE-area chips,
280 char/row); edit adds two-step `Törlés` → `Biztosan törlöd?`.
DecisionReviewSheet: `Hogyan sült el?` + 1–5 rating + optional `Mi lett belőle?`.

### Cél `/me/goals`
Guards: pending → skeleton; no goal → GhostState `Még nincs aktív célod — hozz létre egyet, és
a Mezo köré szervezi a terveket.` + `＋ Új cél` (→ GoalGate if biometrics incomplete).
Hero (tap → EditGoalSheet): `{Fogyás|Hízás|Maintenance} · aktív`, title, `{start} → {target}`
dates, guard chips `Erő-gard` / `Izom-gard`, `Most {kg} kg / Cél {kg} kg`, track (hidden at
totalRange=0), stats **Hátra** {kg} / **Tempó** {kg/hét}, identity quote.
Timeline: week ruler, Gym lane (meso bars `{title} · {n} hét`, ✕ detach, gap chips
`⚠ W{a}–{b} fedezetlen`), Futás lane (`nincs futás` empty), Röplabda ambient `BVSC · végig`
(hardcoded — gap). GoalRecept: null → `Még nincs recept — futtasd a motort…` + `⚡ Értékeld a
célt`; filled → verdict banner `Reális` / `Reális, figyelmeztetésekkel` / `Agresszív` + notes,
segments `{label} W{a}–{b}`: `{kcal} kcal napi cél · {g} g fehérje · {h} h alvás · {±kg}/hét
várt tempó` + rationale; guard pills `Erő · e1RM {±}%`, `Izom · ≥{n} szett/izom`, muted
`Fehérje: Fuel-re vár`. GoalPlanSlots: dashed `Mesociklus` (gym · az ablakra kalibrálva) +
`Futóblokk` (opcionális · mozog a mesóval), each `＋ Tervezd ▸` / `＋ Csatolj meglévőt`.
EditGoalSheet: read-only rows (Típus **hardcoded "Fogyás · cut"** — gap), Archiválás, two-step
Törlés. GoalPlannerPage wizard: 2 steps `Mit építünk?` / `Mennyi időnk van?`; trajectory cards
Fogyás/Hízás/Szinten tartás + guard picks; step 2 fields + FeasibilityPanel
(`{pct} %BW / hét`, `✓ Reális` / `✓ Reális · figyelővel` / `⚠ Agresszív`, `↦ Reális dátum:
{date} — Elfogadom`); CTAs `✓ Cél létrehozása + aktiválás` / `Mentés tervezettként`.

### Súly `/me/weight`
h1 **Napi súly**. WeightHero: caption `Induláshoz képest`, 56px `{±}kg|—`, `{start} → {latest}
· cél {target} kg`, pill `✓ {pct}% a célig`, stats `Jelenleg|—` / `7-nap/hét` (colored via
isImprovement) / `ETA {n}h|—`, caption `4-hét tempó {±} kg/hét`, CTA `＋ Súly naplózása`.
Trend: chips `7d 30d 90d 1y`; chart <2 points → `Kevés mérés ehhez az ablakhoz`; else SVG:
tolerance band (±1 kg) + dashed plan line + raw line (0.4) + MA(3) line + last dot; legend
`tényleges / terv / tűréssáv`. Heti előzmény `{n} / {n} hét`: WeeklyWeightCard (range label,
delta pill, `{avg} kg átlag · {n} bejegyzés · min {low}`, sparkline, `H K Sz Cs P Sz V` +
`↓ lefelé / ↑ felfelé / → stabil`, expanded day rows), pager `Régebbi hetek` (step 6).
WeightLogSheet: `Súly log · reggel` / `Mi a számunk ma?`, 56px value + chips `−0.1 −0.5 +0.5
+0.1`, note (200 char), hardcoded 3-branch tip (nagy nap / vízsúly / stabil), date always today.

### Alvás `/me/sleep`
Always: goal card `Alvás-cél` + `szerkeszt` (🛏️ {bed} ← rail `{h} ó cél` → ☀️ {wake}, footer
`„a rendszeresség a király"` + `±{n}p`); night entry link `🌙 Éjszakai mód — Eszközök éjszakai
ébredéshez — 20 perces szabály, légzés, 4K-séta.`; ScoreRings `Rendszeresség` (lav, `14 nap ·
±{n}p`) + `Hatékonyság` (sage ≥85 else warning, `cél ≥ 85%`); education: SleepEscalationCard
(`Az alvásod jelez`, non-punitive, `Részletek`/`Most nem`) REPLACES SleepStatCard (`Miért
számít?` + daily STAT_DECK card, idx = YYYYMMDD % 7).
Log-dependent: hero `Tegnap éjjel` 48px `{h}h`, `{bed} → {wake}`, `Quality {q}/10`,
`Ébredés {n} × éjjel`, `{±n}p vs. cél lefekvés`, `hatékonyság {n}%`; Fázisok (+`screenshotból`)
PhaseRail (Mély/Könnyű/REM/Éber; widths on inBed, %s on asleep) + PhaseReferenceRows `Mély
{n}% — a sávban · ref 13–23%` / REM ref 20–25%; `Az éjszaka íve` NightArcCard (hypnogram
silhouette, half-night rails, front-load sentence at ≥4 deep buckets, footnote "a fázist
kódolja, nem mért mélységet"); PhaseAverageCard (≥3 nights) `Átlagos összetétel · {n}
éjszakából`; Trend chips 7d/14d + phase-stacked SleepChart + quality line; RemDurationCard
(≥3 nights per side, `Ha rövidebb az éjszaka`, 7ó marker); `Napló · utolsó 7 éjszaka` rows
(low nights warm-tinted). No data → `Még nincs alvásadat.`
SleepLogSheet: Kézi/Screenshot modes, quality 1-10 grid, `Ébredések éjjel 0 1 2 3 4+`,
night-trace hint `🌙 Az éjjel {n}× jártál az éjszakai módban — előtöltöttem.`, shot-only
PhaseRail + `Sleep Cycle minőség: {n}%` + Dátum + needsReview warning, 4-branch hardcoded tip.
SleepGoalSheet: stepper 240..720×15, anchor `☀️ Ébredés` / `🛏️ Lefekvés` + time input +
derived `Lefekvés ebből: {t}`.

### Éjszakai mód `/me/sleep/night` — literal-dark, NO clocks/countdowns ever
idle: `Felébredtél?` / `Ne nézd meg az órát — nem számít, mennyi az idő.` / CTA `Ébren vagyok`;
waiting: `Én figyelem az időt`, breathing orb, `Maradj az ágyban, lazíts.`, tools `🫁 Légzés`
(be 5 · tartsd 6 · ki 7) / `🧘 Testpásztázás` / `🚶 4K-séta`, quiet `elalszom · kilépek`;
getup (after 20 min watchdog): `Kelj fel — ez most a jobb út` + 3 steps + `Visszafeküdtem`.

### Emberek `/me/people`
h1 **Kapcsolatok**, action `🎤 Log`. `Aktív kör · {n}` + `tap → részletek`; PersonCard (affect-
ringed initial, `{n}× · hét`, relationship, last mention, affect sparkline + `{n} mention`).
`Mit naplóztam · friss` + chips Mind/Hét/Jelölt; MentionRows (time gutter, source icon,
`FIGYELEM` badge when flagged, excerpt, `kapcsolódik` chip). PersonDetailSheet: stats
**Affect/Cadence/Mentions (English — gap)**, `Amit Mezo tud`, `Kapcsolt patternek`, mentions,
`🎤 Log most`. PersonLogSheet: big mic **decorative** (does nothing — recorded decision),
`vagy gyors chip`: Ki? chips, `Hogy érzed` Jó/OK/Vegyes/Nehéz, note, ✓ Mentés.

### Tudás `/me/knowledge`
h1 **Tudásgráf**. Summary band: `Élő mindmap · növekvő`, `{n} tudás · {n} kapcsolat`,
`{n} aktív a prompt kontextusban · {n} stabilizált vagy archiv`, link `Tények kezelése →
Tudástár`. Profil node card (`Rólad tanultam`, Archivál + a heti-összegzés footnote). Grouped
nodes: Minták / Preferenciák / Célok / Életesemények / Szezonok / Belátások; node card =
title + summary + ≤3 backend-rendered HU edge lines + Archivál. No fact list (mezo-0ap9).
**Real mode: edges always [] → `0 kapcsolat` live (gap).**

### Értesítés `/me/ertesitesek`
Install gate REPLACES the whole screen when !supported/!standalone (`📲 iOS: a push csak akkor
jön meg, ha a mezo a kezdőképernyőn van…`). Else: NotificationPreviewHeader (dark card,
`Napi terhelés {n} / nap`, 24-bar hourly sparkline, `⚠ Sűrű ablak — {a} és {b} között {n}
értesítés esne`); master `Push értesítések` + Toggle (+3 error copies); test send card;
3 sections: `Mezo megszólal` (prose) / `Az agy eseményei` + `Eseményvezérelt — nem szerepel a
napi terhelés előnézetben.` (brain) / `Emlékeztetők` (reminder). 22 categories
(types.ts:1407-1500); derived sub-lines (briefing `{wake} · ébredési horgony`, gym `ma {time} ·
{label}`, medication `{weekdayHu} · D{cycleDay}`…); lead chip `−{n} perc` gym-only.

### AI-napló `/me/ai-usage` (+ detail)
Segments Ma / Ez a hét / Ez a hónap; hero `{n} hívás` + becsült költség + `{n} sikeres · {n}
hiba · {n} megszakadt` (+ `{n} hívás árazatlan…`); feature bars (tappable filter), model bars;
filters incl. Típus ▾ (8 kinds); call rows (tone rail, model, usage, latency, cost `—`,
`HIBA · {class} · {code}` / `MEGSZAKADT · a kliens lecsatlakozott…`); window 50→500 then
`Az ablak betelt (500 hívás)…`. Detail: stat grid (Kért/Kiszolgált modell, Válaszidő,
Tool-körök, Hívó te/háttérfolyamat, Lezárás oka), token bar (net prompt/válasz/gondolkodás/
cache-elt), `Befagyasztott ártábla`, payload blocks + retention notice.

### Rutin szerkesztő `/me/routines/edit`
`Rutinok szerkesztése`, `＋ Új rutin`; per chain Toggle + edit + `＋ Új habit`; ChainEditSheet
(dayparts Reggel/Napközben/Este, `Az alap rutinok nem törölhetők.`), HabitEditSheet (Cím, Miért,
Horgony-szöveg, XP, Típus), AiSuggestSheet (`Szándék (opcionális)`).

## 3. Data model & seeds (key numbers)

- Goal seed: `Fogyás · Nyári forma`, 81.4 → 78.6 → 73.0 kg, 0.6 %/hét ↓, window 2026-04-01 →
  08-15, guards strength+muscle; tdeeBootstrap {bmr 1720, NEAT 1.2, 2064 + 602 = TDEE 2666,
  MSJ}; prescription formula, 2 segments (W1–12 `Mély deficit` 2150/163 g/7,5 h/−0,55;
  W13–20 `Lassú befutó · taper` 2380/155/8/−0,35); feasibility `feasible-with-warnings`.
  **biometricProfile bootstrap disagrees: TDEE 3000 Katch (gap).**
- Weight: 15 entries 04-22 (81.4) → 05-22 (78.6); trends last7d avg 78.96 / −0.5, last4w −0.7.
  Derivations: TOLERANCE 1.0 kg, MA(3), ETA=(target−latest)/rate, isImprovement(bulk?Δ>0:Δ<0),
  weekly ISO-Monday buckets, planTrajectory linear.
- Sleep: 14 nights, 8 screenshot w/ phases, 6 hypnograms; last: 00:42→09:03, 7.5 h, q9,
  deep 100/light 206/REM 144/awake 52, SC 95%. Regularity: ±band circular vs goal, 14-day
  window anchored to latest log; efficiency = asleep/inBed ×100 target ≥85. Phase refs: Mély
  13–23%, REM 20–25%. Goal 450 min / wake 06:45 / band 15 (ghost 480/06:00).
- Progression: athleteLevel 4.3, streak 5 hét, 8 LIFE + 12 athletic + 13 muscle skills,
  disciplinePct 78, savings 50 000 Ft; gamification: Lv 12, 3140 XP, 60/520 in-level, 240 🪙,
  streak 6, title `fegyelmezett`; curve xpToNext = 80+40(n−1). Badges 5/9 + 3 perks.
- LLM usage: Ma 12/$0.04 · hét 78/$0.31 · hónap 305/$1.22; formatRollupCost 2 decimals +
  `<$0.01` guard vs per-call 4 decimals; `—` for null.
- People: 5 persons (Petra 84 mention…), 10 mentions, 2 flagged.
- Journal: 5 notes, 3 decisions (1 due), 6 gratitude entries / 4-day streak (yesterday-grace).
- Notifications: 22 categories; anchors MIDDAY 12:30, EVENING 20:30, MEMOIR Sun 19:00,
  MEDICATION 08:00; dense window 15 min; brain categories not forecastable (null).
- Night: watchdog 20 min / 15 s tick; trace `mezo-night-wake:<date>` localStorage, ≥18:00 →
  tomorrow, keep 3 days; body scan 10×40 s; walk 3×90 s cards.

## 4. Write paths (→ §4 of the full agent report; essentials)

POST /api/biometrics/weight (invalidates weightLog/weightTrend/habitDay/dailyQuests/
companionFeed; mock + WEIGHT gamification event) · POST /api/biometrics/sleep (same pattern) ·
POST /api/sleep/screenshot (stateless draft) · PUT /api/sleep/goal · PUT /api/biometrics/profile
(invalidates + goals) · POST /api/goals (+/activate, /archive, DELETE, /plans attach/detach,
/evaluate, /feasibility-preview debounce 400 ms) · journal CRUD + decision/review + gratitude
batch (Promise.all) · POST /api/people/{id}/mentions · POST /api/companion/graph/node/{id}/
archive · push subscription + PUT /api/notification/pref · gamification title buy/equip +
saver · habit catalog. Reads: weight(+trend), sleep(+goal), profile, goals(+timeline),
progression(+achievements), quest/activity history, journal/decision/gratitude, people,
graph nodes, llm-usage ×4, notification prefs, gamification profile.

## 5. Cross-links

In: AppHero avatar/name → /me, level/⚡ → /me/growth (all tabs); Today evening → night mode;
quest CTAs → /me/weight, /me/sleep; QuickInput → Súly, Alvás (SleepLogSheet), Napló/Hála
(JournalSheet). Out: TDEE block → Fuel EnergyBreakdownSheet; GoalPlanSlots → /train/mesocycles/
new + run create-then-navigate; AttachPlanSheet reads train+running plans; Tudás → /insights/
knowledge; Growth Rutin → routine editor; GratitudeRows shared with ritual act 3.

## 6. Honest-state rules

`—`/`–` never 0 (WeightHero, Testzsír, Fegyelem, ScoreRing, AI cost); `<$0.01` ≠ `$0.00`;
null-returning cards (MeBioRow, GoalMiniCard, GratitudeStreakCard); `tartás` at totalRange=0
(hero + mini agree); sleep phase cards gate independently INCLUDING their eyebrows (≥3 nights,
≥4 deep buckets, ≥3/side); loading ≠ empty ≠ error everywhere; real mode never shows mock seed
(ZERO_TRENDS, ghosts, 404 = "not set up"); non-punitive tone (`a sáv alatt` locational never
red, `csendben lejárt`, escalation card guilt-free, CBT-I stats confined to sheet); never
invent a time (gym/medication sub-lines fall back, brain = `Eseményvezérelt…`); a control that
cannot work is not offered (install gate replaces screen) but recoverable-dead stays visible
disabled; provenance labelled (`screenshotból`, `~ becslés`, `Befagyasztott ártábla`,
hypnogram footnote, `Fehérje: Fuel-re vár`); derive-never-store (gratitude streak, badges,
regularity, weekly buckets, night trace localStorage-only); two-step destructive confirms;
NightPage: absolute ban on clocks/countdowns.

## 7. Latent gaps (designed-addition candidates)

1. `WeightTrendResponse.ewmaSeries` + `dataSufficiency` fetched, dropped — chart draws its own
   MA(3); sufficiency would drive the "Kevés mérés" state honestly.
2. Prescription `restDays[]` + `dailyEnergyBalanceKcal` seeded, never rendered.
3. `EditGoalSheet` Típus hardcoded `"Fogyás · cut"`; `GoalTimeline` volleyball `BVSC · végig`
   hardcoded; SkillBandCard chip counts 8/12/13 hardcoded.
4. `ProgressionProfileResponse.radarAxes`/`highlights` — zero consumers (radars retired).
5. PersonDetailSheet stat labels English (Affect/Cadence/Mentions); PersonLogSheet mic
   decorative; no person create/edit UI.
6. Knowledge edges always [] in real mode → `0 kapcsolat` live.
7. Weight: no past-date logging; Sleep manual mode: no date field.
8. `SleepShotDraft.confidence` unused (only needsReview); `mealToSleep` stub always 0.
9. Two different mock TDEEs on one tab (2666 vs 3000).
10. Tip cards (weight/sleep) hardcoded prose referencing systems that don't feed them.
11. MeBioRow `%` bit lacks a "testzsír" qualifier; `useProfile()` static (`user.name` has no
    backend column); mock logWeight synthesizes entry without id.
12. TitleShopSheet dead `!canMutate` branch; types.ts:1404 says "11 categories", there are 22.

## 8. Dual-mode differences

Mock: goal always present (empty state + skeleton unreachable), biometrics complete (GoalGate
never fires), goal writes no-op, creation returns null and navigates, progression/gamification
seeded w/ local award toasts (level-up > streak > saver > XP), knowledge edges seeded,
LLM usage static (no loading frame), sleep screenshot always perfect-confidence draft,
feasibility always feasible (Agresszív branch MSW/real-only). Real: 404 → ghosts everywhere,
GoalGate live, EWMA-fed trends, real push, `edges: []`.
