# Napi értékelés újratervezés — design spec

**Dátum:** 2026-09-03 · **Státusz:** user által jóváhagyott design, spec-review előtt
**Prototípus (jóváhagyott):** https://claude.ai/code/artifact/c9aada04-9149-429e-ad16-b0a0fc8d3be2

## Probléma

Három bejelentett hiba + egy termék-igény:

1. **„Fura kcal/makró számítás"** — a meal-score „Kcal & makró arány" dimenziójában a kcal
   egyáltalán nem számít bele a pontba (csak P/C/F arány-eltérés; a `kcalShare` display-only),
   ezért egy pici, fura arányú snack aránytalanul rossz pontot kap. A napi score-ban
   (`DayScoreService.fuel`) fordítva: kcal+fehérje 50/50, szénhidrát/zsír ignorálva.
2. **Progress bar hiba** — a FE (`ScoreLedger`) 1-re összegződő súlyokat feltételez, de a
   backend a degraded („Nincs adat") dimenzióknál nem renormalizál, így a Σ sor és a
   fejléc-pontszám széttart.
3. **Hiányzó szöveges AI-indoklás** — a per-dimenzió próza-fészkek (`MealBreakdownJson`
   `MacroDetail.notes`, dim-szintű prose) léteznek, de üresek; coach-kikapcsolt állapotban
   semmilyen szöveg nem jelenik meg.
4. **Igény:** sokkal gazdagabb napi értékelés (napi célok, edzés, alvás, logolási idő stb.),
   score-breakdown elemenként 1-2 mondatos magyarázattal, és részletes AI-narratíva.

## Döntések (a brainstormban rögzítve)

| # | Döntés | Tartalom |
|---|--------|----------|
| D1 | **C-hibrid, „átlátszó” változat** | Determinisztikus motor számolja a sub-score-okat és ad ki tényleapet; az LLM a tényekre ír narratívát + per-dimenzió 1-2 mondatot, ÉS opcionális, **korlátos korrekciót**: `{delta: ±0..5, reason}`, backend-clampelve. A korrekció SOHA nem olvad bele láthatatlanul: külön „Mezo-kontextus +N" chip + saját indoklás-sor. LLM-hiba/kikapcsolt állapotban a determinisztikus pont önmagában teljes értékű. |
| D2 | **6 pontozott dimenzió + kontextus-jelek** | Lásd „Dimenziók” lent. Közérzet (check-in energia) és súlytrend (EWMA) tudatosan NEM pontozott — csak LLM-kontextus. Lépésszám nincs (nincs adat). |
| D3 | **A+ életciklus — fokozatos kirajzolódás** | Nincs arányosított napközbeni cél és nincs élő összpontszám. A dimenziók egyenként véglegesednek (alvás reggel, edzés a workout zárásakor, logolás sávonként, táp/minőség/ritmus napzáráskor); a kész dimenzió pontot mutat, a nyitott nyers tényeket. Összpontszám + LLM-narratíva csak a nap zárultával, lustán, cache-elve (meal-coach minta), adatváltozásra invalidálva. |
| D4 | **Kétszintű score, tisztázott szemantikával** | A meal-score = „ennek az ételnek a minősége" (összetétel, NOVA, időzítés-illeszkedés); a napi score = az egyetlen adherencia-ítélet. A napi táp/minőség dimenzió a meal-adatokból aggregál — egy matek, két nézet. A meal-oldal javítást kap, nem újraírást. |
| D5 | **UI = Mozaik 2.0, a meglévő nap-oldal bővítése** | Nincs új képernyő: a `/me/week/napok/:date` (`WeekDayPage`) nő tovább a jóváhagyott prototípus szerint. A meal-breakdown a fuel oldalon épül át wash-csempés formára. CLAUDE.md „Design direction” szabály érvényes. |

## Dimenziók és súlyok

Minden súly config-tunable (`mezo.companion.day-score.*` mintára), induló értékek:

| Dimenzió | Súly | Forrás | Pontozás magja |
|----------|------|--------|----------------|
| **Tápanyag** | 30% | meal-aggregátum + goal-engine napi előírás (`FuelDayService` resolved targets) | Aszimmetrikus toleranciasávok: sávon belül teljes pont, kívül simított (lineáris/smoothstep) lecsengés. Aszimmetria: fehérje-hiány > fehérje-többlet; kcal-többlet (cut) > kcal-hiány. Edzésnapi módosító: kcal/CH sáv tágítása (`WorkoutWindowQueryService` alapján). |
| **Étel-minőség** | 15% | meal-score-ok NOVA + mikro komponensei | Napi NOVA-megoszlás (kcal-súlyozott) + mikro-lefedettség, a meal-szintű számokból aggregálva — nem külön matek. |
| **Edzés** | 20% | `feature/train` workout_session + terv | Tervezett vs. teljesített (gyakorlat/szett-szinten); **pihenőnap semleges** (nem büntet, a dimenzió aznap degraded-ként kimarad a súly-renormalizálással); friss terhelés kontextus. |
| **Alvás** | 15% | `sleep_log` + `sleep_goal` | Időtartam/cél arány (Whoop-minta) + logolt 1-10 minőség blend. |
| **Logolás** | 10% | `MealEntity.loggedAt`, slot-ablakok, water_log, check_in | Pozitív folyamat-pont (MacroFactor-lecke): étkezések a saját sávjukban logolva, víz logolva, check-inek. A rossz napok logolása is jutalom. |
| **Ritmus** | 10% | 7 napos gördülő adherencia | Oura „balance” minta: a hét trendje; egy kilengés jó hét után nem tragédia. |

**Honesty-szabályok** (meglévő minta): kevés adat ⇒ dimenzió degraded („Nincs adat"), súlya
renormalizálódik; túl kevés dimenzió ⇒ nincs összpontszám („tanulom"). Kitalált semleges
érték soha.

**Sáv-címkék** (mz-sc guardrail, sosem piros): ≥80 sage · 60–79 arany · <60 terrakotta.

## Architektúra

### Backend

- **`feature/companion` — `DayScoreService` újraírása** a fenti 6 dimenzióra.
  Adatolvasás a meglévő `MetricSeriesService` façade bővítésével (nem új per-day query-k).
  A táp/minőség dimenzió a meal-score envelope-okból aggregál.
- **Napzárás-trigger + cache:** az értékelés (pont + LLM-próza) a lezárt napra lustán, első
  megnyitáskor generálódik és cache-elődik (a meal-coach `writeProse`/self-invalidating
  mintája day-szinten); visszamenőleges adat-szerkesztés invalidál és újragenerál.
- **LLM-hívás:** consumer-owned port (ADR 0012): a companion deklarál
  `DayReviewLlm`-szerű portot; EGY olcsó-tier hívás adja: narratíva (2-3 bekezdés,
  kereszt-kontextus), per-dimenzió 1-2 mondat, highlight-chipek, `{delta, reason}`.
  Strukturált kimenet, backend-oldali clamp (±5) és séma-validálás; hibánál cache/semmi,
  soha 5xx (meal-coach minta). `LlmCallContext` tagging + feature switch + SwitchOff IT.
  A prompt kontextusa: tényleap + nem pontozott jelek (energia, súlytrend) + 7 napos
  minták (pl. fehérje-rés napszaka, rövid alvás ↔ nassolás korreláció).
- **Meal-score javítások** (`feature/nutrition` `MealScoringService`):
  1. `macroDim`: a kcal ténylegesen számítson (kcal-eltérés komponens a slot-célhoz képest,
     kis étkezésnél arányos súllyal), P/C/F arány mellett;
  2. `toJson` renormalizálja a súlyokat degraded dimenziónál (a recipe-path
     `renormalized(weightSum)` mintája);
  3. per-dimenzió próza-fészkek kitöltése a meglévő meal-coach hívás bővítésével;
  4. `improve` mező vizualizálható formára („− ½ tejföl → +6 pont" — pont-delta becsléssel).
  Figyelem: `MealScoringProperties` súly-összeg startup-validáció; régi meal-ek envelope-ja
  a régi matekon marad (re-score út külön döntés, lásd Nyitott kérdések).

### Contract

- `api/feature/me-week/me-week.yml`: a nap-objektum bővül — 6 dimenzió
  (érték/degraded/súly/tények/próza), `base` + `aiAdjustment {delta, reason}` + narratíva +
  highlight-chipek + nem pontozott kontextus-jelek + per-dimenzió „kész/folyamatban" státusz.
- `api/feature/meal/meal.yml`: dim-szintű prose mezők élesítése (már léteznek), improve
  pont-delta. Contract-drift gate: yml + regenerált `api.gen.ts` egy change-ben.

### Frontend

- **`WeekDayPage` bővítés** (Mozaik 2.0, a prototípus szerint): hero dayring +
  „alap N · Mezo-kontextus +N" chipek; lila revcard (orb, 3 bekezdés, highlight-chipek,
  +N indoklás-sor, chat-handoff); 6 sub-ring; dimenziónként wash-csempe (clay ikon,
  súly-eyebrow, sring, tény-chipek/gbar-ok, 2-3 mondat); kontextus ghost-csempe; mcells;
  daynav. „Ma" nézet: szaggatott gyűrű „este zárom", kész dimenziók teljes csempén,
  nyitottak ghost-csempén nyers tényekkel.
- **Meal-breakdown átépítés** (fuel): a `ScoreLedger` súlyozott sáv-sora helyett
  dimenziónkénti wash-csempék saját grafikával (makró gbar-ok, NOVA-szalag legendával,
  időzítés-idővonal, rost/cukor iker-gyűrű), Mezo-kártya javító-chipekkel, mikro
  ghost-csempe („nem számít bele"), Σ-csempe (súlyok = 100%).
- `WeekScoreBars`/`WeekDayCard` sub-jelzései a 6 új dimenzióra állnak át.

### Hibakezelés

- LLM ki/hiba: determinisztikus pont + determinisztikus tény-mondatok jelennek meg
  (a „miért" sorok degradálódnak tény-szintre), narratíva-hely csendben elmarad.
- Kevés adat: degraded dimenzió-csempe „Nincs adat" + renormalizált súlyok; <2 dimenzió ⇒
  „tanulom" hero.
- Éjfél utáni logolás: a nap zárása az alvás-log beérkezéséhez vagy fix cutoffhoz kötve
  (implementációs terv részletezi; a cache-invalidálás kezeli a késői adatot).

### Tesztelés

- `DayScoreService` új matek: pure unit tesztek (sávok, aszimmetria, edzésnap-módosító,
  renormalizálás, honesty-küszöbök).
- LLM-út: SwitchOff IT + clamp/séma-validálás tesztek.
- Meal-score fix: `MealScoringServiceTest` bővítés (kcal-komponens, renormalizált toJson).
- FE: mindkét mód (mock + real), mock-adat a 3 állapotra (lezárt/ma/tanulom).
- Fókuszált IT-k lokálban, teljes kapu CI-ben; ArchUnit + codemap-regen ugyanabban a change-ben.

## Prior art

A researcher jelentéséből átvett / elvetett minták:

- **Oura Readiness** (https://support.ouraring.com/hc/en-us/articles/360057791533) —
  ÁTVÉVE a prezentációs csontváz: nevesített hozzájárulók, per-komponens sáv + verbális
  besorolás + 1-2 mondat, felül összesített narratíva; „balance” (rövid vs. hosszú táv)
  → Ritmus dimenzió. Cold start: abszolút célok, míg nincs elég történet.
- **Whoop Recovery** (https://support.whoop.com/s/article/WHOOP-Recovery) — ÁTVÉVE a
  sáv + „mit tegyél ma" narratíva-forma és az alvás „teljesített/szükséges" arány-formula.
- **Garmin Training Readiness** — ÁTVÉVE az edzés-dimenzió alakja: terv vs. tény + friss
  terhelés a megszokotthoz képest, pihenőnap nem büntet (nem „edzettél-e" boolean).
- **RP Diet Coach** (https://help.rpstrength.com/hc/en-us/articles/1500012013581) —
  ÁTVÉVE a toleranciasáv-gondolat, ELVETVE a bináris formája: simított, aszimmetrikus
  lecsengést használunk.
- **MacroFactor adherence-neutral** (https://macrofactor.com/adherence-neutral/) —
  design-figyelmeztetésként beépítve: a logolás saját pozitív dimenzió, ítélkezésmentes
  szövegezés, egy nap sosem nullázódik ki rossz makrók miatt, „sosem piros" sávok.

## Codebase terrain

Az investigator jelentéséből (kulcsfájlok):

- Meal-score matek + hibák: `backend/.../nutrition/service/MealScoringService.java`
  (`macroDim` :261–296 — kcal nem számít; `toJson` :140–142 — nincs renormalizálás,
  szemben a recipe-path :212–215-tel); tunables:
  `nutrition/config/MealScoringProperties.java` + `application.yml` `mezo.fuel.scoring.*`
  (súly-összeg startup-validáció!).
- Napi score ma: `companion/service/DayScoreService.java` (:126 sleep, :142 fuel-cliff,
  :164 checkin, :174 activity; <2 ⇒ null); series-façade: `MetricSeriesService`.
- LLM-minta: `meal/service/MealCoachService.java` (1 olcsó hívás, cache a breakdown
  jsonb-ben, self-invalidating, switch-gated, sosem 5xx); envelope:
  `nutrition/entity/MealBreakdownJson.java` (üres próza-fészkek).
- Contract: `api/feature/meal/meal.yml` :184–271, `api/feature/me-week/me-week.yml`.
- FE: `features/fuel/components/ScoreLedger.tsx` :15–21 (bar-bug),
  `ScoreBreakdownBody.tsx` :24, `sheets/MealScoreSheet.tsx`, `DimensionCard.tsx`;
  nap-oldal: `features/me/pages/WeekDayPage.tsx` (`/me/week/napok/:date`, Mozaik 2.0),
  `logic/weekDay.ts`, `scoreBand.ts`, `components/week/*`.
- Adat-elérhetőség: napi makró-cél ✅ (FuelDayService), workout ✅, sleep ✅, loggedAt ✅,
  NOVA ✅, víz ✅, súly-EWMA ✅, check-in ✅; lépésszám ❌.
- Csapdák: súly-validáció boot-failure; contract-drift gate; CODEMAP-regen + ArchUnit;
  VITE_USE_MOCK; Testcontainers; régi meal-ek régi envelope-on; két score-koncepció
  szemantikai szétválasztása (D4 kezeli).
- Staleness: `MealScoringService` súly-kommentek elavultak a confighoz képest;
  `docs/features/fuel.md` header a prózáról részben elavult — az implementáció frissíti.

## Nyitott kérdések (implementációs tervre hagyva)

1. **Re-score út a régi meal-ekre**: a kcal-fix után a történeti meal-score-ok a régi
   matekon maradnak — batch újraszámolás vagy „a formula-verzió látszik" megoldás; az
   implementációs terv dönt (a napi aggregátum szempontjából a friss napok számítanak).
2. **Napzárás pontos triggere** (cutoff-óra vs. alvás-log beérkezés) — terv-szintű döntés.
3. A `WeekScoreBars`/heti mozaik 4→6 sub-jel vizuális sűrítése kis kártyán.
