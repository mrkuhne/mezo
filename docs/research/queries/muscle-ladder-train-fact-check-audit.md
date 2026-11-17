---
title: "The Muscle Ladder × Train: tényellenőrző audit (könyv · kód · elsődleges kutatás)"
type: query
updated: 2026-11-17
tags: [train, technique]
related:
  - muscle-ladder-mezo-development-digest.md
  - ../concepts/program-design-rules.md
  - ../concepts/set-volume-landmarks.md
  - ../concepts/personalized-exercise-selection.md
  - ../../features/train.md
sources:
  - raw/books/jeff-nippard-muscle-ladder-source.md
confidence: medium
contradictions: []
---

# The Muscle Ladder × Train — tényellenőrző audit

**Driver:** `mezo-1z4jc`. **Dátum:** 2026-11-17. Ez az audit a [digest](muscle-ladder-mezo-development-digest.md) 0. szelete: semmilyen viselkedést nem vezet be.

**Módszer.** (1) A könyv PDF-jének SHA-256-ja egyezik a [forrásrekorddal](../raw/books/jeff-nippard-muscle-ladder-source.md); a PDF 253–265, 290–303, 314–324, 331–349, 354–371, 374–417, 426–433, 471, 480–484, 538–541 oldalak újraolvasva (fizikai oldalszám). (2) A mai működés a **kódból** (nem csak a [Train-leírásból](../../features/train.md)), tesztnevekkel. (3) A számszerű küszöbök elsődleges forrásból (PubMed-absztrakt, ahol jelölve: teljes szöveg). Rövidítések: `BE/` = `backend/src/main/java/io/mrkuhne/mezo/feature/train/`, `FE/` = `frontend/src/features/train/`, `YML` = `backend/src/main/resources/application.yml`.

**Olvasási kulcs:** **K** = a könyv állítása · **M** = a mezo ma · **E** = elsődleges kutatás · **D** = új termékdöntés vagy ellenőrizendő hipotézis.

## 1. A digest pontossága

A digest könyvi állításai megállnak. Pontosítások: a 8.1. tábla a PDF **361**-en van (360 csak a cím), az 5.3. tábla a **265**-ön; a „kemény szett” küszöb a **355**-ön (elsődleges gyakorlat RPE ≥ 6, másod-/harmadlagos RPE ≥ 7, „usually”); a „tervezett / fáradtság alapú” deload a digest saját szóhasználata — a könyv „calculated / instinctive” deloadot ír (PDF 482–483), a tartalom egyezik. A digest nem említi, hogy a könyv a **gépes** összetett gyakorlatnak külön, rövidebb pihenőt ad (PDF 429), és hogy a 6–15-ös sávhoz **arányt** is ad (lásd 2.4). A könyvben **nincs** edzésenkénti szettplafon (a 15 szett „sok”, a 25 „junk volume” minősítés, PDF 375–377); a mezo 8-as napi korlátja más forrásból jön.

## 2. Megállapítások témánként

### 2.1 Tervgenerálás

- **K:** nincs „legjobb” felosztás; négy feltétel: elég volumen, erőfeszítés, regeneráció, tartós következetesség (PDF 398). 2 nap: 2× full body; 3 nap: full body; 4 nap: upper/lower; 5 nap: upper/lower + PPL hibrid vagy full body; 6 nap: PPL×2 vagy upper/lower (PDF 378–395). Kezdőnek nem ajánl magas gyakoriságú full bodyt (PDF 385). A 20 mintaterv szint, napok és időigény szerint rendezett, gyakorlatonként két cserével (PDF 538–541).
- **M:** a felosztás **kizárólag a napok számából** jön, kódba égetve: 2–3 Full · 4 Upper/Lower · 5 Upper/Lower/Push/Pull/Legs · 6 PPL×2 (`BE/service/MesoPlanSkeleton.java:32-37`). Bemenet: napok (2–6), hetek (4–8), izomprioritás, szabad célmondat (`api/feature/train/train.yml` `MesoPlanGenerateRequest`). **Nincs** időkeret, felszerelés, edzettségi szint. Gyakorlatválasztás: az izomcsoport katalógusjelöltjei compound-elöl → `stim` csökkenő → név szerint, a frame ≥ 6 szettnél 2, különben 1 gyakorlat; a `fatigue` mezőt a rendezés nem használja (`BE/service/MesoPlanFiller.java:28-55`). Az LLM opcionális, csak gyakorlatot választhat a keretbe (`MesoPlanMerger`). Tesztek: `MesoPlanSkeletonTest`, `MesoPlanFillerTest`, `MesoPlanMergerTest`, `MesoPlanGenerateContractIT`.
- **E:** nem küszöbkérdés.
- **D:** a mezo felosztástáblája **megegyezik** a könyv ajánlásaival — itt nincs eltérés. Valódi rés a bemenet: idő, felszerelés, szint, több jelölt (digest 1. szelet). Termékdöntés, nagy szelet.

### 2.2 Heti gyakoriság

- **K:** azonos volumennél a gyakoriságnak nincs kimutatott hatása (PDF 384, a 2019-es metaanalízisre hivatkozva); „bookkeeping” (PDF 398). A szerző gyakorlati alsó határa heti 2 full body, de az 1× is működhet (PDF 375, 382).
- **M:** minden csoport ≥ 2×/hét — a felosztástábla tulajdonsága, nem futásidejű szabály (`MesoPlanSkeletonTest.build_shouldTrainEveryGroupAtLeastTwiceAWeek_forEveryDayCount`). Napi izomkorlát **8 szett**, csak figyelmeztetés, csak a FE-ben (`FE/logic/setBudget.ts:38`).
- **E:** Schoenfeld, Grgic & Krieger 2019 (25 vizsgálat, doi:10.1080/02640414.2018.1555906): volumenegyeztetve nincs szignifikáns hatás; Pelland és mtsai (Sports Med, doi:10.1007/s40279-025-02344-w): hipertrófiára „elhanyagolhatóval összeegyeztethető”. A régebbi, kisebb 2016-os metaanalízis 2×-et talált jobbnak — a „min. 2×” szabály innen ered.
- **D:** a 2× jó alapértelmezés; nem kell hozzányúlni. Hipotézis csak annyi, hogy egy későbbi tervajánló felkínálhat-e 1×-es tervet.

### 2.3 RIR / erőfeszítés

- **K:** a munka zöme 0–3 RIR (PDF 318–319). Típus szerint: nehéz alapgyakorlat RPE 6–8 (≈ 2–4 RIR), másodlagos összetett RPE 8–10, izoláció RPE 9–10; bukásig csak az utolsó szett; az RPE „fuzzy range” (PDF 322–324). A becslés tanult készség, horgonyszettel kalibrálható (PDF 321–322).
- **M:** a generált terv **minden gyakorlatra, minden héten RIR 1** (`YML` `mezo.meso-plan.target-rir: 1`; `MesoPlanGeneratorService.java:147`); a deload héten sem változik. A kézi hozzáadás is RIR 1 (`FE/logic/exerciseDefaults.ts`). A naplózott RIR a súlyjavaslatot módosítja (cél alatti RIR → tartás, `BE/service/ProgressionDecider.java:53-56`; hiányzó RIR semleges). A választó 0–5 (`FE/logic/rir.ts`). A readiness-könnyítés felajánlás, nem automatizmus (`ReadinessLightenIT`).
- **E:** bukás nem szükséges (Refalo 2023, ES 0,12 n.s., doi:10.1007/s40279-022-01784-y; Refalo 2024 RCT: 0 vs 1–2 RIR azonos, doi:10.1080/02640414.2024.2321021). Robinson 2024 (doi:10.1007/s40279-024-02069-2, csak absztrakt): a növekedés enyhén nő a bukás közelében. A „nehéz alapgyakorlat messzebb maradhat” tételt **nem találtuk elsődleges vizsgálatban** — fáradtságkezelési gyakorlat. RIR-becslés: átlag ~1 ismétléssel alábecsült (Halperin 2022, doi:10.1007/s40279-021-01559-x); magas ismétlésnél a hiba 2–5 (Zourdos 2021).
- **D:** típusfüggő RIR-**sáv** (és a deload héten könnyebb cél) termékdöntés; a kutatás megengedi, de nem írja elő. **Ellentmondás, döntés nélkül is javítandó:** a volumenmotor „grind” jele `logged RIR ≤ cél − 2` (`VolumeProgressionService.java:215`, `grind-rir-gap: 2`); RIR 1 célnál ez ≤ −1, tehát **generált tervben soha nem teljesül** — a „tartás grind miatt” és a „korai deload” ág elérhetetlen (`VolumeDecider.java:21,29`).

### 2.4 Ismétléstartomány

- **K:** 3–30 ismétlés működhet elég erőfeszítéssel; a praktikus fő sáv 6–15 (PDF 403). Arány: 6–15 a volumen 60–80%-a, 1–5 és 15–30 egyenként 10–20% (PDF 405–410). Nagy alapgyakorlat 6–10, izoláció 10–15 (PDF 409). Izolációnál széles sáv kell, mert a súlylépcső arányosan nagy (PDF 337).
- **M:** generátor compound 8–10, izoláció 12–15 (`YML` `mezo.meso-plan`); kézi hozzáadás compound 8–10, izoláció **10–12** (`exerciseDefaults.ts`) — a két alapérték eltér. Mix-szabály nincs, csak egy lint (`structureLint.ts`, 80% egy zónában).
- **E:** a terhelési sávok között nincs hipertrófia-különbség bukásig vitt szetteknél (Lopez 2021, doi:10.1249/MSS.0000000000002585; Schoenfeld 2017, doi:10.1519/JSC.0000000000002200). **Sem a 25/50/25, sem a könyv 60–80/10–20 aránya nem tesztelt** — szerzői gyakorlat.
- **D:** a mai sávok a könyv fő sávján belül vannak; **nincs teendő**. Százalékos mixet ne kódoljunk.

### 2.5 Munkaszett- és volumenelszámolás

- **K:** volumen = kemény szettek száma, bemelegítés nem számít (PDF 354–355). Kezdő ~10 szett/izom/hét; középhaladó 10–20; 30 fölött senkinek (PDF 357–359). A 8.1. tábla szintenkénti becsült sáv (PDF 361); karra csak az izolációs szett számít, a tábla ezt már beárazza (PDF 362). Fenntartás 4–8 szett (PDF 359).
- **M:** számít: `working` típusú, nem kihagyott, ismétléssel naplózott szett, `countsTowardVolume` gyakorlaton, lezárt edzésben (`VolumeProgressionService.java:196-203`). **Erőfeszítés-szűrő nincs**; a többletszett is 1-nek számít. **Csak direkt** elszámolás, egy szett → egy csoport (`BE/service/MuscleGroup.java`, ADR 0021). MEV/MAV/MRV (`YML` `mezo.volume.baselines`): mell 8/14/20 · hát 10/16/22 · váll 8/12/18 · bicepsz 6/10/14 · tricepsz 6/10/14 · comb elöl 8/12/18 · comb hátul 6/10/14 · far 8/12/18 · vádli 6/10/16; a forráscímke „RP guidelines · intermediate”, confidence 0,5. Tesztek: `VolumeEffectiveSetsIT`, `VolumeBaselineSeedIT`.
- **E:** több szett → több növekedés, csökkenő hozammal; 20-nál nincs igazolt plafon (Schoenfeld 2017, doi:10.1080/02640414.2016.1210197; Baz-Valle 2022, doi:10.2478/hukin-2022-0017; Pelland). Pelland modelljében az indirekt szett **0,5**-ként számolva illeszkedett legjobban. Az **izmonkénti MEV/MAV/MRV számokra nem találtunk lektorált validációt** — gyakorlati heurisztika.
- **D:** a mezo táblája a könyv *középhaladó* sávjaiba esik (direkt elszámolással összemérhető) — a számok cseréje nem indokolt. Hipotézisek: (a) edzettségi szint szerinti kiindulás (kezdőnek a MEV-rámpa teteje sok lehet); (b) erőfeszítés-küszöb az elszámolásban; (c) 0,5-ös indirekt jóváírás — ez **minden** küszöböt átskálázna, direkt számolásra kalibrált sávval nem keverhető.

### 2.6 Progresszió

- **K:** kilenc mód; a kettős progresszió a leggyakoribb: sávon belül +1 ismétlés, a sáv tetején súlyemelés és vissza az aljára (PDF 335–339). A napi ingadozás normális (PDF 333–334). Plató = „hetek–hónapok” haladás nélkül; előbb következetesség, regeneráció, erőfeszítés, technika ellenőrzése, csak utána ~+20% volumen (PDF 364–366). Szett hozzáadása „sparingly” (PDF 341). Gyakorlat legalább 1 hónapig marad; kezdőnél 3–6 hónap (PDF 348).
- **M:** RIR-érzékeny kettős progresszió (`BE/service/ProgressionDecider.java`, 24 unit teszt): sáv tetején a legközelebbi valós súly `× (1 + 2,5% / 5%)`, legfeljebb 10% ugrás; különben +1 ismétlés. Gépsúly-memória (`WeightSnapper`). e1RM Epley, 12 ismétlés fölött nem számol (`OneRepMax.java`). **A referencia az utolsó edzés egyetlen top szettje** (`SetRecommendationService.java:200-207`) — nincs átlagolás, nincs trend, **nincs platóészlelés**. Heti szettlépcső (`BE/service/VolumeDecider.java`): ha a múlt heti naplózott szettszám ≥ cél és nincs grind → **automatikusan +2 szett/hét** a prioritás plafonjáig. A pump/ízület/terhelés visszajelzést **egyetlen edzésszabály sem olvassa**.
- **E:** súly- és ismétlésprogresszió hasonló növekedést ad (Plotkin 2022, doi:10.7717/peerj.14142; Chaves 2024, doi:10.1055/a-2256-5857). A kéthetente növelt szettszám **nem** adott szignifikánsan több izmot (Enes 2024, doi:10.1249/MSS.0000000000003317). e1RM: a pontosság magas ismétlésnél romlik (Reynolds 2006, doi:10.1519/R-15304.1) — a 12-es vágás konvenció, de védhető.
- **D:** a súly/ismétlés motor **kész és megfelel a könyvnek**. Valódi rés: (a) rossz nap ≠ plató (a nyitott `mezo-88iwa.15` ugyanezt célozza); (b) az automatikus heti +2 szett RP-örökség, a könyv „találd meg a sávod és maradj” elvével és az Enes-vizsgálattal nem egyezik — termékdöntés, hogy felajánlás legyen-e.

### 2.7 Pihenőidő

- **K:** 11.1. tábla (PDF 429): izoláció 1–2 perc · könnyű összetett 2–3 · **gépes összetett 2–3** · nehéz összetett 3–5; „fuzzy lines” (PDF 427). Azonos izmot terhelő szuperszett nem ajánlott, antagonista pár csak időt spórol (PDF 431–432).
- **M:** **150 mp compound / 90 mp minden más**, a FE-be égetve, adatmező és beállítás nélkül (`FE/logic/restTimer.ts`). Az időbecslés statikus ága ugyanezt használja; a tanult profil ága más magokból indul (szettciklus 180/125 mp, váltás 240 mp, `YML` timing) — a két ág nem ugyanazt a pihenőt látja (`FE/logic/sessionLength.ts:74-98`).
- **E:** > 60 mp előnyös; ~90 mp fölött további haszon nem mutatható ki (Singer 2024, teljes szöveg, doi:10.3389/fspor.2024.1429789); egyetlen kis RCT-ben 3 perc jobb volt 1 percnél (Schoenfeld 2016, doi:10.1519/JSC.0000000000001272). Összetett vs izoláció külön nem vizsgált.
- **D:** a 150/90 a kutatás szerint **védhető**; a könyv 3–5 perce nehéz alapgyakorlatra szerzői ajánlás. Nem első szelet. Hipotézis: felhasználói alap-pihenő és egy közös forrás az órának és az időbecslésnek.

### 2.8 Deload

- **K:** 4–8 hét építés + 1 hét deload (PDF 471); 4–12 hetente, ő ~8 hetente tervez; aki még nem edz keményen, annak nem kell (PDF 481). Volumen −30–50% (1–2 szett gyakorlatonként), erőfeszítés −1–3 RPE-pont, %1RM −5–10 (PDF 482–483).
- **M:** mindig az **utolsó hét**, automatikusan (`MesoPlanSkeleton.java:104-115`); súly × 0,9 és ismétlés a sáv aljára (`ProgressionDecider.java:45-49`, a 0,9 kódba égetve); heti szett × 0,5, alsó korlát ⌈MEV/2⌉ (`VolumeDecider.java:22-27`). A **cél-RIR nem változik**. Visszatérő rámpa betegség után (`ComebackRamp`, RIR-padló 3). A fázisgörbe MEV/MAV/MRV címkéit döntési kód nem olvassa.
- **E:** **semmilyen százalékra nincs elsődleges bizonyíték**; a Delphi-konszenzus nem adott számot (Bell 2023, teljes szöveg, doi:10.1186/s40798-023-00633-0), a gyakorlat 5,6 ± 2,3 hetente (Rogerson 2024). Az egyetlen RCT egy teljes kihagyott hetet vizsgált, haszon nélkül (Coleman 2024, teljes szöveg, doi:10.7717/peerj.16777).
- **D:** a mezo számai a könyv sávjában vannak (−50% szett, −10% súly); egyetlen eltérés, hogy a könyv az **erőfeszítést is** visszaveszi. Hipotézis: a deload felajánlás legyen-e, és kezdőnél kell-e egyáltalán.

### 2.9 Gyakorlatcsere és ajánlás

- **K:** hat alapminta, mindegyikből legalább egy (PDF 253, 265); nincs kötelező gyakorlat (PDF 299). Szempontok: fájdalom, anatómia, érzet, élvezet, felszerelés, „három doboz” — nagy feszülés, jó érzés, könnyen terhelhető (PDF 295–301). Sorrend: összetett elöl, a hatás mérsékelt (PDF 302–303). Variáció tervezetten, pár havonta néhányat (PDF 290–292, 348–349).
- **M:** a backend **nem ajánl**: a csere azt tárolja, amit a kliens küld (`WorkoutExerciseChangeService.java:39-76`). A „Hasonló gyakorlatok” legfeljebb 4 elem: azonos izom, majd azonos régió, könyvtári sorrendben (`FE/sheets/ExercisePickerSheet.tsx:54-60`) — típus, `stim/fatigue`, felszerelés, mozgásminta, előzmény és preferencia nélkül. A katalógus mezői: `muscle, type, stim, fatigue` + média (`ExerciseCatalogEntity`); nincs felszerelés, mozgásminta, másodlagos izom. A csere megőrzi az ismétlés-/RIR-receptet; az új gyakorlat a **saját** előzményéből indul (`ExerciseHistoryResolver.java:37-39`). Tesztek: `WorkoutExerciseChangeIT`.
- **E:** nem küszöbkérdés.
- **D:** valódi rés (digest 2. szelet), de a Boop már jóváhagyott tervet kapott ugyanerre (`mezo-r36n9.66`); a katalógusbővítést azzal **egyeztetve** kell tervezni, nem párhuzamosan.

## 3. Rétegek közti ellentmondások a mai kódban

A könyvtől függetlenül találtuk; a digest „kritikus egybevezetés” pontját konkretizálják.

| # | Ellentmondás | Hol | Kezelés |
|---|---|---|---|
| 1 | A volumenmotor grind-jele RIR 1 célnál elérhetetlen → nincs grind-tartás, nincs korai deload | `VolumeProgressionService.java:215` | `mezo-s5sd4` |
| 2 | Kiemelt izom 1. heti MEV+2 indulását az első heti átforduló sima MEV-re írja vissza: a terv többet mutat, mint amit a nap kioszt | `VolumeDecider.java:18-20`; `VolumeProgressionServiceIT.testRollover_shouldStartAtMevThenNoop_whenFirstCalendarWeek` | `mezo-p9plo` |
| 3 | A napi 8 szettes korlát csak az 1. hét kereteire igaz; a rámpa pl. hátnál 2×/hét mellett 8–11 szett/edzésig megy | `MesoPlanSkeletonTest.build_shouldKeepEveryFrameUnderSessionCapOfEight_forEveryDayCount` | `mezo-ehdgq` |
| 4 | A heti zóna a RIR ≤ 1 szettet „failure” stílusnak veszi, **12 szett/hét** plafonnal; ugyanarra a hétre a motor 10–22 szettet ír elő | `FE/logic/setBudget.ts:36-37` vs `YML` baselines | `mezo-ehdgq` |
| 5 | Kétféle MEV: FE `GROUP_MEV` (mell 4, comb 4, …) vs motor (8, 8, …) | `setBudget.ts:64-76` | `mezo-ehdgq` |
| 6 | Időbecslés két ága eltérő pihenő- és váltásszámokkal | `sessionLength.ts:74-98` | 3. szelet |
| 7 | Deload-szett: tényleges = előző × 0,5; a volumenív „terv” vonala = plafon × 0,5 | `VolumeArcService.java:164` | `mezo-ehdgq` |
| 8 | Izoláció alap-sáv: generátor 12–15 vs kézi hozzáadás 10–12 | `exerciseDefaults.ts` | `mezo-ehdgq` |

## 4. Rangsorolt összefoglaló

**Kész, a könyvvel és a kutatással összhangban:** felosztástábla; ≥ 2× gyakoriság mint alapértelmezés; ismétléssávok; munkaszett-elszámolás (bemelegítés nélkül, direkt); RIR-érzékeny kettős progresszió gépsúly-memóriával; deload szett-/súlycsökkentés; betegség utáni visszatérés; edzés közbeni csere; pihenőóra (védhető értékekkel).

**Valódi rés, fontossági sorrendben:**

1. **Belső ellentmondások** (3. fejezet) — nem a könyvből jönnek, de minden későbbi „miért ezt ajánlom” magyarázat előfeltételei.
2. **Erőfeszítés-cél:** egyetlen RIR 1 mindenre, a deload héten is; a könyv típusfüggő sávot ír. Kis, önálló, a szervert érinti (a web és a Boop is örökli), és feloldja az 1. sz. ellentmondást.
3. **Rossz nap ≠ plató**, automatikus heti +2 szett: többhetes trend, felajánlás automatizmus helyett (`mezo-88iwa.15`, digest 4. szelet).
4. **Tervajánló bemenetei:** idő, felszerelés, szint, több jelölt (digest 1. szelet) — a legnagyobb érték, a legnagyobb munka.
5. **Gyakorlat-taxonómia és csere** (digest 2. szelet) — a Boop-tervvel egyeztetve.
6. **Pihenő és idő egy forrásból** (digest 3. szelet) — alacsony, mert a mai értékek védhetők.

**Nem kell változtatni pusztán a könyv miatt:** felosztás, gyakoriság, ismétléssávok, MEV/MAV/MRV számok, deload-százalékok, pihenő alapértékek.

**Javasolt első szelet:** az erőfeszítés-cél gyakorlattípus szerinti sávja + könnyebb deload-cél, a 3. fejezet 1–2. pontjának javításával. Tulajdonosi döntés: akarja-e, hogy a nehéz alapgyakorlatok cél-tartaléka nagyobb legyen, mint az izolációké, és hogy az app sávot mutasson egyetlen szám helyett. A kutatás ezt megengedi (bukás nem szükséges), de nem írja elő — ezért termékdöntés, nem tudományos kötelezettség.

## 5. Korlátok

- A Pelland- és Robinson-tanulmányból csak absztraktot olvastunk; LeSuer 1997 csak másodlagos hivatkozásból ismert.
- A MEV/MAV/MRV „nincs validáció” megállapítás korlátozott keresésen alapul.
- A kódállítások olvasásból származnak, tesztfuttatás nélkül; a 3. fejezet 2. pontjának *kiemelt izom* esetét nem rögzíti teszt (a teszt egy 14-re seedelt sort ellenőriz).
- A könyv egy szerző szintézise; ahol **E** hiányzik, a **K** szerzői gyakorlat.
