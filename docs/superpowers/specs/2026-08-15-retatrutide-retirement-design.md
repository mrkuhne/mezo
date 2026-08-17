# Retatrutid kivezetése — design spec

- **Dátum:** 2026-08-15
- **Driving bd:** `mezo-lwmq`
- **Kiváltó ok:** a tulajdonos nem szedi többé a retatrutidot, és a szert **mindenhonnan** ki akarja vezetni az appból.
- **Előzmény:** a gyógyszer-slice eredeti terve ([`2026-06-26-fuel-medication-design.md`](2026-06-26-fuel-medication-design.md)) — az ott rögzített, retatrutid köré épült névadást (`retaDay`, `RETA_*`, `reta-*` mintapárok) ez a spec vezeti ki. A régi spec **befagyasztott artefaktum**, nem íródik át.

## 1. Cél

Két, egymástól élesen elváló dolgot csinálunk egyszerre. A megkülönböztetés a spec gerince:

1. **A retatrutid mint *adat és tartalom*** — nyomtalanul eltűnik: a seed, az eltárolt DB-sorok, a mock-narratíva, a promptpéldák és minden UI-szöveg.
2. **A „reta" mint *domain-szótár*** — generikus gyógyszer-fogalmakra cserélődik. A gyógyszer-követés mint képesség **megmarad**, csak márkanév nélkül.

**Nem célja** a gyógyszer-feature törlése, sem a szabad szöveges LLM-előzmények visszamenőleges átírása.

## 2. A gyógyszer-slice végállapota

A slice technikailag már ma generikus — a `MedicationEntity` név + hatóanyag + ciklus-konfiguráció, a ciklusnapot a `MedicationCycleService` a legutóbbi dózisból származtatja. Retatrutid-specifikus csak (a) a seedelt sor és (b) a névadás.

**A tab tartósan üres marad.** A slice-nak nincs `POST /api/medication` végpontja — a szer *létezését* ma kizárólag a `MedicationDemoLoader` seed teremti meg. A loader törlésével nincs aktív gyógyszer, és nem is lesz felvehető. Ez **tudatos döntés, nem hiányosság**: a tulajdonos nem tervez gyógyszert szedni, és a felvételi út megépítése YAGNI lenne. Ha valaha kell, az saját spec + bd issue lesz (`POST /api/medication` + „＋ Gyógyszer hozzáadása" sheet).

A backend az üres állapotot **már ma őszintén kezeli** — a `cycleDay == 0` az „nincs rögzített dózis" jelentés, nem hiba:

| Fogyasztó | Mai viselkedés `cycleDay == 0` / nincs gyógyszer esetén |
|---|---|
| `AnchorResolver.medicationAnchor` | `Optional.empty()` — nincs értesítés-horgony |
| `MedicationTools` (companion tool) | `ToolText.NO_DATA` |
| `DailySummaryService`, `ContextSnapshotAssembler` | a Gyógyszer-blokk kimarad a snapshotból |
| `MetricSeriesService` | a napot kihagyja a sorozatból (`cycleDay > 0` szűrő) |
| `notificationForecast` (FE) | nem számol gyógyszer-értesítést |

Vagyis a backend oldalon **nincs új üres-állapot logika** — csak a seed tűnik el. A hiányzó darab a frontend (§5).

## 3. Névtérkép

A `cycleDay` a gyógyszer-kontraktus szintjén él (a `MedicationCycle`-ön belül egyértelmű: `med.cycle.cycleDay`), a Today-rétegben viszont `medCycleDay` — egyrészt mert a Today-ban létezik mezociklus-fogalom is (`mesoPhase`), másrészt mert a `NotificationsPage` már használ egy `medicationDay: boolean` mezőt („ma beadás-nap?"), amivel egy `medicationDay: number` ütközne.

| Most | Ezután | Hol |
|---|---|---|
| `retaDay` | `cycleDay` | `api/feature/medication/medication.yml` → `api/openapi.yml` → `frontend/src/data/_client/api.gen.ts`; `MedicationCycle` record; `MedicationMapper` |
| `TodayMeta.retaDay`, `TodayScenario.retaDay`, `?retaDay=` | `medCycleDay`, `?medCycleDay=` | `data/types.ts`, `data/today/todayHooks.ts`, `data/today/today.ts` |
| `RetaWeekStrip` | `MedicationWeekStrip` | `features/fuel/components/` |
| `RetaDayCell`, `RetaPhase` | `MedCycleDayCell`, `MedCyclePhase` | `data/types.ts` |
| `retaWeek`, `toRetaCells` | `medCycleWeek`, `toMedCycleCells` | `data/fuel/fuelWeek.ts`, `fuelWeekHooks.ts` |
| `MetricKey.RETA_CYCLE_DAY` („Reta-ciklusnap") | `MEDICATION_CYCLE_DAY` („Gyógyszer-ciklusnap") | `feature/companion/service/MetricKey.java` |
| `MetricKey.RETA_DOSE_MG` („Reta-dózis") | `MEDICATION_DOSE_MG` („Gyógyszer-dózis") | ugyanott |
| pár-kulcs `reta-cycle-day~daily-kcal` | `medication-cycle-day~daily-kcal` | `application.yml` + adatmigráció (§4) |
| pár-kulcs `reta-dose~daily-kcal` | `medication-dose~daily-kcal` | ugyanott |
| metrika-kulcsok `reta-cycle-day`, `reta-dose-mg` | `medication-cycle-day`, `medication-dose-mg` | `application.yml` `metric-a`/`metric-b` |
| companion tool `scope=reta`, `get_reta_cycle` | `scope=cycle` | `MedicationTools` + a `ChatService.SYSTEM_PROMPT` `[Eszköz-útmutató]` sora |
| CSS `--reta-d1…--reta-d7` | `--medcycle-d1…--medcycle-d7` | `styles/prototype.css` — a sage→amber rámpa **színértékei változatlanok** |
| CSS `.reta-bar`, `.reta-seg`, `.retamicro` | `.medcycle-bar`, `.medcycle-seg`, `.medcycle-micro` | ugyanott |
| notification-label „Reta injekció" | „Gyógyszer beadás" | `data/types.ts` értesítés-katalógus |

A `mezo.companion.patterns.pairs[].title` / `question` / `mechanism` szövegek is generikusra íródnak („Gyógyszer-ciklusnap ↔ napi kalória"; „Kevesebbet eszel magasabb dózison?").

## 4. Adat és migráció

Egy Liquibase changeset, `202608151200_mezo-lwmq_retire_retatrutide.sql`, két lépéssel:

1. **`DELETE FROM medication_dose`** a tulajdonos gyógyszeréhez tartozó dózisokra, majd **`DELETE FROM medication`**. Ez **tudatos fizikai törlés**, szemben a repo `is_deleted` soft-delete konvenciójával: a kivezetés célja épp az, hogy ne maradjon nyom, és egy soft-deleted sor a nevet a DB-ben hagyná. A spec ezt explicit kivételként rögzíti; a normál törlési utak változatlanul soft-delete-elnek.
2. **`UPDATE pattern SET pair_key = …`** a két átnevezett kulcsra. A `pattern` egyediség-indexe `uq_pattern_created_by_kind_pair_key (created_by, kind, pair_key) WHERE is_deleted = false`, és a `PatternEntity` kommentje kifejezetten tiltja élő kulcs átnevezését adatmigráció nélkül — enélkül a meglévő minta-sorok elárvulnának, és a nightly job újakat hozna létre nulla előzménnyel.

A `pattern_event` **nem** hordoz `pair_key`-t (csak `pattern_id` FK-t), így a kapcsolódó események a `pattern` sor frissítésével automatikusan együtt mozognak — nincs harmadik lépés.

**A `MedicationDemoLoader` törlődik** (osztály + a `demodata` profilhoz kötött regisztrációja). A `MedicationPopulator` a teszt-oldalon **megmarad** — az integrációs tesztek továbbra is felvesznek gyógyszert, hogy a generikus slice működését bizonyítsák, csak nem retatrutidot (semleges tesztnév).

**Nem nyúlunk** a szabad szöveges LLM-előzményekhez (`ai_message`, `daily_summary`, `briefing`, `heartbeat_note`, `weekly_suggestion`, `knowledge_fact`, `learned_fact`, `memoir`, `memory_embedding`). Azok időbélyegzett történelem arról, ami akkor igaz volt; visszamenőleges átírásuk lyukas chat- és összefoglaló-előzményt hagyna.

## 5. Frontend — az üres állapot

Ez az egyetlen hely, ahol **új** viselkedés kell.

- **`FuelMedicationPage`** ma feltétel nélkül dereferálja a `med`-et (`med.route`, `med.cadence`, `cycle.phaseLabel.split(…)`). Kap egy üres-állapot ágat: ha nincs aktív gyógyszer, egy „Nincs aktív gyógyszer" üzenet áll a kártya + ciklussáv + dózisnapló + „＋ Beadás" gomb helyén. A `LogDoseSheet` elérhetetlenné válik (nincs mihez dózist rögzíteni).
- **`useMedication`** mock seedje (`data/fuel/medication.ts`) és az MSW handler (`test/msw/handlers.ts`) a „ghost" alakra vált — nincs gyógyszer, `cycleDay: 0`, üres `week` és `recentDoses`. Ez mindkét módban ugyanazt az üres állapotot adja.
- **`useTodayScenario`** mock-ági `today.retaDay` fallbackje megszűnik. Ma a hook `isMockMode() ? today.retaDay : cycle.retaDay || today.retaDay` — a kitalált 3-as alapérték kikerül, mindkét ág a valós ciklusra ül, ami így 0. A `?medCycleDay=` URL-override **megmarad** fejlesztői kapcsolóként (továbbra is 1–7-re klamppolva).
- **`FuelPlanPage`** heti csíkja már ma `retaWeek.length > 0`-ra feltételes → üres ciklusnál magától eltűnik, nincs teendő a feltételen túl az átnevezésen.
- **`NotificationsPage`** `medicationDay: medicationCycle.cycleDay > 0` marad — üres ciklusnál a gyógyszer-értesítés eleve nem számít bele az előrejelzésbe.

## 6. Tartalom

| Hely | Változás |
|---|---|
| `data/fuel/fuel.ts` | a stack-sor (`id: 'reta'`, „Retatrutide", „Eli Lilly · klinikai") **törlődik** |
| `data/me/goals.ts` | identitás-keret, cél-fázis címke/indoklás és a súlynapló-jegyzetek „Reta cycle" említései gyógyszer-független megfogalmazásra |
| `data/train/train.ts` | MRV-jegyzet, mezociklus-jegyzetek és a PR-ablak indoklás („Reta D3 + 7h alvás") gyógyszer-független tényezőkre |
| `data/insights/insights.ts` | a „Reta beadás + 36h ablakban étvágy lefulladás" minta **cserélődik** egy gyógyszer-független mock-mintára — ezt nem lehet átnevezni, mert a jelentése maga retatrutid-specifikus. A `pairKey`, a szöveg és a `insightsData.test.tsx` várt címe együtt mozog |
| `ChatService.SYSTEM_PROMPT` | a dózistanács-tilalom „(pl. retatrutid)" példája kikerül; **a tilalom maga marad** |
| `BriefingGenerator`, `WeeklySuggestionGenerator`, `HeartbeatGenerator` | ugyanaz a promptpélda-eltávolítás |
| `MedicationTools` `@Tool` leírás | a „retatrutid-ciklusállása" megfogalmazás generikusra; a `Használd, amikor …` trigger-záradék megmarad (lásd `companion_tool_conventions.md`) |

**Az `rx-terms` lista változatlan** (`[retatrutid, reta, tirzepatid, mounjaro, szemaglutid, ozempic, wegovy]`). Ez nem a tulajdonos gyógyszereinek nyilvántartása, hanem a `ClinicalOutputCheck` determinisztikus őrének szótára: akkor is véd, ha a téma szóba kerül. A listán szereplő többi szer sem olyan, amit a tulajdonos szed. Ez a spec egyetlen tudatos kivétele a „mindenhonnan" alól, és a §1 értelmében nem *adat*, hanem biztonsági mechanizmus.

## 7. Dokumentáció

**Frissül** (élő dokumentumok): `docs/features/fuel.md`, `companion.md`, `today.md`, `proactive.md`, `_platform-design-system.md`, `_platform-data-layer.md`, `_platform-notifications.md`; `docs/references/companion_tool_conventions.md`; `docs/guides/companion-hogyan-mukodik.md`; `docs/milestones/roadmap.md`; `docs/decisions/0005-pantry-item-supersedes-food-item-supplement-intake-fk.md`.

**Új ADR** rögzíti magát a döntést: a gyógyszer-domain generikussá tétele, a tartósan üres tab, a fizikai törlés soft-delete helyett, és az `rx-terms` kivétel.

**Érintetlen** (befagyasztott, pont-az-időben artefaktumok — a CLAUDE.md tiltja az átírásukat): `docs/superpowers/specs/*`, `docs/superpowers/plans/*`, `docs/old docs/*`, `docs/design/ux-*.html`. Ezekben a „reta" történelmi tény arról, ami akkor volt; a git history amúgy is megőrzi.

## 8. Sorrend és kapuk

Kontraktus-first (`api_contract_conventions.md`):

1. `api/feature/medication/medication.yml` — `retaDay` → `cycleDay`
2. `cd api/generate && npm run generate:api` → `api/openapi.yml`
3. `cd frontend && pnpm generate:api` → `src/data/_client/api.gen.ts`
4. Backend: `MedicationCycle`, mapper, `MedicationTools`, `MetricKey`, `application.yml`, promptok, `MedicationDemoLoader` törlés, Liquibase changeset
5. Frontend: típusok, hookok, komponens-átnevezések, üres állapot, CSS tokenek, mock-tartalom
6. Tesztek: backend IT-k (`MedicationApiIT`, `CompanionToolsRenderIT`, `ChatServiceIT`, `CompanionPropertiesIT`, `ContextSnapshotAssemblerIT`, `CompanionAdvisorChainIT`, `ClinicalOutputCheckTest`, `MedicationPopulator`), frontend tesztek + MSW fixture
7. Docs + ADR

**Kapuk:** `cd backend && ./mvnw clean test` · `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` · `node scripts/lint-docs.mjs`. Végül `feat/retire-retatrutide` branch → self-PR → CI zöld → lokális `--no-ff` merge.

**Elfogadási kritérium:** `rg -i 'retatrutid' -- ':!docs/superpowers' ':!docs/old docs' ':!docs/design'` üres találatot ad, az `application.yml` `rx-terms` sorát kivéve; és `rg -iE '\breta\b|reta[A-Z]|--reta-|\.reta-'` ugyanezen a hatókörön szintén üres.

## 9. Kockázatok

- **A `pair_key` migráció elmaradása** elárvítaná a meglévő minta-sorokat, és a nightly job nulla előzménnyel indítaná újra a két korrelációt. A changeset 2. lépése ezt zárja ki; a migráció után egy ellenőrző lekérdezés igazolja, hogy nem maradt `reta-` prefixű kulcs.
- **A `?retaDay=` → `?medCycleDay=` átnevezés** minden elmentett fejlesztői link/bookmark URL-t elavít. Egyfelhasználós, fejlesztői kapcsoló — vállalható; kompatibilitási aliast nem tartunk fenn.
- **Az üres Gyógyszer tab** nem magyarázza meg magát, ha valaki később gyógyszert akarna felvenni. Az üres-állapot szövege ezért kimondja, hogy jelenleg nincs felvételi út.
