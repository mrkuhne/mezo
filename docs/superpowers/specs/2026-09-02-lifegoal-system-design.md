# Életcél-rendszer (lifegoal) — design spec

**Dátum:** 2026-09-02 · **bd:** mezo-iizd (P1 feature) · **Prototípus:** `docs/design_2.0/prototypes/celok.html` (artifact `e404d1d4-55c3-4e81-a8b4-716c6ba45f87`) · **Státusz:** brainstorm lezárva, prototípus 3 iteráció után jóváhagyva, spec review előtt.

## 0. Összefoglaló

Általános életcél-rendszer a meglévő súly/TDEE "Cél"-motor **mellé** (nem helyette). A felhasználó szabad szöveggel ad meg egy célt (pl. *Kockahas*, *Side hustle az appból*, *Az utolsó barátnő*), a companion 2–5 **pillért** javasol egy zárt jel-katalógusból, és a rendszer **naponta / hetente / havonta** megmondja, közelebb került-e a célhoz — kizárólag abból, amit a felhasználó **már most is naplóz** (étkezés, alvás, edzés, súly, check-in, rutinok, napzárás, activity-log a chatből, említett emberek). Nincs új naplózó felület.

Életterület-réteg: **PERMAH** (Érzelem · Elmélyülés · Kapcsolatok · Értelem · Teljesítmény · Egészség; az Egészség a PERMA gyakorlati kiterjesztése, így is címkézzük). Gyakorlat-réteg: a Growth **LIFE/atlétikai/izom skillek** — a pillérek skillre mutatnak, oda megy az XP.

## 1. Döntések (a brainstormból, végleges)

| # | Döntés | Indok |
|---|---|---|
| D1 | **Mérhető és látható** célok; a régi PRD IDENT-5 / D38 ("PERMA soha nem widget", "nem UI progress bar") tilalmat **ADR írja felül** a célrendszerre. | Tulajdonosi döntés + Harkin et al. 2016 (138 RCT, N≈20k): a rögzített, látható haladás-követés növeli a célelérést (d≈0,40). Megtartott korlátok: nincs veszteség-mechanika, `↘` sosem piros, `no_data` sosem `miss`. |
| D2 | Életterület = **PERMAH** hat dimenzió, skill = gyakorlat-réteg (hibrid). | Súlyozott döntés: PERMA validált mérőeszközre épül (PERMA-Profiler), a skillek adják a jel-kötést és az XP-t. |
| D3 | Pillér-források: **csak meglévő jelek** (activity-ledger + chat + AI-osztályozó a hiányzó viselkedésekre). GitHub-import és minden külső integráció **elutasítva**. | "Self-logging is the enemy"; a GitHub túl specifikus. |
| D4 | Pillér-javaslat: **AI javasol, felhasználó jóváhagy** (propose-only, ADR 0019 mintája), zárt katalógusból. | L2 döntési szint; az AI nem találhat ki metrikát. |
| D5 | Hely: **Én → Célok** (`/me/goals`), a súlycél `/me/goals/weight` alá költözik; **Nap-csempe** "Célok · ma"; **Heti** cél-kártya; **Growth** skill-chip; **Jelek** oldal a hub alatt. | A "hosszú cél" már az Én hubon él; a Nap a napi visszacsatolás helye. |
| D6 | Motor: **éjszakai job + tárolt napi pillér-sorok**; LLM csak a heti narratív réteget adja. | Determinisztikus, auditálható, olcsón olvasható a companion promptból. |
| D7 | **Nincs felső korlát az aktív célokra.** A parkolás a felhasználó eszköze; a cél-konfliktus (két cél ugyanazt a pihenőt kéri) companion-mondat, nem tiltás. | Daniel döntése a 2. iterációban; a korábban tervezett 3-as 409-es kapu törölve. |
| D8 | Varázsló: cél + miért → **SDT keret-nudge** (külső → belső keretezés felajánlása, nem tiltás) → AI-pillérek → **akadály + ha–akkor** (WOOP) → **összegzés = a leendő cél-oldal előnézete**. | Niemiec–Ryan–Deci 2009 (belső aspirációk ↔ jóllét); Gollwitzer–Sheeran 2006 (implementation intentions d≈0,65). |
| D9 | A ha–akkor tervek **trigger-szabályok**: ahol a HA-feltétel egy naplózott jelre képezhető, Mezo felismeri és visszaidézi a tervet; ahol nem, a kártya őszintén jelzi ("nincs hozzá jelem · ezt te tartod"). | 2. iteráció: a lépés csak így érthető. |
| D10 | Pillér-fajták (Strides-taxonómia): **szokás** · **átlag** · **cél-érték ütemvonallal** · **baseline** (saját 28 napos medián) · **kapcsolt** (a súlycél-motor ítélete). | Egy modell a felhasználó mindhárom céljára. |

## 2. Prior art

Külső minták, amiket átvettünk vagy elvetettünk (a `researcher` ügynök jelentése alapján, a hivatkozások a research-wikibe is bekerülnek a 4. szeletben):

- **Strides** — négy cél-típus (Habit / Target ütemvonallal / Average / Project). **Átvéve** (D10, a Project helyett a "kapcsolt" fajta). https://www.stridesapp.com/help/
- **Exist.io** — nincs cél-objektum, attribútum + 60 napos gördülő medián mint baseline, korrelációk. **Átvéve a baseline-pillér** (28 nap, min. 14 adat-nap); a korrelációs réteg **elhalasztva**. https://developer.exist.io/reference/object_types/
- **Apple Fitness Trends** — rövid vs hosszú ablak nyíl + egy javasolt következő lépés + "hány hét a fordulásig". **Átvéve** (7 vs 21 nap, min. 5 adat-nap kapu, companion-mondat). https://www.macstories.net/stories/activity-trends-in-ios-13/
- **WHOOP Journal** — igen/nap vs nem/nap különbség egy kimenetre ("a napzárásos napokon +18% alvás"). **Elhalasztva** a Phase 2-re (attribúció-kártya a heti visszatekintésben). https://the5krunner.com/2023/04/15/whoop-new-recovery-behaviours/
- **Célkonfliktus-kutatás** (Gorges & Grund 2017) — a párhuzamos célok erőforrás-konfliktusa rontja az elérést. **Átvéve mint companion-figyelmeztetés**, elvetve mint kemény korlát (D7). https://pmc.ncbi.nlm.nih.gov/articles/PMC5696770/
- **PERMA-Profiler** (Butler & Kern 2016), **Gallup Wellbeing 5**, **Ryff**, **SDT cél-tartalom** (Niemiec, Ryan & Deci 2009), **Harkin et al. 2016**, **Gollwitzer & Sheeran 2006** — a taxonómia és a varázsló tudományos alapja (D1, D2, D8). Gallup és Ryff **elvetve** mint látható taxonómia (vendor-modell / túl absztrakt).
- **Elvetve**: Gyroscope-féle egyetlen "life score" (átláthatatlan), manuális check-in-only célok, nyíl minimum-adat kapu nélkül.

## 3. Codebase terrain

Az `investigator` ügynök jelentéséből, ellenőrizve:

- **A meglévő `goal` tábla nem bővíthető** életcéllá: `ck_goal_trajectory`, NOT NULL `start_weight_kg` / `rate_target_pct_per_week`, egy-aktív invariáns (`GoalService.activateGoal`), 14 külső olvasó súly-szemantikával (`FuelDayService`, `ContextSnapshotAssembler` `[Cél]` blokk, `GoalTools.get_goal`, `QuestSelector`…). → **Új szelet `feature/lifegoal`**, a súlycél változatlan és kapcsolt pillérként hivatkozott.
- **Jel-forrás**: `companion/service/MetricSeriesService.series(userId, MetricKey, from, to)` — 32 kulcs (`SLEEP_DURATION_H`, `DAILY_PROTEIN_G`, `DAILY_KCAL`, `DAILY_WATER_ML`, `GYM_VOLUME_KG`, `SPORT_LOAD_MIN`, `ACWR`, `CHECKIN_ENERGY/MENTAL/STRESS/BODY`, `HABITS_DONE`, `RITUAL_CLOSED`, `DAILY_XP`, `SOCIAL_MENTIONS`, `RUN_HR_RECOVERY_S`, `BEDTIME_VARIABILITY`…). Dátumtartományos repository-finderek: `ActivityLogRepository.findByCreatedByAndOccurredOnBetween`, `HabitDayRepository…HabitDateBetween`, `NeedsDayRepository…NeedsDateBetween`, `WorkoutSessionRepository.findDoneInstancesBetween`, `RunSessionLogRepository`, `SportSessionRepository`, `WeightLogRepository`, `CheckInRepository`.
- **Activity-ledger**: `activity_log(occurred_on, text, skill_key, confidence, xp_awarded, extracted{durationMin, amountHuf}, categorized_by)` — a side hustle és az ismerkedés forrása.
- **Skill-taxonómia**: `ProgressionTaxonomy.LIFE` = mindfulness, mindset, cooking, financial, productivity, learning, connection, recovery (string-kulcsok, kód-konstans **négy helyen**: backend lista, FE `LIFE_SKILLS`, osztályozó-prompt, badge-cél). Új skill-kulcs nem kell az első körben.
- **Életjel**: az élő % csak FE (`features/today/logic/needs.ts`); a backend `needs_day` csak napzáráskor íródik → a `needs_ring` forrás csak napzárásos napokon ad értéket.
- **Score-infrastruktúra**: `DayScoreService` (négy részpont, `<2` jelen esetén `null`), `MeWeekService.week` (write-through `weekly_score`), `WeeklyReviewJob` (hétfő 06:50), `period_summary(granularity, period_start)` mint időszak-idióma.
- **Cron**: `SchedulingConfiguration` + `mezo.techcore.cron.<x>-job.enabled` kapcsolók; a hajnali fürt foglalt (02:20, 02:40, 02:50, 03:00, 03:10, 03:20, 03:30, 03:45, 03:50, 04:00), a `QuestJob.finalize` 00:05, `HabitJob.close` 00:10 → **`LifeGoalEvalJob` 00:20**.
- **Cross-feature irány**: portok `ObjectProvider`-rel (`QuestLedgerSource`, `WeekReviewSource` ← adapter), vagy Spring event (`GoalSavedEvent` → `GraphPromotionListener`). A companion **nem** importálhat lifegoal-t → `companion/LifeGoalSource` port + `lifegoal/…/LifeGoalSourceAdapter`.
- **ArchUnit**: `feature_slices_are_cycle_free` fagyasztott szabály (biometrics↔goal ciklus, mezo-ah18.15); csak a teljes `./mvnw test` futtatja. Stereotype-ok csomagonként, controller `implements <Tag>Api`, nincs osztályszintű `@Transactional`, nincs `@Value`, nincs nyers `RuntimeException`.
- **Konvenciók**: contract-first `api/feature/lifegoal/lifegoal.yml` → `cd api/generate && npm run generate:api`; FE `useDualQuery` (mock/real, `realStaleTime` elhagyva = mindig stale), MSW fixture `frontend/src/test/msw/handlers.ts`, mindkét teszt-mód; **Liquibase** (nem Flyway) `db/changelog/1.0.0/script/<yyyymmddHHMM>_<bd-id>_<desc>.sql` + `1.0.0_master.yml`, `scripts/lint-liquibase.mjs`; `ResetDatabase` TRUNCATE-lista; seed csak `demofixtures` profilon; `docs/CODEMAP.md` regenerálás (`node scripts/gen-codemap.mjs --check`).
- **Csapdák / nyitott bd**: `mezo-06o0.5` (éjszakai gráf-reconcile visszaaktiválja az archivált GOAL node-ot — előfeltétel a 3. szeletnek), `mezo-edrv` (kódban javítva, issue nyitott), `mezo-atgg` (részben elavult), `mezo-3ny`, `mezo-800` (PeriodChips dedup).

## 4. Tartomány-modell

Új szelet `io.mrkuhne.mezo.feature.lifegoal` (`entity / repository / service / controller / mapper / config / engine`). Három tábla:

**`life_goal`**
- `id uuid`, `created_by`, audit-mezők, `deleted`
- `title text`, `why_text text`, `frame` (`intrinsic | extrinsic | unset`)
- `dimension` (`positive_emotion | engagement | relationships | meaning | accomplishment | health`), `secondary_dimension` nullable — `ck_life_goal_dimension`
- `status` (`draft | active | parked | done | archived`) — `ck_life_goal_status`; **nincs aktív-szám korlát**
- `start_date`, `target_date` nullable (`ck` target ≥ start), `activated_at`, `closed_at`
- `obstacle_text`, `if_then_plans jsonb` — lista: `{ha, akkor, trigger: {source, condition, delayHours} | null}`; `trigger.source` ∈ jel-katalógus (pl. `sport_session_logged`, `checkin_energy_lte`), `null` = kézi terv

**`life_goal_pillar`**
- `goal_id fk`, `label`, `skill_key` (a `ProgressionTaxonomy` ellen validálva), `kind` (`habit | average | target | baseline | linked`), `weight int 1..3`, `position`, `active bool`
- `source jsonb` — zárt katalógus: `{type: metric, key: <MetricKey>}` · `{type: activity, skillKey, measure: minutes|count|huf}` · `{type: habit, habitKey}` · `{type: weight_goal}` · `{type: needs_ring, ring}` · `{type: social_mentions}`
- `rule jsonb` — fajtánként: habit `{threshold, comparator, daysPerWeek}` · average `{threshold, comparator, windowDays=7}` · target `{startValue, targetValue, startDate, targetDate, direction}` · baseline `{windowDays=28, minDataDays=14, direction}` · linked `{}`

**`life_goal_pillar_day`** — `uq(pillar_id, day)`
- `value numeric` nullable, `target numeric` nullable, `baseline numeric` nullable, `status` (`hit | partial | miss | no_data`), `computed_at`

Nem lesz: életterület-tábla (enum kódban), hét-tábla (olvasáskor aggregálva), `IdentityStage`-féle életszakasz-gépezet.

## 5. Pontozó motor és job

`LifeGoalScorer` — tiszta, determinisztikus függvények. Források: `SignalSource` port hat megvalósítással (`MetricSignalSource` → `MetricSeriesService`; `ActivitySignalSource`; `HabitSignalSource`; `WeightGoalSignalSource` → a súlycél-motor utolsó kiértékelésének "ütemben" ítélete; `NeedsRingSignalSource` → `needs_day`; `SocialSignalSource` → `MetricKey.SOCIAL_MENTIONS`). Függőségi irány: **lifegoal → companion, progression, activity, habit, needs, goal**; visszafelé csak port (`companion/LifeGoalSource`).

**Napi státusz**: habit → `hit` ha érték a küszöb jó oldalán; average → `hit` / `partial` (10%-on belül) / `miss`; target → ütemvonal `expected(day) = start + (target − start) × elapsed/total`, `hit` ha a jó oldalon; baseline → `hit` ha jobb a 28 napos mediánnál, `no_data` ha < 14 adat-nap; linked → a súlycél-motor `onPace` → `hit`, különben `partial`. Nincs jel = `no_data`.

**Cél napi pontja** = súlyozott átlag (`hit`=1, `partial`=0,5, `miss`=0), `no_data` kimarad; ha egy pillérnek sincs adata → `null`.

**Irány-nyíl** (pillérenként és célonként): utolsó 7 nap átlaga vs az azt megelőző 21 nap; ≥ +0,10 fel, ≤ −0,10 le, közte vízszintes; **mindkét ablakban ≥ 5 adat-nap**, különben "nincs elég adat". Companion-mondat a `↘`-hez: "hány hét a fordulásig" = a hiányzó hit-napok / heti cél-napszám.

**Hét/hónap**: olvasáskor aggregálva a napi sorokból; hónap = naptár-hőtérkép + a hónap átlaga az előző hónaphoz, ugyanazzal a kapuval.

**`LifeGoalEvalJob`** — cron `0 20 0 * * *`, kapcsoló `mezo.techcore.cron.life-goal-eval-job.enabled`, felhasználónként hibaizolált; minden aktív cél pilléréhez **az utolsó 3 napot** újraírja (kései naplózás), idempotens upsert. Ugyanez a pontozó fut olvasáskor a mai napra (nem tárolódik) és `POST /api/life-goals/{id}/evaluate`-ra.

**Ha–akkor triggerek** (D9): a job és két esemény-listener (`SportSessionLoggedEvent`, `CheckInSavedEvent`) ellenőrzi az aktív célok `if_then_plans[].trigger`-jeit; teljesülés → `AppNotificationKind.LIFE_GOAL_PLAN` értesítés a megadott késleltetéssel (pl. másnap 07:00), a companion `[Célok]` blokkjába bekerül "ma él: <terv>". Kézi (trigger nélküli) terv sosem generál értesítést.

**XP**: `hit` pillér-nap → fix kis XP (config `mezo.lifegoal.xp-per-hit`, alap 5) a pillér `skill_key`-ére `ProgressionService.award`-on át, `source_type = LIFE_GOAL`, `source_ref_id = <pillarId>:<day>` (idempotens); additív CHECK-lazítás a `level_up_event.source_type`-on (needs-precedens). A cél nem ad XP-t, `miss` nem von le.

**Konfliktus-figyelés** (D7): olvasáskor derivált jelzés, ha két aktív cél pillérei ellentétes irányba húzzák ugyanazt a jelet (pl. `GYM_VOLUME_KG` habit ↑ és `ACWR` gard ≤) → companion-mondat a hubon és a heti kártyán, nem blokk.

## 6. Felületek (FE, Mozaik 2, a prototípus a vizuális igazság)

- **`/me/goals` → `CelokPage`**: hero = hat-ívű PERMAH-gyűrű (élő ív ahol aktív cél van, közép = aktív célszám) + egy companion-mondat + `↗/→/↘` számlálók; dimenzió-chip sáv (üres dimenzió szürke, nincs kitalált érték); mozaik: célonként `Tile` (eyebrow = dimenzió, clay ikon, heti nyíl + %, 7 pötty), "＋ Új cél"; parkolt célok sora; **Jelek** sor → `/me/goals/signals`.
- **`/me/goals/:id` → `CelPage`**: hero (cím, ikon, nyíl + heti %), Hét/Hónap chipek, companion-mondat, pillér-kártyák (címke, skill-ikon, fajta-chip, érték vs cél/baseline, minibar, 7 pötty vagy 28 napos hőtérkép, saját nyíl, `↘`-nél "hány hét a fordulásig"), üres pillér ghost-állapotban, "Mezo javasol egy pillért" kártya (elfogad / most nem), "Miért · ha–akkor" kártya, Parkolás / Lezárás, ⋯ → szerkesztő sheet (pillérek ki/be, súly, katalógus).
- **`/me/goals/weight`**: a mai `GoalsPage` + `GoalTimeline` + `GoalRecept` változatlanul, új route; a súlycél varázslója `/me/goals/weight/new`.
- **`/me/goals/new` → `CelWizardPage`**: 1 Cél + miért + határidő · 2 Keret (Mezo olvasata, külső → belső ajánlás, dimenzió-javaslat) · 3 Pillérek (AI-javaslat kapcsolókkal, katalógus-sheet, max 5) · 4 Akadály + ha–akkor (akadály-chipek a naplóból; HA/AKKOR kártyák, lábléc = a jel, amiből Mezo felismeri, vagy "nincs hozzá jelem") · 5 Összegzés = cél-oldal előnézet (cél-kártya + idézet + határidő/időkeret/pillér cellák; "Így mérjük" pillérenként szabály + forrás szavakkal; ha–akkor szabályok; "Aktiválás után" négy sor). Mentés tervezettként / Aktiválás.
- **`/me/goals/signals` → `JelekPage`**: forrásonként csempe (ikon, név, "x/7 nap", tápált pillérek chipjei), **él / alszik** státusz (volt-e adat az elmúlt 7 napban), záró elv: nincs külső forrás.
- **Nap hub**: `Tile` "Célok · ma" = ma teljesült / összes pillér + pöttysor (a még nyitottak üresek); csak aktív cél mellett.
- **Heti**: `WeekGoalsCard` (célonként nyíl + dimenzió-chip + egy mondat) + a heti AI-visszatekintés cél-szekciója egy CTA-val.
- **Growth → Skillek**: `goalchip` a skill-soron, ha aktív cél pillére mutat rá.
- **Én hub hero**: "Hosszú cél" → aktív célok száma + heti összkép, → `/me/goals`.

Kontrakt `api/feature/lifegoal/lifegoal.yml`: `GET/POST /api/life-goals`, `GET/PUT/DELETE /api/life-goals/{id}`, `POST /{id}/status` (activate/park/done/archive), `PUT /{id}/pillars`, `GET /{id}/progress?from&to` (napi sorok + számolt nyilak + konfliktus-jelzés), `POST /propose`, `POST /{id}/evaluate`, `GET /api/life-goals/signals` (katalógus + liveness), `GET /api/life-goals/today` (Nap-csempe). FE: `data/lifegoal/{lifegoalApi,lifegoalHooks,lifegoalMock}.ts`, `useDualQuery`, MSW fixture, `data/hooks.ts` barrel.

## 7. AI, companion, ADR

- **`POST /propose`** → `LifeGoalProposeLlmAdapter` (a `HabitSuggestLlmAdapter` mintája): bemenet cél + miért + a jel-katalógus + skill-lista; kimenet dimenzió (+ másodlagos), `frame`, 3–5 pillér (forrás + szabály + skill + súly), akadály-jelöltek, 1–3 ha–akkor trigger-javaslattal. Backend validál: ismeretlen forrás/skill/metrika eldobva. LLM kikapcsolva/hiba → szabály-alapú sablon dimenzió szerint.
- **Companion**: `ContextSnapshotAssembler` `[Célok]` blokk a `LifeGoalSource` porton (aktív célok, heti nyilak, leggyengébb pillér, ma élő ha–akkor); chat-tool `get_life_goals`; a heti visszatekintés promptja megkapja a számolt nyilakat és **magyarázza, nem számolja**.
- **Tudásgráf**: aktív életcél → `GOAL` node (`GraphPromotionService` mintája, `source_kind = life_goal`); **előfeltétel `mezo-06o0.5` javítása** (user-archived jelző), különben a parkolt célok éjjel visszakapcsolnak.
- **ADR** `docs/decisions/0034-measurable-life-goals.md`: felülírja IDENT-5 "PERMA soha nem widget" és D38 "nem UI progress bar" tilalmat a célrendszerre; indoklás D1; megtartott korlátok felsorolva; D7 (nincs cap) rögzítve.

## 8. Tesztelés

- **Egység**: `LifeGoalScorer` — ütemvonal, medián-baseline + 14 napos kapu, nyíl-küszöbök + 5 adat-napos kapu, súlyozott napi pont `no_data` kihagyással, `null` ha nincs adat; trigger-kiértékelés (source/condition/delay); konfliktus-derivált.
- **IT (fókuszált, `-Dmezo.test.use-testcontainers=true`)**: CRUD + státusz-átmenetek (draft→active→parked→active, done, archive), job idempotencia (kétszer futtatva ugyanaz), 3 napos újraírás kései naplózásra, XP idempotencia `(pillér, nap)` kulcson, `propose` validációja ismeretlen forrásra + sablon-fallback, `signals` liveness, `LifeGoalPopulator` + `ResetDatabase` TRUNCATE-lista.
- **ArchUnit** a teljes `./mvnw test`-ben: lifegoal→companion egyirányúság, a fagyasztott biometrics↔goal ciklus nem szélesedik.
- **FE**: hook-tesztek mindkét módban, `CelokPage` / `CelPage` / `JelekPage` / varázsló render-tesztek üres állapottal és `no_data` pillérrel, MSW fixture; `pnpm build`.
- **Kapuk**: codemap-regenerálás, contract-drift, Liquibase-lint, docs-lint, CI teljes backend suite a self-PR-en.

## 9. Ütemezés — bd epic mezo-iizd, 4 szelet

1. **Alapok** — Liquibase (3 tábla + `level_up_event.source_type` lazítás), entity/repo/service, kontrakt + generálás, CRUD + státusz, jel-katalógus + `propose` (LLM + sablon), varázsló (5 lépés), `CelokPage` / `CelPage` mock+real, súlycél-route költöztetés, `demofixtures` seed a három céllal.
2. **Motor** — `SignalSource` port + 6 forrás, `LifeGoalScorer`, `LifeGoalEvalJob` + config, `progress` / `today` / `signals` endpoint, XP-integráció, trigger-kiértékelés + `LIFE_GOAL_PLAN` értesítés, `JelekPage`, élő pöttyök/nyilak/hőtérkép.
3. **Beágyazás** — Nap-csempe, `WeekGoalsCard` + heti visszatekintés-prompt, `[Célok]` blokk + `get_life_goals`, gráf-node + `mezo-06o0.5` javítás, Growth skill-chip, Én hub hero, konfliktus-mondat.
4. **Dokumentáció** — ADR, `docs/features/lifegoal.md` (key_files frontmatter), `goal-engine.md` frissítés (súlycél mint kapcsolt pillér), research-wiki oldalak a 2. szakasz forrásaiból, codemap, `prototypes/README.md` + design-iterations napló.

## 10. Nyitott kérdések (nem blokkolók)

- Hub-hero: a hat-ívű gyűrű marad (prototípus), vagy heti összpont-szám — döntés a következő prototípus-körben.
- A heti % a cél-csempén marad-e a nyíl mellett.
- Hét/Hónap váltó egy helyen fent (prototípus) vs pillérenként.
- Keret-lépés önálló (prototípus) vs inline a "miért" mezőben.
- Dimenzió-nevek magyarul: Érzelem · Elmélyülés · Kapcsolatok · Értelem · Teljesítmény · Egészség.
