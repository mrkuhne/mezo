# Fuel „Mai" — dinamikus energia-budget + fix-terv timeline (design spec)

- **Date:** 2026-07-26 · **bd:** `mezo-1oy5` · **Related:** [`2026-07-23-fuel-slot-timing-design.md`](2026-07-23-fuel-slot-timing-design.md) (`mezo-53su` — az itt megújított `buildDayPlan` szülője), `mezo-a1tl` (slot-timing follow-ups), `mezo-6r1` (Fuel roadmap)
- **Decided with Daniel in-session (2026-07-26):** fix napi terv + kihagyott múlt (nem élő reflow); levezetett stabil terv (nincs tárolás); tiszta dinamikus energia-modell (BMR + aznapi mozgás, PAL helyett), tudatosan vállalva a heti drift-et; kihagyott = halvány, pótolható kártya (nem tűnik el); edzésblokkok külön kártyák (nincs összevonás).
- **Staging:** ez a spec az **A + B réteget** tervezi (mindkettő a FE Fuel-logikában, meglévő wire-adatból — nincs backend/kontraktus/migráció). A **C réteg** (goal-engine + Me-oldali TDEE összehangolás) tudatosan **out of scope** → §10.

## 1. Cél

A Mai timeline élő, mindig-újraszámolt nézetből **stabil napi tervvé** válik: a slotok fix anchor-időn állnak (kelés / edzés / fekvés), a `now` már **csak státuszt fest** (nem tologat), a lejárt+nem logolt étkezés **halvány „kihagyott" kártya** marad (utólag pótolható), és a napi kcal/makró **dinamikus**: az adott nap tényleges betáblázott aktivitásából számol a BMR-re, **duplázás nélkül**, átlátszó bontással (alaphő + mozgás + deficit).

## 2. A gyökér-problémák (honnan jöttek az „össze-vissza" számok)

| # | Tünet a képernyőn (este 23:19, semmi logolva) | Ok |
|---|---|---|
| P1 | Reggeli 23:18-ra, Ebéd 20:30-ra ugrik | `reflowPendingWindows` (mezo-53su **D4**): a le nem logolt étkezés-ablakokat egyenletesen a `[max(now, utolsó_log+90), kitchenClose]` sávra tolja. Üres napon 23:19-kor mind a 4 ablak „pending" → mind az utolsó percekbe zsúfolódik. A „pending sose essen a múltba" szabály közvetlen mellékhatása. |
| P2 | Azonos idejű, ütköző slotok (20:30/20:30, 23:18/23:18) | Két 18:00-s blokk (Plyo Leg gym + Volleyball 240p) → a snap/min-gap kétszer fut ugyanarra a horgonyra, a 240p röpi egy fő étkezést `blokk_vége+45`→konyhazár-ra ránt; a snap felülírja a 90p gap-et (D4-ben szándékos). |
| P3 | „Duplikált" makrók (Ebéd 551 = Reggeli 551) | `splitBudget` az azonos súlyú fő étkezéseknek azonos budgetet ad — kozmetikai, de erősíti a káosz-érzést. |
| P4 | Pihenőnap = 4h röpi-nap ugyanannyi kcal | A napi budget statikus `segment.kcal` (BMR×PAL−deficit), **sosem néz az aznapi tényleges aktivitásra**. A `TdeeBootstrapService` a duplázást úgy kerüli, hogy a per-session MET-et *nem* adja hozzá — de cserébe minden nap ugyanaz. |

## 3. Réteg A — Dinamikus energia-motor (FE `deriveDailyBudget`)

### 3.1 A képlet
```
balance      = segment.kcal − tdeeBootstrap.tdee        // a cél deficit/surplus, TDEE-FÜGGETLEN (§3.2)
maintenance  = BMR × NEAT_BASELINE                       // edzés nélküli napi élet (ülő ~1,2)
EAT_today    = Σ  MET(block.kind) × currentWeightKg × (durationMin/60)   // aznapi betáblázott mozgás
targetRaw    = maintenance + EAT_today + balance
targetKcal   = max(KCAL_FLOOR, targetRaw)                // biztonsági padló (§3.4)
```
**Miért nincs duplázás:** a statikus `PAL` (1,55) helyére a `NEAT_BASELINE` (1,2) kerül — az edzést nem a szorzó „sejti meg", hanem tételesen (`EAT_today`) adjuk hozzá. A `balance` marad, mert kizárólag a súlyváltozás-ütemből jön (`GoalProjectionService`: `sign × rateTargetPctPerWeek/100 × súly × 7700 ÷ 7`), semmi köze az aktivitáshoz.

### 3.2 A `balance` kifejtése a wire-adatból
`balance = segment.kcal − tdeeBootstrap.tdee`. Mindkettő már a FE wire-ön (`goalResponse.prescription.segments[].kcal`, `goalResponse.tdeeBootstrap.tdee`). Ez a jelenlegi bootstrap-TDEE-hez képesti eltérés = a beépített deficit/surplus. (Közelítés: a projekció szegmensenként a *vetített* súllyal számol TDEE-t; a bootstrap-TDEE a *jelenlegi* súllyal. Az eltérés elhanyagolható; a C réteg később a goal-engine-ből expliciten expozálhatja a `dailyEnergyBalance`-t, akkor azt használjuk.)

### 3.3 Makró-elosztás
- **Fehérje: FIX** = `segment.proteinG` (testsúly-alapú, nem skálázódik aktivitással).
- **Zsír:** `fat_g = FAT_KCAL_SHARE(0,275) × segment.kcal / 9` — a **BÁZIS** (nem a dinamikus total) 27,5%-a → stabil ~66 g.
- **Szénhidrát: a maradék** = `(targetKcal − proteinG×4 − fat_g×9) / 4` (padló 0). Ez nyeli az aktivitás-bónuszt → nagy edzésnapon több carb (helyes üzemanyag).

### 3.4 Konfig (`fuelConfig.ts` — új konstansok)
| Konstans | Érték | Megjegyzés |
|---|---|---|
| `NEAT_BASELINE` | `1.2` | Fix az A rétegben; az `activityLevel→NEAT` reframe a C réteg. |
| `MET_BY_KIND` | `{ gym: 6.0, sport: 4.5, run: 9.5, default: 5.0 }` | `kcal = MET × kg × óra`. Konzervatív (teremröpi sok állással). |
| `DEFAULT_RUN_MIN` | `45` | Nulla-időtartamú (interval) futás égés-becsléséhez. |
| `KCAL_FLOOR_MODE` | `bmr` | A napi cél sose menjen `BMR` alá (pihenőnapon a nyers `2064−516=1548 < BMR 1720` → padlóra). |
| `PERI_SNACK_MIN_KCAL` | `300` | Ennél nagyobb égésű blokk peri-workout snacket kap. |
| `PERI_SNACK_MIN_DURATION` | `90` | …vagy ≥90 perces blokk. |

### 3.5 A te profilod ezekkel (BMR 1720, súly 78,6, segment 2150 / 163 P, tdee 2666 ⇒ balance −516)
| Nap | EAT_today | targetRaw | targetKcal | szénhidrát |
|---|---|---:|---:|---:|
| Pihenő | 0 | 1548 | **1720** (padló) | ~118 g |
| Csak gym (60p, MET 6) | ~472 | 2020 | **2020** | ~155 g |
| Gym + röpi 240p (MET 4,5) | ~1887 | 3435 | **3435** | ~547 g |

### 3.6 Heti drift (tudatos)
A heti összeg elszakad a régi PAL-feltevéstől — ez a valóságot tükrözi (Daniel döntése). Biztonsági háló: a `GoalProjectionService` a **megfigyelt súlytrendet** használja gerincként, amint `provisional` → a súlycél a tényleges súlyváltozásból korrigál, függetlenül a MET-becslés pontosságától. A Me-oldali statikus TDEE-kártya összesimítása a **C réteg**.

## 4. Réteg B — Fix-terv timeline (FE `buildDayPlan`)

### 4.1 A `now` leválasztása az időzítésről
- `placeWindows` **változatlanul** stabil anchor-időket ad (kelés+45, edzés-snap, konyhazár). Ez **a terv**.
- `reflowPendingWindows` **eltávolítva a default útból** — a `now` többé nem tolja az ablakokat. (A „lekésett ebéd → told a vacsorát" reflow megszűnik; a terv stabil, az újratervezés explicit / anchor-változásra történik — Daniel „fix terv" döntése.)
- A terv **azért stabil, mert az inputok (kelés/fekvés/blokkok/mealsPerDay) napközben nem változnak** → nincs tárolás; magától újraszámol, ha egy anchor tényleg változik.

### 4.2 Slot-állapot a `now`-ból (új `missed` állapot)
Minden meal-ablakra:
- **done** — van hozzá matchelt logolt étkezés (a slot a `loggedAt`-en renderel).
- **now** — az „aktuális" nem-logolt ablak: a `now`-hoz legközelebbi nem-logolt ablak, előre-torzítva, a `kitchenClose`-ig aktív marad (→ „utolsó ablak" este).
- **missed** — nem logolt, a `now`-ablak ELŐTT van (ideje lejárt). **Halvány kártya, megtartja a tervezett makrót, `Pótlás` + AI akcióval — utólag logolható, NEM tűnik el.**
- **pending** — nem logolt, a `now`-ablak UTÁN (jövő).

Blokk-slotok: **past** (`end ≤ now`, halványabb) vs **upcoming** — mindig **külön kártyák** (nincs összevonás). Supplement- és víz-slot változatlan.

### 4.3 Ütközésmentesség + egyidejű blokkok (P2 javítás)
- A reflow megszűntével a `placeWindows` egyszeri min-gap forward-push-a elég; **soha két meal-slot azonos percen** (szigorú `>` push, `kitchenClose`-ra clamp).
- Átfedő/egyidejű blokkoknál a snap **nem versenyez**: a post-workout fő étkezés a **legkésőbb végződő** blokk `vége+45`-re, a pre-fuel a **legkorábban kezdődő** blokk `−75`-re snap-el (egyszer). Így a Plyo Leg 18:00 + röpi 18:00–22:00 nem ránt szét semmit.
- A blokkok külön kártyák maradnak, kalória-becsléssel (§3.4 MET).

### 4.4 Peri-workout snack (A×B találkozás)
`mealsPerDay` a **padló**. Minden jelentős blokk (`EAT_block ≥ PERI_SNACK_MIN_KCAL` **vagy** `durationMin ≥ PERI_SNACK_MIN_DURATION`) egy peri-workout snack-ablakot kap; a bónusz-szénhidrát ide + a post-workout fő étkezésbe folyik. Elhelyezés: ha egy fő étkezés már post-workoutra snap-el (reggeli korai edzésnél, vacsora esti edzésnél), a peri-snack a **pre** oldalra kerül (könnyű pre-fuel); különben pre+post szükség szerint. Max ~6 slot.

### 4.5 Minden aktivitás számít
`deriveBlocks` (már meglévő) a gym + sport + run blokkokat adja. Az A réteg **mindet** beleszámolja az `EAT_today`-be; a B réteg **mindet** külön blokk-kártyaként rendereli. (Nincs kódváltozás a derivációban — csak a fogyasztók bővülnek.)

### 4.6 Átlátszó cél-fejléc
A `FuelPlanToday` új mezőket kap: `energy: { baseKcal, activityKcal, balanceKcal, targetKcal }`. A `FuelMaiPage` cél-kártyája ebből rajzolja a bontást (`Alaphő 2 064 · Mozgás +1 887 · Deficit −516 = 3 435`) — pont az „össze-vissza szám" ellentéte. (A stale `kcal floor 2500` fejléc-string helyére a valós dinamikus cél kerül.)

## 5. Anchor → slot leképezés (a fix terv gerince)
| Slot | Forrás |
|---|---|
| Ébresztő (reggeli stack) | `wake` (sleep goal) |
| **Reggeli** | `wake + 45` |
| Köztes étkezések (Tízórai/Ebéd/Uzsonna) | a kelés→konyhazár sávra osztva (`mealsPerDay`) |
| Pre-fuel / Pre-workout stack | első blokk `− 30` / `− 40` |
| Meal-snap edzés köré | legkorábbi blokk `− 75` (elé) / legkésőbbi blokk `vége + 45` (utána) |
| Peri-workout snack | jelentős blokk köré (§4.4) |
| Vacsora | ≈ konyhazár = `bed − 90` |
| **Esti stack** | `bed − 120` (T−2h) |
| Konyhazár / kávé-cutoff chip | `bed − 90` / Fuel-beállítás |

## 6. Élek / edge case-ek

- **Korai edzés (kelés 06:00 / gym 07:30):** a meglévő post-workout snap kezeli — a fő reggeli az edzés utánra (`08:30+45 = 09:15`) csúszik, elé könnyű pre-fuel a kelés köré (supplement + peri-snack pre-oldal). Sorrend: Ébresztő 06:00 → pre-fuel 06:20 → pre-workout stack 06:50 → gym 07:30–08:30 → **Reggeli (post-workout) 09:15** (carb-loaded a bónuszból) → Ebéd/Uzsonna/Vacsora. `MIN_SLOT_GAP` gondoskodik a spacingről.
- **Egész nap nincs logolva, este nézve:** minden meal-ablak `missed` (halvány, pótolható), a blokkok `past`, csak a kitchen-close-ig aktív utolsó ablak `now`. Nincs 23:18-as reggeli.
- **Pihenőnap:** `EAT_today = 0` → a nyers cél a `BMR` alá esne → `KCAL_FLOOR` (BMR) véd.
- **Nincs goal/prescription vagy biometria:** `deriveDailyBudget` a mai fallbackre esik (segment nélkül a `fuel.targets`), `balance = 0`, `EAT_today` akkor is számol, ha van BMR + súly; ha nincs BMR (nincs profil), az energia-motor a statikus fallbackre esik (mai viselkedés) — soha nem dob.
- **Hiányzó blokk-időtartam (interval futás):** `DEFAULT_RUN_MIN` a becsléshez; a snap `DEFAULT_BLOCK_MIN`-t használ (mai viselkedés).

## 7. Data flow / plumbing
- `timelineHooks.ts`: átadja a `buildDayPlan`/`deriveDailyBudget`-nek a `BMR` + `tdee`-t (`useGoal().tdeeBootstrap`), a `currentWeightKg`-t (weigh-in hook, fallback `goal.startWeightKg`), a már meglévő `blocks`-ot és `segment`-et. Nincs új hálózati hívás — minden a wire-ön van.
- `deriveDailyBudget(segment, fallback, { bmr, tdee, weightKg, blocks })` → `{ kcal, p, c, f, energy:{base,activity,balance,target} }`.
- `buildDayPlan`: `reflowPendingWindows` kivezetése; `missed`/`now`/`past` állapot-számítás; egyidejű-blokk snap-fix; peri-snack beszúrás; `energy` átadás a `FuelPlanToday`-re.
- `FuelSlot` típus: `state` bővül `'missed'`-del. `FuelPlanToday`: `energy` mező.
- `FuelMaiPage`: dinamikus cél-kártya a bontással; `SlotCard`: `missed` render (halvány + `Pótlás`); blokk-kártyák külön (mai render marad).

## 8. Integrációk
- **→ Today:** az agenda ugyanazt a `useFuelTimeline` tervet olvassa → a fix-terv + dinamikus cél ott is érvényes; **vizuális goldenek frissülnek** (a mezo-53su óta bevált baseline-flow).
- **→ Sleep (anchor):** változatlan — a wake/bed forrás marad (`useSleepGoal`).
- **→ Train:** `deriveBlocks` változatlan; a blokkok most kalória-becslést is kapnak (MET) a megjelenítéshez.
- **→ Goal/Me:** az A réteg csak OLVASSA a `tdeeBootstrap`/`segment`-et. A `balance`-kifejtés (§3.2) átmeneti közelítés; a Me-oldali TDEE-kártya összesimítása a **C réteg** (§10).

## 9. Tesztelés
**FE tiszta tesztek (a slice szíve):**
- `deriveDailyBudget`: rest/gym/big-day számok (§3.5), `KCAL_FLOOR` clamp, makró-split (protein fix, zsír a bázisból, carb nyeli a bónuszt), `balance` kifejtés, hiányzó profil → fallback (nincs throw).
- `buildDayPlan`: `missed` állapot lejárt+nem-logolt ablakon; `now` = utolsó-ablak konyhazárig; `pending` csak jövő; **korai edzés → reggeli post-workoutra** (09:15); egyidejű blokkok → nincs meal-ütközés, azonos perc kizárva; multi-activity `EAT` összeg (gym+sport+run); determinizmus (`nowHHmm` injektált, azonos input → azonos terv); reflow-mentesség (a régi „late-log reflow" tesztek átírva/törölve).
- `useFuelTimeline` mindkét mód; `FuelMaiPage` cél-kártya + `SlotCard` `missed` render + `Pótlás` akció.
- Mock-timeline snapshot; **today + fuel vizuális goldenek** a baseline-workflow-val.
- **Gate:** `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (mindkét mód zöld); `docs/features/fuel.md` frissítés + `node scripts/lint-docs.mjs`.

## 10. Out of scope (C réteg + később)
- **Goal-engine reconciliation:** a `TdeeBootstrapService`/`GoalProjectionService` átállítása `BMR×NEAT + heti betáblázott EAT`-re, hogy a Me-oldali projekció és a Fuel napi cél EGY történetet mondjon; `activityLevel`→NEAT reframe (címkék: „nem-edzés életmód"), a `dailyEnergyBalance` explicit expozálása a kontraktuson, a Me „Alap-TDEE" kártya dinamikussá tétele. Backend + migráció + kontraktus.
- **Adaptív TDEE-hurok** (súlytrend → valós maintenance visszaszámolás) — a MET-pontatlanság hosszú távú hálója; a goal-engine már részben erre támaszkodik, teljes hurok külön slice.
- **MET-finomítás:** táv/tempó-alapú futás-égés, HR-alapú becslés.
- **Explicit „Replan" gomb / perzisztált napi terv** — a levezetett stabil terv most elég; ha kell terv-vs-valóság history, külön slice (backend `fuel_day_plan`).
