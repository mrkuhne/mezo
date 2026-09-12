# Fuel Titanium — page-specific coverage record (2026-09-11)

Driving issue: `mezo-jb84`. Spec: [Fuel Titanium design](../superpowers/specs/2026-09-11-fuel-titanium-design.md).
Seeded from [TITANIUM_FEATURE_COVERAGE_REGISTER.md](TITANIUM_FEATURE_COVERAGE_REGISTER.md) rows
`fuel`, `meal`, `nutrition`, `pantry`, `recipe`, `medication` + related checks, expanded from the
2026-09-11 backend and frontend audit reports (two Explore subagents; anchors below).

New destination set (owner-approved 2026-09-11): **Mai · Konyha · Trendek · Kiegészítők**.
No 3D companion on any Fuel page. Decisions marked *(J)* are Claude's proposal pending the owner's
per-row Hungarian conversation; they become final only when the owner confirms. `DEFER`/`DROP`
rows are only valid with an explicit owner decision recorded in the Owner note column.

## A. Mai — napi műszerfal és villámnaplózás

| # | Capability | Evidence | Current behavior | Freq/value | New destination | Decision | Preservation test | Owner note |
|---|---|---|---|---|---|---|---|---|
| A1 | Napi keret/makró hero (cél − étel + mozgás, goal-engine célok) | `getFuelDay` → `FuelDayService.getDay:73`; `DayTargetProjector`; FE `logic/keretHero.ts`, `FuelMaiPage.tsx` | Hub hero: kcal count-up, day-seg bar; targets goal-prescribed with config fallback; training/rest day-type via scheduled training only | Daily, core | Mai hero (tál + energiaív + maradék szám + egyenlet) | KEEP | Mai hero shows goal-driven target; training day shifts kcal as today | Approved visual calibration |
| A2 | Négy makró-gyűrű (P/C/F/rost) | same as A1; me-nap-deep §Fuel calibration | Macro tiles today; rings in prototype | Daily | Mai, four animated rings | KEEP | Ring values match `getFuelDay` consumed/target | staggered rise anim |
| A3 | Étkezés naplózása — kézi (kamra/recept/becslés sorokkal) | `createMeal` `MealService.create:84`; `MealComposer.tsx`; `/fuel/log/uj` | 556-line composer; 3 source arms; write-time snapshot + 8-dim scoring | Daily, core | Mai → naplózó felület (kamera-első, fül: fotó/hang/gépelés/szokásosak) | KEEP | Manual log with pantry+recipe+estimate lines still saves and scores | — |
| A4 | Étkezés naplózása — AI fotóból | `draftMealFromAi` `MealAiDraftService.draft:101`; `MealComposer.tsx:316` AI panel | Text+photo AI draft, deterministic confidence, draft-outcome signal | Daily, #1 mode | Naplózó default nézete: kamera nyit | KEEP (emelt) | Photo → draft → user confirm → saved meal; failure → manual fallback | Owner: photo is #1 |
| A5 | Étkezés naplózása — AI szövegből | same endpoint, text arm | Free-text AI draft | Frequent | Naplózó gépelés fül | KEEP | Text draft flow works | #3 mode |
| A6 | Étkezés naplózása — hangból | NO backend voice today: `useVoiceInput` not wired to MealComposer; `POST /api/companion/transcribe` exists | Voice input exists only in chat/journal surfaces | Wanted #2 mode | Naplózó mikrofon fül: transcribe → AI text draft | KEEP (új összekötés) | Spoken sentence produces a draft via transcribe+ai-draft | New wiring, existing endpoints |
| A7 | „Szokásosak" gyorsismétlés (napszak+gyakoriság szerint) | new; data from meal history (`getFuelDay`/history), FoodNoms pattern | Does not exist today | High value | Naplózó „szokásosak" sor | KEEP (új) | Morning list ranks breakfast repeats first; one tap prefills | Prior art: FoodNoms |
| A8 | Étkezés szerkesztése | `PUT /api/meal/{id}` `MealService.update:95`; hook `useMealActions().updateMeal` `fuelHooks.ts:113` — **NO UI caller today** | Backend full-replace + re-score + coach-cache invalidation; meal immutable in UI | Correction path | Mai étkezés-sor → szerkesztés a naplózóban | KEEP (új UI, meglévő backend) | Editing a logged meal updates macros and re-scores; old coach prose cleared | Backend audit §6.1: edit is the coach invalidation path |
| A9 | Étkezés törlése | `DELETE /api/meal/{id}` `MealService.delete:104` — NO UI caller | Soft delete + children bulk soft-delete | Correction path | Mai étkezés-sor → törlés (két lépéses) | KEEP (új UI) | Deleted meal leaves the day total | — |
| A10 | Napi étkezés-lista (lapos sorok, pontszám-chippel) | `FuelLogPage` WindowBlocks; `MealScoreSheet` | Window blocks with score pill → sheet | Daily | Mai lapos étkezés-sorok; pont-chip → score sheet | MERGE (Mai a kanonikus hely; `/fuel/log` külön oldal megszűnik) | All meals of the day listed with scores; score sheet opens | Flat rows per calibration |
| A11 | Egy-étkezés AI értékelés (score sheet + visszajelzés) | `getMealCoach` `MealCoachService.generateForMeal:116`; `MealScoreSheet.tsx`; `useFeedback('meal_coach')` | On-demand verdict; numbers never move; feedback signal | Frequent | Mai sor → score sheet (változatlan) | KEEP | Sheet shows verdict; coach off ⇒ empty, never error | — |
| A12 | Vízivás naplózás + visszavonás | `logWater` `WaterLogService:23`, `deleteWaterLog:38`; `WaterLogSheet`; optimistic update | Sheet from Mai/log/quickinput; undo last own entry | Daily | Mai víz-modul (gyűrű/sáv + gyorsgombok) | KEEP | Log + undo update day total optimistically | — |
| A13 | Múltbeli nap pótlása (7 napra vissza) | `FuelLogPage` day stepper `:140`, `?d=` clamp; `FuelLogNewPage:37` | 7-day back clamp, past=gold "Pótlás" | Weekly | Mai közös dátum-lapozás (swipe + nyilak, közös dátum a többi Mai-jal) | MERGE (közös dátum-navigációba) | Swiped-back day shows that day's meals; logging attaches to viewed day; 7-day clamp preserved | Shared date contract |
| A14 | Napi idővonal / étkezés-ablakok (slot terv szerint) | `useFuelTimeline` `timelineHooks.ts:71`; `fuelSwimlane.ts`; NapHub tile `?w=` handoff | Window lane: which window is now, budget split | Daily | Mai: ablak-jelzés az étkezés-sorokon + „most esedékes" a naplózóban | MERGE (nem külön sáv, a sorokba olvad) | `?w=` deep link still prefills window; now-window highlighted | — |
| A15 | Energia-magyarázat (TDEE/keret honnan) | `EnergyBreakdownSheet` (also used by Én hub) | Read-only provenance sheet | Occasional | Mai hero érintés → sheet (változatlan, Énnel közös) | KEEP | Sheet opens from hero; Én usage untouched | — |
| A16 | Beállítások: étkezési ritmus + makróprofil | `getFuelSettings/setFuelSettings`; `getDietSettings/setDietSettings` (+goal recompute!); `previewDietSettings`; `FuelSettingsPage` | Combined save Promise.all; diet save re-prescribes active goal; live preview | Rare but critical | Mai sarok → csendes Beállítások aloldal | MOVE | Save still triggers goal recompute; custom split 100% validation; preview matches saved numbers | Owner approved corner entry |
| A17 | Étkezés-ablak sablon szerkesztő + AI vélemény | `putSlotTemplate/deleteSlotTemplate/evaluateSlotPlan`; `FuelSlotsPage` | 3 day-types, validation collect-then-throw, AI evaluate w/ degrade | Rare | Beállítások alól nyíló aloldal (Mai → Beállítások → Ablakok) | MOVE | Template save validation + AI evaluate degrade note preserved | — |
| A18 | Kalauz (tutorial) horgonyok a Fuel oldalakon | `features/tutorial/registry/fuel.ts` | Anchors per old route | Supporting | Re-anchor to new pages | KEEP (átkötve) | Tutorial steps resolve on new routes | — |
| A19 | Gyors-gomb (FAB) és gyorsnaplózó kapcsolatok | `QuickLogFab.tsx:10`; `QuickLogSurface.tsx:70-111` (Étkezés `?w=`, Víz inline, Stack) | FAB opens sheet on fuel routes; hidden on `/fuel/log/uj` | Daily | Unchanged targets → new routes; FAB hidden on log surface | KEEP (átkötve) | Quickinput meal tile lands in camera-first logger with window prefill; water inline log works | — |
| A20 | Más oldalak Fuel-csempéi és mélylinkjei | `NapHubPage.tsx:437`, `todayItems.ts:239`, `nextStep.ts:87`, quest/habit actions, `EletjelPage:118`, `NapRutinPage:275` (LogFlow overlay) | Nap tiles/timeline/next-step link `/fuel`, `/fuel/log/uj?w=`, `/fuel/stack`, `/fuel/recipes`; two pages mount meal-log overlay | Daily | Links repointed; LogFlow overlay keeps working | KEEP (átkötve) | Nap meal tile → new logger; Eletjel/Rutin overlay logs still work | Oura rule: Nap shows slices, Fuel canonical |

## B. Konyha — receptek + kamra

| # | Capability | Evidence | Current behavior | Freq/value | New destination | Decision | Preservation test | Owner note |
|---|---|---|---|---|---|---|---|---|
| B1 | Recept mentése a Műhelyben vagy kézzel | `createRecipe`; `RecipeEditorPage`; Műhely save — **recept linkből-importálás nem létezik** (`recipe.yml`-ben nincs scrape művelet) | Editor + workshop save | Top Konyha action | Konyha gyors-művelet #1: „Recept mentése” (kézi űrlap + Műhely-átadás) | KEEP (emelt) | Create via editor and via workshop both land in library | Owner: D volt a válasz. 2026-09-11: a prototípus tévesen mutatott „Link” fület — owner döntés: kivéve, nem új képesség |
| B2 | Kamraelem felvétele kézzel/katalógusból | `createPantryItem`, `searchPantryCatalog`, `addPantryItemFromCatalog`; `AddPantryItemSheet`, `CatalogSearchSheet` | Sheet + idempotent catalog add | Top Konyha action | Konyha gyors-művelet #2: „Új elem a kamrába" | KEEP (emelt) | Manual add + catalog one-tap add work | — |
| B3 | Kamraelem betöltés fotóból (címke) | `photoExtractPantryItem` `pantry.yml:122`; `ImportItemSheet` Fotó mode | AI reads label photo → draft → confirm import | Frequent capture | Konyha „Új elem" folyamat fotó-első | KEEP | Label photo → draft → confirmed item + imports feed row | — |
| B4 | Kamraelem betöltés linkből (webshop) | `scrapePantryItem`; `ImportItemSheet` Link mode | URL → AI extract with provenance/confidence | Occasional | Ugyanott, link fül | KEEP | URL scrape → draft → import | — |
| B5 | Vonalkód / OpenFoodFacts keresés | `lookupPantryItem` `pantry.yml:84` — **backend kész, UI nincs** | Contracted+implemented, never wired | None (owner) | — | DROP a UI-scope-ból (owner 2026-09-11: „nem kell vonalkód beolvasás"); endpoint érintetlen marad | Endpoint stays contracted and untouched; still no UI caller | Explicit owner decision |
| B6 | Kamra böngészés/keresés/szűrés + elem-részletek | `getPantry`; `FuelKamraPage` (segbar, search, filters, skeleton), `KamraItemDetailPage` | Cards, filters, detail w/ macros/NOVA/source | Occasional | Konyha alsó rész: Kamra lista + részletlap | KEEP | Search/filter/detail/edit/two-step delete work | Browsing secondary |
| B7 | Kamraelem szerkesztés/törlés | `updatePantryItem/deletePantryItem`; sheets | Author-locked definition fields; two-step delete | Occasional | Részletlapon (változatlan) | KEEP | Edit + delete flows | — |
| B8 | Recept-könyvtár böngészés + részletlap | `listRecipes`; `FuelRecipesPage` (skeleton), `RecipeDetailPage` (score, serving toggle, logs) | Library + detail mosaic | Occasional | Konyha alsó rész: Receptek lista + részletlap | KEEP | Type counts, detail, score sheet, logs sheet | — |
| B9 | Recept szerkesztés/törlés | `updateRecipe/deleteRecipe`; editor, detail delete | Full-replace edit; soft delete | Occasional | Részletlap/szerkesztő (változatlan) | KEEP | Edit + delete + breakdown cache cleanup | — |
| B10 | Receptműhely (AI iteráció) | `workshopTurn` `recipe.yml:71`; `RecipeWorkshopPage` (retry, diff flash, seed via `?recipeId=`, save gate on estimate lines) | Stateless AI turns, save new/update | Valued | Konyha főoldal: saját Receptműhely-poszter (folyamatban lévő vázlat folytatásával) + recept-részletlap „Iterálás a Műhelyben”; teljes oldal élő makró-, minőség- és mikrotápanyag-előnézettel | KEEP (owner 2026-09-11: „vigyük ki a konyha főoldalra”, előnézet a recept-részletlap szerkezetével) | Turn → draft update → save; error retry preserves user text; estimate line blocks save; preview equals saved recipe page | Receptek aloldalról a Műhely-gomb lekerül |
| B11 | Recept „miért jó" pontszám | `getRecipeBreakdown`; `RecipeScoreSheet` + feedback | Lazy envelope + AI prose | Occasional | Recept-részletlap (változatlan) | KEEP | Breakdown sheet + feedback | — |
| B12 | Recept naplózása étkezésként / kamraelem naplózása | `RecipeDetailPage` Logolás → LogFlow; `KamraItemDetailPage:110` | Prefilled meal composer overlay | Frequent bridge | Részletlap → naplózó (kamera-felület kihagyva, előtöltve) | KEEP | Recipe/pantry prefill logs a meal | — |
| B13 | Csere-javaslatok (olcsóbb/jobb elem) | `PantrySuggestionResponse`; `FuelKamraPage:268` | Read-only heuristic card | Low | Konyha Kamra-rész alja (változatlan) | KEEP | Suggestions render when present | — |
| B14 | Import-előzmények (honnan jött) | `PantryImport` feed; `FuelKamraPage:281` | Provenance log | Low | Nincs külön lista; az eredet (forrás + mikor) a kamraelem-részletlap forrás-kártyáján él | DROP a lista-felületre (owner 2026-09-11: „Legutóbb érkezett nem kell, hagyjuk”); az import-rekord írása és az elemenkénti eredet megmarad | Import után az elem részletlapja mutatja a forrást és az időt; nincs feed-lista a Konyhán | Explicit owner decision |
| B15 | Bevásárlólista | **Nem létezik** (grep: 0 feature hit); szomszédos: stock/expiry mezők `SHOW_PANTRY_STOCK=false` mögött (mezo-6nu), ár-mező él, retailer enum integráció nélkül | No feature anywhere | — | — | DROP (owner 2026-09-11: „bevásárlólista sem kell") | n/a — nothing exists to remove; no follow-up | Explicit owner decision |
| B16 | Készlet/lejárat UI (flag mögött) | `SHOW_PANTRY_STOCK=false` `flags.ts:13`; mezo-6nu | 5 dormant UI surfaces; backend columns live | None (owner) | Marad flag mögött, sosem éled fel a Konyhában | DROP a redesign-scope-ból (owner 2026-09-11: „készlet sem [kell]"); backend oszlopok érintetlenek | Flag stays false; no new UI references stock | Explicit owner decision; dormant code untouched |
| B17 | „Mit főzzünk itthon lévőből" | derived (recipes × pantry); no dedicated backend | Implicit via recipe usedIn | None (owner) | — | DROP (owner 2026-09-11: „Mit főzzünk nem kell") | No such surface in Konyha; recipe detail's ingredient list unaffected | Explicit owner decision |

## C. Trendek — heti kép és hosszabb táv

| # | Capability | Evidence | Current behavior | Freq/value | New destination | Decision | Preservation test | Owner note |
|---|---|---|---|---|---|---|---|---|
| C1 | Heti ritmus nézet | `getFuelWeek` `FuelDayService.getWeek:107`; `FuelPlanPage`; `useFuelWeek` (no param, current week) | Weekly stats read-only page | Weekly | Trendek hero: „Jól ment a hetem?" napok a kerethez képest | MERGE (`/fuel/plan` megszűnik, Trendek a kanonikus) | Week days vs target render; weekday/weekend contrast visible | Hero per owner |
| C2 | Heti származtatott átlagok (étkezés-pontszám, súly) | `FuelWeekResponse.mealScoreAvg/weightAvgKg` computed `FuelDayService:122` — **mapper eldobja** `mealApi.ts:251` | Computed, thrown away at FE boundary | Free win | Trendek: heti minőség-átlag + súly-átlag | KEEP (bekötve) | Mapper passes both; UI renders honest-null | Backend already pays for it |
| C3 | Evés × súly hosszabb táv | `MetricSeriesService` DAILY_KCAL/PROTEIN/MEAL_SCORE/WATER + weight series (Én) | Series exist for insights/Én | Owner wants | Trendek 2. réteg: hetek-hónapok, evés és súly együtt | KEEP (új nézet meglévő adatból) | Long-horizon chart renders from existing series | No new backend |
| C4 | Táplálkozási mintázatok/felismerések | insights/flag rules (LoadFuelMismatch, MealRhythmDrift, EnergyDipMealTiming…) canonical in Mezo | Live in Mezo depth | Owner wants visible | Trendek 3. réteg: kanonikus Mezo-elemekre mutató sorok, NEM másolat | MERGE (Mezo marad kanonikus, Trendek hivatkozik) | Pattern row links to the Mezo canonical item | Anti-duplication rule |
| C5 | Étkezés-előzmények / AI-pontszám napló | `FuelNaploPage` (today's scores only); `getMealCoachForDay` cache; `useMealCoach` day-batch hook **unused** | Today-only score list; honest no-week-trend line | Occasional | Trendek: napi minőség-sor a heti képben; `/fuel/naplo` megszűnik | MERGE | Day quality data visible in Trendek; coach cache-only for history preserved (no historical generation) | Coach: history is cache-only |
| C6 | Heti edzés/gyógyszer/kiegészítő heti sáv (Plan oldal részei) | `FuelPlanPage` gym schedule, volleyball, med strip, weekly supplement map | Read-only weekly context | Low | Trendek heti kép kontextus-sávja (kompakt) | MERGE | Training days marked in the week view | — |

## D. Kiegészítők — mai adag és protokoll

| # | Capability | Evidence | Current behavior | Freq/value | New destination | Decision | Preservation test | Owner note |
|---|---|---|---|---|---|---|---|---|
| D1 | Mai szedési lista + pipálás + visszavonás | `listIntakes/logIntake/deleteIntake`; `useStackIntakeToggle` (undo toast); `FuelStackPage`, `FuelStackTodayPage` | Next-due + tick, day progress, timed day | Daily, protagonist | Kiegészítők főnézet: idősávos mai lista, egyérintés + visszavonás | MERGE (Stack hub + Today egy oldalba) | Tick + undo update intake; dose snapshot preserved | Owner: A |
| D2 | Protokoll megtekintés (mit miért, elhelyezés) | `getProtocol` (lazy backfill write-on-read!); `FuelStackProtocolPage` (explicit error branch) | Living protocol + placement provenance | Weekly | Kiegészítők 2. szint: Protokoll | KEEP | Protocol renders; read-path backfill untouched (`ProtocolService:63` stays transactional) | Trap §6.5 |
| D3 | Protokoll szerkesztés (felvétel/mozgatás/adag/kivétel) | `addProtocolItem/patchProtocolItem/deleteProtocolItem`; `StackItemSheet`; manage pages; `FuelStackAddPage` | Placement engine on add; pinned rules; zone collision walk | Occasional | Kiegészítők 2. szint: Kezelés (a 4 manage-oldal összevonva) | MERGE | Add w/o slot → engine places; pinned+unpin 400 rule; duplicate 409 | 4 manage routes → 1 |
| D4 | Étkezés-kötések és vélemények (stack×meals) | `FuelStackMealsPage`, `FuelStackManageMealsPage` | Read-only bindings/verdicts | Low | Kiegészítők 2. szint alrésze | MERGE | Bindings visible | — |
| D5 | Gyógyszer-követés (üres állapot + teljes életciklus) | medication API; `FuelMedicationPage` (live=empty branch, mezo-lwmq); notification anchor `/fuel/gyogyszer` | Production-empty by owner decision; populated branch fixture-only | Rare/owner | Kiegészítők alól érhető el (változatlan viselkedés, üres állapot él) | KEEP (változatlan) | Empty state renders; deep link target survives (redirect if route moves); Europe/Budapest cycle zone untouched | Do NOT revive or drop |
| D6 | Beadás-visszavonás (dose undo) | `deleteDose` `MedicationService.deleteDose:101` — **NO UI** | Backend only | Correction | — (marad UI nélkül, amíg a gyógyszer-oldal üres) | KEEP (backend, UI nélkül) | Endpoint untouched | Consistent with D5 |
| D7 | Protokoll-verziótörténet | `ProtocolViewResponse.history[]` mapped, never rendered | Data in state, invisible | None | — (adat-szinten marad, UI nélkül) | KEEP (owner 2026-09-11) | `history[]` mapping preserved in state | Owner approved: stored, no UI |
| D8 | Replan-forgatókönyvek (halott felület) | `ReplanSheet.tsx` 244 sor, 0 consumer; `useReplanScenarios` mock-only `fuelReadHooks.ts:12` | Dead code, mock-only data | None | — | DROP (owner 2026-09-11: kódtisztítás jóváhagyva) | `ReplanSheet.tsx` + test + `useReplanScenarios` removed; no route/consumer breaks | Explicit owner decision |
| D9 | Stack push-értesítések és mélylinkek | `notificationScheduleWriter.ts:21` FUEL_SLOT→`/fuel/stack`; habit `morning_coffee`→`/fuel/stack` | FE-written schedule rows; category key contract | Automatic | Deep link retarget to new Kiegészítők route (redirect old) | KEEP (átkötve) | Push entries resolve to the new route; category key unchanged | Trap §6.2 |

## E. Háttér- és keresztirányú képességek (láthatatlan, de kötelező sor)

| # | Capability | Evidence | Decision | Preservation test |
|---|---|---|---|---|
| E1 | Goal-engine célszámítás + diétamentés-recompute | `DietSettingsService.setSettings:74` (7th trigger) | KEEP | Saving diet settings recomputes active goal (IT exists) |
| E2 | Írás-idejű makró-fagyasztás + 8-dim pontozás (FORMULA_VERSION 5) | `MealService.buildItem:309`, `applyScore:228` | KEEP | Logged meal snapshot independent of later catalog edits |
| E3 | Edzés-tudatos étkezés-szerep (pre/post ablakok) | `MealService.classifyRole:232` | KEEP | Meal near workout gets role overlay |
| E4 | Nap-típus: tervezett edzés dönti a keretet, ad-hoc nem | `DayTargetProjector` + `hasScheduledTrainingOn` | KEEP | Ad-hoc session does not flip day budget |
| E5 | Companion read-only tool-ok (get_fuel_log/get_protocol/get_recipes/get_pantry/get_medication) | `FuelTools.java`, `MedicationTools.java` | KEEP | Tools answer unchanged shapes |
| E6 | Kontextus-blokkok, flag-szabályok, proaktív próbák, karakter-detektorok, habit/quest kiértékelők, insights-sorozatok | backend audit §5 | KEEP | Read shapes unchanged; no rename of consumed fields |
| E7 | Query-invalidációs háló (meal→habitDay/dailyQuests; diet→goals; medication→today) | `fuelHooks.ts:64-71` etc. | KEEP | Cross-domain invalidations preserved in new hooks usage |
| E8 | Dual-mode adathorgok azonos publikus viselkedéssel | `data/fuel/*` (audit §3) | KEEP | Both modes tested per gate |
| E9 | AI-draft eredményjelzés (draftId → outcome) | `MealAiDraftService` draftId; aidraft block | KEEP | Outcome signal still sent on save/discard |
| E10 | Étkezés-provenance (manual/ai-text/ai-photo) tárolása | `MealService:88`; never surfaced | KEEP (owner 2026-09-11: tárolva marad, UI-jelölés nem kötelező) | Provenance still written |
| E11 | Kalauz/tutorial route-felfedezés | `tutorial/registry/fuel.ts` | KEEP (átkötve) | Registry updated to new routes |
| E12 | Feature-kapcsolók és degradációk (meal-ai, coach, slot-ai, fuel/diet-settings) | backend audit §4 | KEEP | Coach off ⇒ 200+empty; LLM off ⇒ 503 handled |

## F. Új képesség a prototípus-iterációból

| # | Capability | Evidence | Current behavior | Freq/value | New destination | Decision | Preservation test | Owner note |
|---|---|---|---|---|---|---|---|---|
| F1 | Mikrotápanyagok (vitaminok, ásványi anyagok) tárolása és megjelenítése | Ma csak `fiberG/sugarG/saltG/saturatedFatG` létezik: `Nutrients` (`meal.yml`, `pantry.yml`, `openapi.yml`), `pantry_item`/`pantry_catalog`, `recipe_ingredient` és `meal_item` snapshot (mezo-m6uv), `OffClient` nutriments, `pantry-catalog.json`; kapcsolódó: mezo-kz8s | Nincs vitamin/ásványi anyag adat sehol | Owner-érték: magas | Étel-részletlap Mikrotápanyagok rész, kamraelem-részlet, recept-részlet; AI-kinyerés az étkezés-, kamra- (fotó/link) és recept-folyamatban | KEEP (új képesség, owner 2026-09-11: „vegyük fel tervbe… kamra elemekhez is, receptekhez is meg az AI-nak is kiszednie") — külön bd feature, sorrendezés owner-döntésre vár | Mentett étel/kamraelem/recept mikrotápanyag-értékei visszaolvashatók; ismeretlen = null, soha nem 0 | Addig a Mikrotápanyagok rész a rost/cukor/só/telített zsír sorokat mutatja |
| F2 | Kiegészítő-adagoló tanácsadó (termék címkéje → napi mennyiség, hány egység, mikor) | Ma: `PlacementRules` 9 szabálya (zóna + magyar indoklás), `PlacementEngine.dailyTotalHint` (CSAK kreatinra), `StackPlacementLlm` fallback, `pantry_item.dose` szabad szöveg | A „mennyit ebből a termékből” kérdésre nincs válasz | Owner-fájdalom: minden új termék vásárlásakor | Kiegészítők → Protokoll (adag+időzítés nézet) és Kezelés → 3 lépéses beállító (kamra / címkefotó / kézzel → címkeadatok → javaslat) | KEEP (új képesség, owner 2026-09-12) — külön bd feature: `mezo-nmzh`, a Fuel szelet után | Ismert hatóanyagnál a javaslat megadja a napi mennyiséget, a termék egységeit és az idősávot az indoklással; ismeretlennél nem talál ki adagot, hanem kézi megadást kér | „nem orvosi tanács” határ kötelező; a mentés előtt a felhasználó módosíthat |

## Route/felület-leltár lezáráshoz

22 mai route + 15 sheet + 4 LogFlow overlay belépő lefedve a fenti sorokban; új szerkezet:
`/fuel` (Mai) · `/fuel/log/uj`→ új naplózó (kamera-első) · Konyha (`/fuel/konyha` + recept/kamra
al-route-ok) · Trendek (`/fuel/trendek`) · Kiegészítők (`/fuel/stack` konszolidálva) ·
Beállítások + Ablakok a Mai sarkából. Megszűnő route-ok (`/fuel/log`, `/fuel/plan`,
`/fuel/naplo`, 4 manage-oldal) MERGE-sorai fent; régi mélylinkek redirectet kapnak.

## Coverage closure record — CLOSED 2026-09-11

| Check | Evidence |
| --- | --- |
| CODEMAP freshness | `node scripts/gen-codemap.mjs --check` ✅ up to date at commit 4f656db9f |
| Domain closure | All 6 primary blocks + related checks classified; no `UNKNOWN` remains in this record |
| Backend closure | 2026-09-11 backend audit (32 ops mapped through services/entities/jobs/security; §6 break-risks listed) |
| Frontend closure | 2026-09-11 frontend audit (22 routes, 15 sheets, all hooks, quick actions, deep links, cross-domain readers) |
| Owner closure | 4 Hungarian batches approved 2026-09-11 (Mai, Konyha, Trendek, Kiegészítők+background). Explicit owner DROPs: B5 (barcode UI), B15 (shopping), B16 (stock UI revival), B17 (mit főzzünk), D8 (ReplanSheet dead code). Explicit KEEPs incl. new UI: A6 (voice wiring), A7 (szokásosak), A8/A9 (meal edit/delete UI), C2 (week-avg wiring), D7/E10 (stored, no UI) |
| Prototype scope | All four pages: Mai hero+rings+flat rows+camera-first logger (photo/voice/text/szokásosak tabs, edit/delete, past-day), Konyha two quick-captures + libraries, Trendek weekly hero + long horizon + pattern links, Kiegészítők time-band checklist + protocol/manage; states: empty/historical/AI-failure/loading/reduced-motion |
| Preservation scope | Every KEEP/MERGE row's Preservation test column; E1–E12 background tests mandatory |

**Prototype approved by the owner on 2026-09-12 — this manifest is FROZEN for implementation**
(handoff §4). New evidence can reopen a row, but Claude must surface the contradiction rather than
silently changing scope. Implementation slices: `mezo-o6uv` (S0 shell) → `mezo-33k6` (S1 Mai),
`mezo-g2vl` (S2 Kiegészítők), `mezo-83g0` (S3 Trendek), `mezo-hygp` (S4 Konyha) → `mezo-qt5q`
(S5 cleanup). Follow-up capabilities outside this slice: `mezo-vj61` (micronutrient storage),
`mezo-nmzh` (supplement dose advisor).

---

## Delivery record — MANIFEST CLOSED 2026-09-12 (S5, `mezo-qt5q`)

Every row above is accounted for below: the decision as frozen, and **where it actually landed**. The
DROPs and DEFERs are restated in full at the end so a future reader cannot mistake an owner decision
for a gap. Slices: `mezo-o6uv` (S0 shell) → `mezo-33k6` (S1 Mai) → `mezo-g2vl` (S2 Kiegészítők) →
`mezo-83g0` (S3 Trendek) → `mezo-hygp` (S4 Konyha) → `mezo-qt5q` (S5 closure).

### A. Mai — delivered

| Row | Decision | Landed in |
|---|---|---|
| A1 | KEEP | `components/FuelEnergyHero.tsx` — bowl-in-arc gauge, the REMAINING kcal as the one number; goal-driven target unchanged (S1a) |
| A2 | KEEP | `components/FuelMacroRings.tsx` — five rings (P/C/F/rost/víz), staggered rise (S1a) |
| A3 | KEEP | `/fuel/log/uj` + `components/MealComposer.tsx` — pantry/recipe/estimate lines unchanged (S1c) |
| A4 | KEEP (emelt) | `components/FuelLogModes.tsx` — the camera tab opens first (S1c) |
| A5 | KEEP | the Gépelés tab of the same shell (S1c) |
| A6 | KEEP (új összekötés) | the Hang tab: `transcribe` → AI text draft (`MealComposer.voice.test.tsx`, S1c) |
| A7 | KEEP (új) | `logic/usualMeals.ts` `rankUsualMeals` + the Szokásosak tab (S1c) |
| A8 | KEEP (új UI) | meal edit in the logger (`MealComposer.edit.test.tsx`, S1c) |
| A9 | KEEP (új UI) | two-step delete on the meal detail page (S1b) |
| A10 | MERGE | `components/FuelMealBlocks.tsx` on the Mai; `/fuel/log` RETIRED → `/fuel` (S1b + S5) |
| A11 | KEEP | `sheets/MealScoreSheet.tsx` + `/fuel/etkezes/:id/ertekeles` (S1b) |
| A12 | KEEP | `components/FuelWaterModule.tsx` + `sheets/WaterLogSheet.tsx` with session undo (S1d) |
| A13 | MERGE | the Mai's own `?d=` pager; `logic/backfillWindow.ts` is the ONE 7-day rule (S1d) |
| A14 | MERGE | the window bar folded INTO each block; `?w=` deep link preserved (S1b) |
| A15 | KEEP | the shared `sheets/EnergyBreakdownSheet.tsx`, Én usage untouched (S1a) |
| A16 | MOVE | the quiet corner `.fmx-corner` → `/fuel/settings`; the diet save still re-prescribes the goal (S1d) |
| A17 | MOVE | `/fuel/slots`, reached from under Beállítások (S1d) |
| A18 | KEEP (átkötve) | `registry/fuel.ts` re-anchored; new anchors `trendek-heti`, `konyha-felvetel`; a new lint forbids a retired-path route or chip (S5) |
| A19 | KEEP (átkötve) | FAB targets repointed, still hidden on the logger route (S1d) |
| A20 | KEEP (átkötve) | only the Nap fuel row actually moved; the LogFlow overlay untouched (S1d) |

### B. Konyha — delivered

| Row | Decision | Landed in |
|---|---|---|
| B1 | KEEP (emelt) | the Konyha hub's „Recept mentése" capture → `/fuel/recipes/new` (S4) |
| B2 | KEEP (emelt) | the hub's „Új elem a kamrába" capture → `sheets/ImportItemSheet.tsx` (S4) |
| B3 | KEEP | the same sheet's photo mode (S4) |
| B4 | KEEP | the same sheet's link mode (S4) |
| B5 | **DROP** (owner) | barcode UI never built; `lookupPantryItem` endpoint untouched and still UI-less |
| B6 | KEEP | `/fuel/kamra` Titanium shelf + `/fuel/kamra/:id` (S4) |
| B7 | KEEP | the detail page's edit + two-step delete (S4) |
| B8 | KEEP | `/fuel/recipes` tile grid + `/fuel/recipes/:id` (S4) |
| B9 | KEEP | `/fuel/recipes/:id/edit` + detail delete (S4) |
| B10 | KEEP | `/fuel/recipes/muhely` with a live recipe-detail-shaped preview; the Műhely button moved to the hub poster (S4) |
| B11 | KEEP | `sheets/RecipeScoreSheet.tsx` (S4) |
| B12 | KEEP | recipe/pantry → prefilled logger (S4) |
| B13 | KEEP | `components/SuggestionCard.tsx` at the bottom of the Kamra (S4) |
| B14 | **DROP** (owner, list only) | no imports feed; the per-item `Forrás` card on `/fuel/kamra/:id` carries provenance, and the import record is still WRITTEN |
| B15 | **DROP** (owner) | shopping list: nothing existed, nothing built, no follow-up |
| B16 | **DROP** (owner) | `SHOW_PANTRY_STOCK` stays false; no new UI references stock/expiry |
| B17 | **DROP** (owner) | no „mit főzzünk" surface |

### C. Trendek — delivered

| Row | Decision | Landed in |
|---|---|---|
| C1 | MERGE | `/fuel/trendek` weekly picture; `/fuel/plan` RETIRED → `/fuel/trendek` (S3 + S5) |
| C2 | KEEP (bekötve) | the mapper now passes `mealScoreAvg` + `weightAvgKg`; two stat tiles render them honest-null (S3) |
| C3 | KEEP | `components/FuelHorizon.tsx` — intake × weight on one axis, from existing series (S3) |
| C4 | MERGE | `logic/fuelPatternRefs.ts` — REFERENCES into the canonical Mezo item, never a copy (S3) |
| C5 | MERGE | the day glass box's meal list + day score; `/fuel/naplo` RETIRED → `/fuel/trendek`; coach history stays cache-only (S3 + S5) |
| C6 | MERGE | training days marked in the week view (`MeWeekDay.workoutCount`); the Plan page's caffeine/kitchen legend was NOT carried over — it was never in the manifest's new destination (S3) |

### D. Kiegészítők — delivered

| Row | Decision | Landed in |
|---|---|---|
| D1 | MERGE | `/fuel/stack` is hub + timed day in one page; `/fuel/stack/today` RETIRED → `/fuel/stack` (S2 + S5) |
| D2 | KEEP | `/fuel/stack/protocol`; the read-path lazy backfill untouched (S2) |
| D3 | MERGE | editing IS `sheets/StackItemSheet.tsx` opened from a Protokoll row; all four `manage/*` pages RETIRED → `/fuel/stack/protocol` (S2 + S5) |
| D4 | MERGE | the Protokoll page's `.fsx-proto-meals` sub-section (`matchMealsToStack` + `StackMealMatch`); **this retired `/fuel/stack/meals` too — a correction to the S5 plan's first draft, which had only listed the four `manage/*` pages** (S2 + S5) |
| D5 | KEEP (változatlan) | `/fuel/gyogyszer` unchanged, empty state alive, deep-link target survives |
| D6 | KEEP (backend, UI nélkül) | `deleteDose` untouched, still no UI |
| D7 | KEEP (owner) | `history[]` still mapped into state, still no UI |
| D8 | **DROP** (owner) | `ReplanSheet.tsx` + its test + `useReplanScenarios` + the seed + the types deleted in S2 |
| D9 | KEEP (átkötve) | `notificationScheduleWriter.ts` FUEL_SLOT → `/fuel/stack` unchanged; the retired stack paths redirect (S5) |

### E. Background — verified in S5, not modified

See the S5 verification pass: every row confirmed against its evidence, each with the test that pins
it. **One row did NOT hold and was fixed: E9.** The AI draft outcome signal was reported from
`logMeal`'s per-call `onSuccess`, and TanStack binds those callbacks to the observer — so they are
dropped when the caller unmounts before the mutation settles. The full-page logger (`/fuel/log/uj`)
navigates away the instant it saves, and the discard guard had already claimed the draft id, so an
AI-drafted meal saved from that route reported **neither** accepted/edited **nor** discarded. This
predates the rebuild (the route and its `?ai=1` deep link already existed); it surfaced only because
S5 pins the invisible rows on the rebuilt path rather than trusting the overlay's coverage.

Fix: `useMealActions` gained `logMealAsync` (resolves from the mutation itself, so it survives the
unmount) and `MealComposer`'s AI branch uses it. A failed save still reports nothing — the draft was
never accepted. Pinned by `pages/FuelLogNewPage.provenance.test.tsx` (E9 + E10 on the rebuilt route)
and `data/fuel/dietSettingsHooks.test.tsx` (E1/E7/E8, a hook that had no test at all). Every other
row held with no production change.

### F. New capabilities — DEFERRED, not dropped

| Row | State | Tracking |
|---|---|---|
| F1 | Micronutrient storage + AI extraction end-to-end is **DEFERRED** to its own feature slice. Until then the Mikrotápanyagok section shows the rost/cukor/só/telített-zsír rows that DO exist (`components/MicroPanel.tsx`) — it is not a placeholder for absent data. | `mezo-vj61` |
| F2 | The supplement dose advisor's **backend** is DEFERRED. The frontend-side `logic/doseAdvice.ts` heuristic shipped with S2, but the real label→dose advice needs the backend slice. | `mezo-nmzh` |

### Found during delivery — filed, deliberately not fixed here

| Issue | Why it is not part of this rebuild |
|---|---|
| `mezo-0dws` — meal edit silently drops the stored provenance (write-only field) | A backend/contract bug on an existing field (E10 writes provenance; the edit path replaces it). Fixing it inside a UI slice would have changed a write contract the manifest froze. |
| `mezo-rm6ps` — the pantry import returns void, so the dose setup cannot save a brand-new product in one pass | Needs the import endpoint to return the created id — an API change, and the dose advisor's backend (`mezo-nmzh`) is where it belongs. |

### Closure gates (S5)

| Check | Evidence |
|---|---|
| No retired route 404s | `frontend/src/app/router.fuelRetiredRedirects.test.tsx` — every row of `FUEL_RETIRED_REDIRECTS` redirects, the target is itself never retired, `?d=` survives, and the surviving siblings (`/fuel/stack/manage/add`, `/fuel/log/uj`) stay live |
| Kalauz points only at live pages | `registry.test.ts` „egyetlen kalauz-bejegyzés és -chip sem mutat leváltott Fuel-útvonalra" + `anchors.test.tsx`'s Fuel round |
| Deletions proven dead | per-candidate grep before each removal; coverage ported, never dropped (`FuelRecipesPage.perServing.test.tsx`, the Trendek-tile honest-null round) |
| Both FE modes + build | mock and real suites green, `pnpm build` green |
| CODEMAP freshness | `node scripts/gen-codemap.mjs --check` ✅ |
