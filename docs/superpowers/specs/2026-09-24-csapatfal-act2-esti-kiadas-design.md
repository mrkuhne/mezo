# Csapatfal II. felvonás — „A hang”: az esti kiadás (design spec)

- **Dátum:** 2026-09-24 · **Epic:** `mezo-a9bo7` · **Státusz:** owner-jóváhagyott irány (2026-09-24)
- **Szülő-spec:** [`2026-09-23-boop-team-feed-design.md`](2026-09-23-boop-team-feed-design.md) (§2/3, §2/9–10, §7 7–10) —
  ez a dokumentum a II. felvonás finomítása; ahol eltér, ez nyer.
- **Érintett ADR-ek:** 0048 (napi konzílium — a reggeli jelenet esti kiadássá válik, új ADR kíséri),
  0049 (közös social AI-világ — a fal nem ír szöveget; a hangot a backend állítja elő és tárolja),
  0050 (kontextusos Mezo-feed), 0050-grounded (megalapozott észrevételek statisztikai bizonyíték előtt).

## 1. Owner-döntések (2026-09-24, ne nyisd újra)

1. **Sorrend:** a hipotézis-kritikus lazítása előbb — de ezt a párhuzamos `mezo-hben1` már szállítja
   (grounded ág, 2026-09-23 main-en), ezért a II. felvonás az esti kiadással indul; a kritikus-munkát
   NEM építjük újra, csak a „gyűlik”-posztok használják a kimenetét.
2. **Az esti kiadás a meglévő napi konzílium bővítése** (nem új, párhuzamos válogató, és nem is
   LLM-nélküli szűrés): egy válogató marad, amely minden forrást lát.
3. **Kiadásonként 3–6 poszt** (a szülő-spec §2/3 „2–4” értéke helyett).
4. **Időpont: 21:00** (Europe/Budapest), fix; beállítható időpont nincs (később hozzáadható).
5. **A nevek véglegesek:** Szunya · Mocor · Falat · Derű · Mezo (+ a Szkeptikus) — a szülő-spec §9
   első nyitott kérdése lezárva.
6. **Csendes nap:** ha kevés a friss téma, valós „gyűlik” és kérés posztokkal töltünk fel 3-ig;
   ha ilyen sincs, kevesebb poszt megy ki (akár nulla) — kitalált vagy töltelék-poszt soha.
7. **Szelet-sorrend:** H1 gépezet → H2 a fal átállása + értesítés → H3 saját hang → H4 két karakter
   beszélget → H5 Falat és Derű napi műsora. Az igazi érettség-görbe (`mezo-a9bo7.11`) ezek UTÁN.
8. **Nem cél most:** beállítható időpont, új reggeli szertartás, kérdéslista-bővítés, gyakoribb előrejelzés.

## 2. Felhasználói viselkedés

- **Napközben** a fal csak a „kopogtatásokat” hozza élőben: a rád váró kérdés/döntés posztokat
  (a mai `buildTeamFeed` `waiting` elemei). A csapat közben gyűjt.
- **21:00-kor** (egyszer egy nap) megjelenik a **nap esti kiadása**: 3–6 poszt, a legfontosabb a
  nap posztere (az egyetlen üvegdoboz), a többi csendes lapos panel. Push-értesítés:
  „Megjött az esti kiadás” (csak ha ≥ 1 poszt van).
- **Ami nem került be**, az a karakter szobájában, az ügyei között marad (a szobák ügylistája
  változatlanul a teljes rekordkészletből épül).
- **Reggel** nincs külön csapatmegbeszélés; a napot Mezo meglévő hajnali üzenete nyitja (Nap fül).
- **Nulla poszt** esetén a fal egy statikus UI-mondatot mutat („Ma csendes nap volt — holnap
  folytatjuk.”); ez nem poszt, nem rekord.
- Minden poszt megtartja a „Miből látszik?” linket és az egységes hármast (szülő-spec §2/8).

## 3. Architektúra

### 3.1 Hol él

Az esti kiadás a **`character`** feature-ben él (a konzílium mellett). A függőségi irány
`character → proactive → companion → meal` (`ArchitectureTest.feature_slices_are_cycle_free`), tehát a
character olvashatja a proactive (előrejelzés, kísérlet) és a companion (minta, pattern monitor,
reflexió-észrevétel) szolgáltatásokat; fordítva tilos. Új olvasó-portot CSAK akkor vezetünk be, ha egy
forrás a character-ből nem érhető el közvetlenül (a `CharacterPromptSource` precedens szerint).

### 3.2 A kiadás futása (per user, per nap)

`CharacterCouncilJob` `ready-at: "21:00"` (a `*/15` cron és a lease-alapú `CharacterCouncilProcessing`
marad — 21:00 és 23:45 között újrapróbál; `catch-up-days: 2` marad). Lépések:

1. **Előfeltétel** (változatlan): az előző nap (`D-1`) éjszakai megfigyelés-futása
   (`observationService.generateForDay`) — a detektorok lezárt napra készültek, ezért a karakter-
   észlelések egy nap késéssel kerülnek a kiadásba; a companion-rekordok (minták, előrejelzések,
   kísérletek, reflexió) frissek. Ez tudatos döntés.
2. **Jelöltgyűjtés** (`EditionCandidateCollector`, determinisztikus, LLM nélkül). Forrásonként egy
   kis adapter `EditionCandidate`-et ad:
   `(sourceKind, sourceId, character, genre, title, recordText, facts[], refs[], priority, waiting, changedAt)`.
   - `character_observation` pending → a meglévő konzílium-kör (lásd 3.) eredménye: minden
     vita-szál egy jelölt, gazdája a vezető szakértő karaktere.
   - Companion: döntésre váró minta (`kerdes`, waiting), friss megerősített minta (`megfigyeles`),
     monitorozott pár `n < minN` és `n ≥ 5` (`sejtes` = **gyűlik**), friss grounded észrevétel.
   - Proactive: lezárt előrejelzés (`elorejelzes`), futó kísérlet mérföldkő (`kiserlet`).
   - H5-től: Falat napi értékelés (`ertekeles`), Derű adatkérés (`keres`).
   A `facts[]` a jelölt **összes számszerű és tényszerű állítása** a rekordból (pl. `"5 közös nap"`,
   `"8 kell"`, `"23:10 átlagos lefekvés"`) — a hang-réteg csak ezekből dolgozhat.
3. **Konzílium** (a meglévő `CharacterCouncilService.prepare` útja: proposal → cross-talk → verdict →
   publish, claim-életciklussal) VÁLTOZATLAN szerepben fut a pending megfigyelésekre; a kimenete
   (vita-szálak + claim-változások) jelöltté alakul. A konzílium tehát a dosszié-döntés helye marad,
   a kiadás pedig a fal-publikálás helye.
4. **Válogatás** (`EditionSelector`, determinisztikus, tesztelt tiszta függvény):
   - pontozás: waiting (döntés vár) > friss változás az előző kiadás óta > konzílium claim-változás >
     kísérlet-mérföldkő > lezárt előrejelzés > megfigyelés > gyűlik > kérés;
   - karakterenként legfeljebb 2 poszt; forrás-rekordonként legfeljebb 1;
   - **ismétlés-tilalom:** ugyanaz a forrás 7 napon belül csak akkor kerül újra kiadásba, ha a
     `changedAt` az előző megjelenés után van;
   - 6-nál vágás; ha < 3, feltöltés gyűlik/kérés jelöltekkel 3-ig; ha így is < 3, annyi, amennyi van;
   - rank 1 = a nap posztere.
5. **Hang** (H3-tól; H1–H2-ben a `body` = `recordText`): lásd 3.4.
6. **Publikálás** egy tranzakcióban: `team_edition` + `team_edition_post` sorok, run-napló
   (`character_run.kind = 'EDITION'`), H2-től push-értesítés (`AppNotificationService.emit`).

Idempotencia: a meglévő lease (owner+nap) + egyedi index `team_edition (created_by, day) where is_deleted = false`.
Egy nap kiadása egyszer születik; hibánál a lease újrapróbál, `max-attempts: 3` után a nap kimarad
(őszinte hiány, nem pótlás).

### 3.3 Adatmodell (új migráció `db/changelog/1.1.0/script/`)

- `team_edition`: `id, created_by (FK app_user), day date, status (PUBLISHED|QUIET), generated_at,
  conference_id (nullable FK character_conference), audit-oszlopok`; egyedi `(created_by, day)` élő sorokra.
- `team_edition_post`: `id, edition_id (FK), rank smallint, character_key varchar(16)
  (CHECK szunya|mocor|falat|deru|mezo), genre varchar(16) (CHECK megfigyeles|sejtes|kerdes|kiserlet|
  elorejelzes|konzilium|keres|ertekeles), source_kind, source_id, title text null, body text,
  voiced boolean, facts jsonb, refs jsonb, guests jsonb default '[]' (H4), audit-oszlopok`;
  egyedi `(edition_id, rank)`.
- `character_run.kind` CHECK bővül: `'EDITION'`.
- jsonb-feltételhez `jsonb_exists()`, soha nem `?` (Liquibase-csapda).

### 3.4 Karakter-regisztry és hang (H3)

- **Backend regisztry** `TeamCharacter` enum (character feature): kulcs, név (Szunya, Mocor, Falat,
  Derű, Mezo, Szkeptikus), terület, emoji-készlet, hang-szabályok (a `docs/features/insights.md`
  §2.0a hangkönyvből), és a persona→karakter leképezés (`szomnologus→szunya`, `edzo|drill→mocor`,
  `taplalkozo→falat`, `pszichologus|doki→deru`, `antropologus|mezo→mezo`) + metrika-domén→karakter.
  Ez a FE `logic/team.ts` tükre; a kettőt **ugyanaz a táblázat-teszt** rögzíti mindkét oldalon
  (tükör-tesztek: FE `team.test.ts`, BE `TeamCharacterTest` — azonos eset-lista). A FE `team.ts`
  fejléc-kommentje frissül: a nevek FE-n a megjelenítésért, BE-n a hangért élnek.
- **Egy LLM-hívás kiadásonként** (`EditionVoiceWriter`): bemenet a kiválasztott posztok listája
  (karakter, műfaj, rekord-szöveg, `facts[]`), kimenet JSON `[{rank, title?, body}]`. Prompt-marker
  `CSAPATFAL-ESTI-KIADAS` + `FakeCompanionLlm` `startsWith` tükör; `LlmCallContext("character_edition",
  "voice", …)`; a `PromptPersona.VOICE_HU` a törzsben (proactive.md §7 szabálya); a hívás a
  `CharacterCouncilBudget`-ből foglal; a `character_edition` slug a `throttled-features` listára kerül.
- **Tény-őr** (`EditionVoiceGuard`, tiszta függvény) posztonként: (a) a `body` minden számjegy-
  sorozata szerepel a `facts[]`/`recordText` számai között (normalizálva: szóköz, tizedesvessző);
  (b) 2–4 mondat; (c) emoji csak a karakter saját készletéből, a Szkeptikusnál egy sem; (d) tiltott
  szaknyelvi szavak listája (a spec §2/7 példái + a tutorial hang-lint `FORBIDDEN` töve). Bukás →
  `voiced=false`, `body = recordText`. Az egész hívás bukása → minden poszt `voiced=false`; a
  kiadás ettől még megjelenik.

### 3.5 Két karakter beszélget (H4)

- Konzílium-eredetű szálnál a vendég-hozzászólások a meglévő cross-talk reakcióiból jönnek (vezető =
  poszt-gazda, a többi résztvevő = vendég), a Szkeptikus sora a skeptic-körből.
- Companion-eredetű, két doménes mintapárnál (`pairKey` két domén) a hang-hívás egy vendég-sort is
  kér a másik domén karakterétől + opcionálisan egy Szkeptikus-sort („alternatív magyarázat”).
  Ugyanaz a tény-őr fut rájuk.
- Tárolás: `team_edition_post.guests` = `[{character_key, body, voiced}]`, legfeljebb 2 elem.
  A FE a prototípus kommentelőnézet-anatómiáját követi.

### 3.6 Falat és Derű napi műsora (H5)

- **Falat — `ertekeles`**: a nap (21:00-ig) étkezéseiből három determinisztikus tény-csomag:
  *a tányér* (`MealCoachService` napi értékelésének pont/megjegyzés-tényei), *a cél* (`DailyTargets`
  vs. tényleges kcal/fehérje; a súly-EWMA iránya, ha van), *az edzés* (`WorkoutWindowQueryService`:
  volt-e edzés, és az étkezés időzítése hozzá). Csak az a szólam kerül a posztba, amelyhez van adat;
  0 étkezés → nincs jelölt. Nyitott napról beszél, ezt a poszt ki is mondja („eddig ma”).
- **Derű — `keres`**: ha az elmúlt 14 napban < 8 esti bejelentkezés volt, jelölt születik a valós
  számmal („14 napból 4 estéről tudok”) és CTA-val a bejelentkezésre. Heti egynél többször nem.
  A Derűhöz nem kötött kérés-jelöltek (pl. alvás-naplózás) Mocor/Szunya gazdával ugyanígy
  képezhetők — H5 csak Derű esetét szállítja.

### 3.7 API és FE (H2)

- Új végpont a `character.yml`-ben: `GET /api/character/edition?from=YYYY-MM-DD&to=YYYY-MM-DD` →
  `TeamEdition[] {day, status, posts: TeamEditionPost[] {rank, characterKey, genre, sourceKind,
  sourceId, sourceRoute, title?, body, voiced, guests[]}}`. `sourceRoute` a backend által képzett
  meglévő mélyoldal-útvonal (a FE `teamFeed.ts` útvonal-szabályaival azonos; tükör-teszt).
- FE: `useTeamEditions(from,to)` dual-mode hook + mock (`characterMock.ts`), a `teamFeed.ts`
  kiegészül egy `editionPosts()` leképezéssel ugyanarra a `FeedPost` alakra (így a
  `FeedPosterCard`/`FeedPostCard`/`FeedTrio` változatlan).
- **A fal összeállítása:** azokra a napokra, amelyekhez van kiadás, a fal = a kiadás posztjai; a mai
  napra ezen felül a rád váró kopogtatások (ha egy kopogtatás a kiadásban is szerepel, csak egyszer).
  Kiadás nélküli napokra (kapcsoló ki, az első 21:00 előtt, régebbi napok) a mai I. felvonásos
  `buildTeamFeed` fut — átmenet ugrás nélkül.
- Kapcsoló: `mezo.feature.team-edition.enabled` (backend futás, alapból be) — H1-től élesen fut, de
  a fal csak H2-től olvassa; addig a kiadás a Gépteremben és az API-n látszik. A kapcsoló
  kikapcsolásával a konzílium a kiadás-lépések nélkül fut (vészfék).
- A Gépterem Futások listája az `EDITION` futásokat is mutatja (H1 láthatósága).

## 4. Hibakezelés és őszinteség

- LLM-hiba / tény-őr bukás → a rekord eredeti szövege (`voiced=false`), soha kitalált próza.
- Forrás-rekord törlődik a kiadás után → a poszt marad, a „Miből látszik?” a mélyoldal meglévő
  „nem található” állapotára visz (nem 500).
- Költségkeret 90% fölött (`throttled-features`) → a kiadás hang nélkül születik meg (H1-szintű).
- A kiadás nem módosít tervet, célt, rutint (szülő-spec §8); claim-változást csak a meglévő
  konzílium-út ír.

## 5. Tesztelés

- Tiszta függvények unit-tesztjei: `EditionSelector` (pontozás, 3–6, feltöltés, karakter-sapka,
  ismétlés-tilalom), `EditionVoiceGuard` (számok, mondatszám, emoji, tiltott szavak), `TeamCharacter`
  tükör-táblázat.
- IT-k (Testcontainers): 21:00 előtt nem fut; idempotens (kétszeri futás = egy kiadás); lease-verseny;
  csendes nap (QUIET, 0 poszt, nincs push); LLM-bukás → `voiced=false`; migráció + CHECK-ek.
- `FakeCompanionLlm` marker-tükör a `CSAPATFAL-ESTI-KIADAS` promptra.
- FE: `useTeamEditions` mindkét módban; fal-összeállítás (kiadás-nap vs. fallback-nap, kopogtatás-
  deduplikáció, rank-1 poszter); `VITE_USE_MOCK=false` explicit a real-kapuhoz.
- Kapuk szeletenként: fókuszált backend IT-k + ArchUnit + `gen-codemap --check`; FE mindkét mód + build.

## 6. Szeletek (a terv ezekre bontja)

| Szelet | Tartalom | Kész, ha |
|---|---|---|
| H1 | 21:00-ra költözés, jelöltgyűjtés (companion+proactive+konzílium), `EditionSelector`, gyűlik-feltöltés, táblák+migráció, `EDITION` run, API, kapcsoló | az API egy valós nap kiadását adja 3–6 poszttal, recordText-tel; Gépteremben látszik |
| H2 | FE: `useTeamEditions`, fal-összeállítás, fallback, push „Megjött az esti kiadás”, kapcsoló élesen be | élesen 21:00-kor megjön a kiadás a falra |
| H3 | `TeamCharacter` BE-regisztry + tükör-teszt, `EditionVoiceWriter`, `EditionVoiceGuard`, budget/throttle | a posztok a hangkönyv szerint szólnak, számot nem találnak ki |
| H4 | `guests` kitöltése (konzílium-reakciók + két doménes pár), FE kommentelőnézet | két-karakteres szálak a posztok alatt |
| H5 | Falat `ertekeles` (3 szólam), Derű `keres` (+CTA) | két új napi műsor-fajta a kiadásban |

## 7. Prior art

- **Exist.io korrelációk** (<https://developer.exist.io/reference/correlations/>) — **átvéve:** az
  erősség és a biztosság két külön tengely; a gyenge-de-bizonytalan összefüggés címkével látszik
  (nálunk: `sejtes`/gyűlik n/minN sávval), a mondat a számokból determinisztikusan épül, az LLM csak
  átfogalmaz. **Elvetve:** p-érték alapú szűrés (egy felhasználó, kicsi minta).
- **Google Personal Health Agent** (<https://research.google/blog/the-anatomy-of-a-personal-health-agent/>)
  — **átvéve:** a tény-előállítás és a hang szétválasztása (a számok kódból, a persona csak
  fogalmaz: `facts[]` + tény-őr); „fő + támogató ágens” → poszt-gazda + vendég (H4). **Elvetve:**
  többfordulós, élő koordináció — nálunk esti batch.
- **Google AI co-scientist** (<https://research.google/blog/accelerating-scientific-breakthroughs-with-an-ai-co-scientist/>)
  — **átvéve:** kemény elutasítás csak megalapozási hibára, egyébként rangsorolás (a `mezo-hben1`
  grounded ágával összhangban; a kiadás-válogató is rangsorol, nem küszöböl). **Elvetve:** Elo-
  verseny/evolúciós hurok (túl drága napi néhány tucat jelöltre).
- **Apple ütemezett összefoglaló + AI-összegzés visszavonása**
  (<https://techcrunch.com/2025/01/16/apple-pauses-ai-notification-summaries-for-news-after-generating-false-alerts>)
  — **átvéve:** egyetlen fix esti kiadás kis kerettel, prioritás-sorrend; posztonként EGY forrás-
  rekord (az LLM nem olvaszt össze több állítást), `voiced` jelölés. **Elvetve:** szabad, több
  forrást összegző LLM-összefoglaló — pontosan ott születnek a kitalált tények.
- Persona-konzisztencia promptolásra nem találtunk erős elsődleges forrást; a PHA-féle „rögzített
  tartalom + csak-átfogalmazó persona-réteg” a legjobban alátámasztott minta.

## 8. Codebase terrain

- **Konzílium:** `character/service/CharacterCouncilService.java` (`prepare`/`publish`, lease,
  claim-életciklus), `CharacterCouncilJob.java` (`*/15` cron + `ready-at`), `CharacterCouncilBudget`,
  `KonziliumCrossTalkRound`; konfig `application.yml` `mezo.character.council.*` (~2060. sor).
  ADR 0048 a napi (reggeli) konzíliumot írja le — ezt az új ADR módosítja esti kiadásra.
- **Kontextusos Mezo-feed (`mezo-7nron`):** `proactive/service/FeedGenerationService.java` (Mezo-
  hangra égetett rendszerprompt), `FeedContextAssembler`, `CompanionToolRegistry.feedCallbacks`;
  `companion_message` (egy sor/nap/kind, 16 karakteres `kind` + CHECK) — **nem alkalmas** a 3–6
  posztos kiadás tárolására, ezért új tábla. Újrahasznosítható: a kontextus-összeállító és az
  olvasó-eszközkészlet, ha a hang-hívásnak mélyebb kontextus kell (H3 opció, nem kötelező).
- **Kritikus:** `companion/service/HypothesisPipelineService.java` (grounded ág `vetted()`, a régi
  keep-floor út megmaradt) — `mezo-hben1` szállítja; a kiadás csak fogyasztja.
- **Falat/Derű források:** `meal/service/MealCoachService.java`, `MealService.applyScore`
  (`DailyTargets`, edzés-ablak), `companion/service/DayReviewService.java` (csak lezárt nap),
  `character/detector/CheckinGapDetector.java`, `companion/service/PatternMonitorService.java` (lefedettség).
- **FE:** `features/insights/logic/team.ts` (nevek, persona-leképezés), `logic/teamFeed.ts`
  (`FeedPostKind`-ban már deklarált, használatlan `ertekeles`/`keres`), `components/feed/useTeamFeed.ts`.
- **Minták:** `UserFanOut.forEachActiveUser`; LLM csak a `CompanionLlm` porton, `LlmCallContextHolder`-
  rel; minden új prompt-marker `FakeCompanionLlm`-tükröt kap; új migráció `1.1.0/script/`.
- **Csapdák:** ArchUnit ciklus-szabály (character → proactive → companion, fordítva nem); a
  `VOICE_HU` nem kerülhet a marker elé; a scheduler-pool 4 szálas — a 21:00-s hosszú LLM-futás a
  percenkénti push-diszpécserrel versenyez (a `*/15` + lease ezt elviseli); a költségplafon 70%-nál
  olcsó modellre vált; CODEMAP-regen minden merge után; backend teljes suite csak Testcontainers-szel.
- **Elavult doksik (a terv takarítja):** két `0050` számú ADR; a contextual-feed spec „implementation
  not started” fejléce; `proactive.md` „disabled foundation” szakasza; `character.md` tábla- és
  végpont-számai; a szülő-spec „a kritikus 08-30 óta mindent eldob” mondata (mezo-hben1 óta nem igaz).
